import type { SupabaseClient } from '@supabase/supabase-js';
import { ALLOWED_FROM_DOMAIN } from './email';
import { sendAsAdmin } from './email/sendAsAdmin';
import { loadAdminFull, renderForRecipients, resolveRecipients, type AdminRow, type ComposeRenderResult } from './email/composeContext';
import { getTemplate } from './email/templates';

/**
 * Geplande mailingen (migratie 204). Een mailing wordt als concept
 * klaargezet (ook door Claude, op verzoek), een beheerder bekijkt hem in het
 * admin-paneel, stuurt zichzelf een test en keurt hem goed. Pas dan verstuurt
 * de cron hem op het gekozen tijdstip, als de goedkeurder (of de gekozen
 * afzender), met afmeldlink en zonder afgemelde klanten.
 */

export type MailingStatus = 'concept' | 'goedgekeurd' | 'bezig' | 'verstuurd' | 'geannuleerd' | 'mislukt';

export type GeplandeMailing = {
  id: string;
  naam: string;
  template_key: string;
  options: Record<string, unknown>;
  ontvangers: string[];
  afzender_admin_id: string | null;
  verstuur_op: string;
  status: MailingStatus;
  goedgekeurd_door: string | null;
  goedgekeurd_op: string | null;
  aangemaakt_door: string | null;
  verstuurd: number;
  mislukt: number;
  opt_out: number;
  fout: string | null;
  gestart_op: string | null;
  klaar_op: string | null;
  created_at: string;
};

/** Hoeveel ontvangers één mailing maximaal heeft; één cronronde moet hem kunnen versturen. */
export const MAX_ONTVANGERS = 1500;
/** Resend: 10 per seconde, met marge. */
const INTERVAL_MS = 125;
/** Een mailing die langer dan dit op 'bezig' staat, is blijven hangen. */
export const BEZIG_TE_LANG_MIN = 15;

export type Actie = 'goedkeuren' | 'annuleren' | 'naar_concept';

/** Mag deze actie vanuit deze status? Geeft een foutmelding of null. */
export function magActie(status: MailingStatus, actie: Actie, verstuurOp: string, nu: Date = new Date()): string | null {
  if (actie === 'goedkeuren') {
    if (status !== 'concept') return 'Alleen een concept kan worden goedgekeurd';
    if (Date.parse(verstuurOp) < nu.getTime() - 60 * 60_000) return 'Het verzendmoment ligt meer dan een uur in het verleden; pas het eerst aan';
    return null;
  }
  if (actie === 'annuleren') return status === 'concept' || status === 'goedgekeurd' ? null : 'Deze mailing kan niet meer worden geannuleerd';
  return status === 'goedgekeurd' ? null : 'Alleen een goedgekeurde mailing kan terug naar concept';
}

/** Velden van een campagnemail die in het admin-paneel bewerkt kunnen worden. */
export const BEWERKBARE_OPTIES = ['subject_override', 'preheader', 'body', 'cta_label', 'cta_url'] as const;

export type Bewerking = {
  options?: Record<string, unknown>;
  ontvangers?: unknown;
  verstuur_op?: unknown;
  naam?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Controleert een bewerking van tekst, ontvangers of verzendmoment en geeft
 * de databasewijziging terug. Alleen een concept mag worden bewerkt: een
 * goedgekeurde mailing eerst terug naar concept, zodat er na elke wijziging
 * opnieuw iemand goedkeurt.
 */
export function controleerBewerking(
  m: Pick<GeplandeMailing, 'status' | 'options'>,
  invoer: Bewerking,
  nu: Date = new Date(),
): { fout: string } | { wijziging: Record<string, unknown> } {
  if (m.status !== 'concept') return { fout: 'Alleen een concept kan worden bewerkt. Zet hem eerst terug naar concept.' };
  const wijziging: Record<string, unknown> = {};
  if (invoer.options) {
    const opties = { ...m.options };
    for (const k of BEWERKBARE_OPTIES) {
      const v = invoer.options[k];
      if (v === undefined) continue;
      if (typeof v !== 'string') return { fout: `Ongeldige waarde voor ${k}` };
      opties[k] = k === 'body' ? v : v.trim();
    }
    if (!String(opties.subject_override ?? '').trim()) return { fout: 'Het onderwerp mag niet leeg zijn' };
    if (!String(opties.body ?? '').replace(/<[^>]*>/g, '').trim()) return { fout: 'De mail mag niet leeg zijn' };
    if (String(opties.body).length > 200_000) return { fout: 'De mail is te lang' };
    wijziging.options = opties;
  }
  if (invoer.ontvangers !== undefined) {
    if (!Array.isArray(invoer.ontvangers) || !invoer.ontvangers.every(x => typeof x === 'string' && UUID.test(x))) return { fout: 'Ongeldige ontvangers' };
    const uniek = [...new Set(invoer.ontvangers as string[])];
    if (uniek.length === 0) return { fout: 'Kies minstens één ontvanger' };
    if (uniek.length > MAX_ONTVANGERS) return { fout: `Hooguit ${MAX_ONTVANGERS} ontvangers per mailing` };
    wijziging.ontvangers = uniek;
  }
  if (invoer.verstuur_op !== undefined) {
    const t = typeof invoer.verstuur_op === 'string' ? Date.parse(invoer.verstuur_op) : NaN;
    if (Number.isNaN(t)) return { fout: 'Ongeldig verzendmoment' };
    if (t < nu.getTime() - 5 * 60_000) return { fout: 'Het verzendmoment ligt in het verleden' };
    if (t > nu.getTime() + 90 * 24 * 3_600_000) return { fout: 'Het verzendmoment ligt te ver vooruit' };
    wijziging.verstuur_op = new Date(t).toISOString();
  }
  if (invoer.naam !== undefined) {
    if (typeof invoer.naam !== 'string' || !invoer.naam.trim()) return { fout: 'De naam mag niet leeg zijn' };
    wijziging.naam = invoer.naam.trim().slice(0, 200);
  }
  if (Object.keys(wijziging).length === 0) return { fout: 'Niets om op te slaan' };
  return { wijziging };
}


const wacht = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Rendert de mailing voor de ontvangers (of alleen de eerste, voor voorbeeld en test). */
export async function renderMailing(
  supabase: SupabaseClient,
  m: Pick<GeplandeMailing, 'template_key' | 'options' | 'ontvangers'>,
  afzender: AdminRow,
  alleenEerste = false,
): Promise<{ gerenderd: ComposeRenderResult[]; overgeslagen: number }> {
  const template = getTemplate(m.template_key);
  if (!template) throw new Error(`Onbekende template ${m.template_key}`);
  const ids = alleenEerste ? m.ontvangers.slice(0, 1) : m.ontvangers;
  /* Klanten die niet meer actief zijn, slaan we over. */
  const actief = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('customers').select('id').in('id', ids.slice(i, i + 200)).eq('is_active', true);
    for (const c of data ?? []) actief.add(c.id as string);
  }
  const { resolved } = await resolveRecipients(
    supabase,
    { id: afzender.id, role: afzender.role },
    ids.filter(id => actief.has(id)).map(id => ({ type: 'customer' as const, id })),
  );
  const gerenderd = await renderForRecipients(supabase, afzender, resolved, { template, optionValues: m.options });
  return { gerenderd, overgeslagen: ids.length - gerenderd.length };
}

/** Laadt de afzender en controleert dat die mag versturen. */
export async function laadAfzender(supabase: SupabaseClient, adminId: string | null): Promise<AdminRow> {
  if (!adminId) throw new Error('Geen afzender');
  const a = await loadAdminFull(supabase, adminId);
  if (!a) throw new Error('Afzender niet gevonden');
  if (a.email.split('@')[1]?.toLowerCase() !== ALLOWED_FROM_DOMAIN) throw new Error(`Afzender ${a.email} is geen @${ALLOWED_FROM_DOMAIN}-adres`);
  return a;
}

/** Stuurt de eerste versie van de mailing als test naar een adres. */
export async function stuurTest(supabase: SupabaseClient, m: GeplandeMailing, afzender: AdminRow, naar: { email: string; naam: string }): Promise<string | null> {
  const { gerenderd } = await renderMailing(supabase, m, afzender, true);
  const eerste = gerenderd[0];
  if (!eerste) return 'Geen geldige ontvanger om een voorbeeld van te maken';
  const r = await sendAsAdmin({
    admin: { id: afzender.id, name: afzender.name, email: afzender.email },
    to: naar.email,
    toName: naar.naam,
    subject: `[TEST] ${eerste.subject}`,
    html: eerste.html,
    text: eerste.text,
    scope: 'transactional',
    bypassOptOut: true,
    templateKey: m.template_key,
    templateOptions: { geplande_mailing_id: m.id, test: true },
  });
  return r.ok ? null : r.error || 'Versturen mislukt';
}

/** Verstuurt een geclaimde mailing en legt de tellingen vast. */
export async function verstuurMailing(supabase: SupabaseClient, m: GeplandeMailing): Promise<{ verstuurd: number; mislukt: number; opt_out: number }> {
  const afzender = await laadAfzender(supabase, m.afzender_admin_id ?? m.goedgekeurd_door);
  const template = getTemplate(m.template_key);
  if (!template) throw new Error(`Onbekende template ${m.template_key}`);
  const { gerenderd } = await renderMailing(supabase, m, afzender);
  const telling = { verstuurd: 0, mislukt: 0, opt_out: 0 };
  let laatste = 0;
  for (let i = 0; i < gerenderd.length; i++) {
    const g = gerenderd[i];
    const r = await sendAsAdmin({
      admin: { id: afzender.id, name: afzender.name, email: afzender.email },
      to: g.recipient.recipient.email,
      toName: g.recipient.recipient.name,
      subject: g.subject,
      html: g.html,
      text: g.text,
      scope: template.scope,
      customerId: g.recipient.recipient.id,
      templateKey: template.key,
      templateOptions: { geplande_mailing_id: m.id, naam: m.naam },
      unsubscribeToken: g.recipient.unsubscribeToken,
    });
    if (r.blockedByOptOut) telling.opt_out++;
    else if (r.ok) telling.verstuurd++;
    else telling.mislukt++;
    if (Date.now() - laatste > 2000) {
      laatste = Date.now();
      await supabase.from('geplande_mailingen').update({ ...telling, updated_at: new Date().toISOString() }).eq('id', m.id);
    }
    if (i < gerenderd.length - 1) await wacht(INTERVAL_MS);
  }
  return telling;
}
