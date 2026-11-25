import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_BASE_URL, layout, sendEmail } from './email';
import { verstuurPush, type PushAanmelding } from './pushNotification';
import { amsterdamYmd } from './appointmentSlots';
import { EIGEN_TOT_MIN, SEINTJE_MIN, groepeerMomenten, momentLabel, nlTijd } from './terugbellen';

/**
 * Seintjes buiten het portaal om: een pushmelding vijf minuten van tevoren en
 * een dagoverzicht per mail om 8 uur. Alleen voor klanten met de
 * terugbelfunctie aan (customers.terugbellen, migratie 202).
 */

export const DAGOVERZICHT_TYPE = 'terugbel_dagoverzicht';
const MIN = 60_000;

type Een<T> = T | T[] | null;
const een = <T,>(v: Een<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

const VELDEN =
  'id, customer_id, terug_op, notitie, portal_user_id, apparaat, voor_iedereen, customers!inner(terugbellen, is_active), leads!inner(naam_klant, plaatsnaam, toestemming_ingetrokken_op)';
type Rij = {
  id: string; customer_id: string; terug_op: string; notitie: string | null; portal_user_id: string | null; apparaat: string | null; voor_iedereen: boolean;
  customers: Een<{ terugbellen: boolean; is_active: boolean }>;
  leads: Een<{ naam_klant: string | null; plaatsnaam: string | null; toestemming_ingetrokken_op: string | null }>;
};

/** Migratie 202 nog niet toegepast: dan is er niets te doen. */
export function nogNietAanwezig(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === '42703' || error.code === 'PGRST205' || error.code === 'PGRST200');
}

/** Naar wie: een gebruiker, een browser of iedereen op het account. */
export function aanmeldingenVoor<T extends { portal_user_id: string | null; apparaat: string | null }>(
  m: { portal_user_id: string | null; apparaat: string | null; voor_iedereen: boolean },
  subs: T[],
): T[] {
  if (m.voor_iedereen) return subs;
  if (m.portal_user_id) return subs.filter(s => s.portal_user_id === m.portal_user_id);
  if (m.apparaat) return subs.filter(s => s.apparaat === m.apparaat);
  return subs;
}

/** Pushmeldingen voor momenten die binnen vijf minuten aan de beurt zijn. Elk moment precies één keer. */
export async function stuurSeintjes(supabase: SupabaseClient, nu: Date = new Date()): Promise<{ momenten: number; verstuurd: number; aanwezig: boolean }> {
  const { data, error } = await supabase
    .from('lead_terugbelmomenten')
    .select(VELDEN)
    .eq('status', 'open')
    .is('herinnerd_op', null)
    .eq('customers.terugbellen', true)
    .eq('customers.is_active', true)
    .is('leads.toestemming_ingetrokken_op', null)
    .gte('terug_op', new Date(nu.getTime() - EIGEN_TOT_MIN * MIN).toISOString())
    .lte('terug_op', new Date(nu.getTime() + SEINTJE_MIN * MIN).toISOString())
    .order('terug_op')
    .limit(200);
  if (nogNietAanwezig(error)) return { momenten: 0, verstuurd: 0, aanwezig: false };
  if (error) throw new Error(`terugbelmomenten: ${error.message}`);

  let momenten = 0;
  let verstuurd = 0;
  for (const m of (data ?? []) as unknown as Rij[]) {
    /* Eerst claimen, zodat twee rondes nooit hetzelfde seintje sturen. */
    const { data: geclaimd } = await supabase
      .from('lead_terugbelmomenten').update({ herinnerd_op: nu.toISOString() }).eq('id', m.id).eq('terug_op', m.terug_op).is('herinnerd_op', null).select('id');
    if (!geclaimd || geclaimd.length === 0) continue;
    momenten++;
    const { data: subs } = await supabase
      .from('push_subscriptions').select('id, endpoint, p256dh, auth, portal_user_id, apparaat').eq('customer_id', m.customer_id);
    const naar = aanmeldingenVoor(m, (subs ?? []) as (PushAanmelding & { portal_user_id: string | null; apparaat: string | null })[]);
    if (naar.length === 0) continue;
    const lead = een(m.leads);
    const wie = [lead?.naam_klant, lead?.plaatsnaam].filter(Boolean).join(' uit ') || 'Een lead';
    const r = await verstuurPush(naar, {
      title: `Terugbellen om ${nlTijd(m.terug_op)}`,
      body: m.notitie ? `${wie} · ${m.notitie}` : wie,
      url: `/portal?terugbel=${m.id}`,
      tag: `terugbellen-${m.id}`,
    });
    verstuurd += r.sent;
  }
  return { momenten, verstuurd, aanwezig: true };
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function bouwDagoverzicht(momenten: { terug_op: string; naam: string; plaats: string | null; notitie: string | null }[], nu: Date): { onderwerp: string; html: string } | null {
  const { gemist, vandaag } = groepeerMomenten(momenten, nu);
  if (gemist.length + vandaag.length === 0) return null;
  const regel = (m: (typeof momenten)[number], rood: boolean) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155">
      <strong style="color:${rood ? '#dc2626' : '#0f172a'}">${esc(momentLabel(m.terug_op, nu))}</strong> &middot; ${esc(m.naam)}${m.plaats ? ` uit ${esc(m.plaats)}` : ''}
      ${m.notitie ? `<br><span style="font-size:13px;color:#64748b">${esc(m.notitie)}</span>` : ''}
    </td></tr>`;
  const blok = (titel: string, lijst: typeof momenten, rood: boolean) =>
    lijst.length === 0 ? '' : `<p style="margin:16px 0 4px;font-size:14px;font-weight:700;color:#0f172a">${titel} (${lijst.length})</p><table width="100%" cellpadding="0" cellspacing="0" role="presentation">${lijst.map(m => regel(m, rood)).join('')}</table>`;
  const n = gemist.length + vandaag.length;
  return {
    onderwerp: `Vandaag terugbellen: ${n} ${n === 1 ? 'lead' : 'leads'}`,
    html: `<p style="margin:0;font-size:14px;color:#475569">Dit zijn je terugbelmomenten van vandaag${gemist.length ? ' en wat nog openstaat' : ''}.</p>
      ${blok('Gemist', gemist, true)}${blok('Vandaag', vandaag, false)}
      <p style="margin:20px 0 0"><a href="${EMAIL_BASE_URL}/portal" style="font-size:14px;font-weight:600;color:#3B2F75">Open het portaal</a></p>`,
  };
}

/** Is het nu 8 uur geweest (tot 8:15) in Nederland? */
export function dagoverzichtNu(nu: Date): boolean {
  const [u, m] = nu.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Amsterdam' }).split(':').map(Number);
  return u === 8 && m < 15;
}

/** Eén mail per ontvanger per dag, alleen als er iets openstaat en de klant mails van het portaal wil. */
export async function stuurDagoverzichten(supabase: SupabaseClient, nu: Date = new Date()): Promise<number> {
  const { data: klanten, error } = await supabase
    .from('customers').select('id, name, email').eq('terugbellen', true).eq('is_active', true).eq('portal_active', true).eq('email_notifications', true);
  if (nogNietAanwezig(error)) return 0;
  if (error) throw new Error(`klanten: ${error.message}`);
  const dag = amsterdamYmd(nu);
  let verstuurd = 0;
  for (const k of klanten ?? []) {
    const { data } = await supabase
      .from('lead_terugbelmomenten').select(VELDEN).eq('customer_id', k.id).eq('status', 'open').is('leads.toestemming_ingetrokken_op', null).order('terug_op').limit(1000);
    const rijen = (data ?? []) as unknown as Rij[];
    if (rijen.length === 0) continue;
    const { data: team } = await supabase.from('portal_users').select('id, name, email').eq('customer_id', k.id).eq('is_active', true);
    const perGebruiker = new Map((team ?? []).map(t => [t.id as string, t]));
    const ontvangers = new Map<string, { email: string; naam: string; rijen: Rij[] }>();
    for (const r of rijen) {
      const g = r.portal_user_id ? perGebruiker.get(r.portal_user_id) : null;
      const email = String(g?.email ?? k.email ?? '').trim().toLowerCase();
      if (!email) continue;
      const o = ontvangers.get(email) ?? { email, naam: String(g?.name ?? k.name), rijen: [] };
      o.rijen.push(r);
      ontvangers.set(email, o);
    }
    for (const o of ontvangers.values()) {
      const mail = bouwDagoverzicht(o.rijen.map(r => ({ terug_op: r.terug_op, notitie: r.notitie, naam: een(r.leads)?.naam_klant || 'Onbekend', plaats: een(r.leads)?.plaatsnaam ?? null })), nu);
      if (!mail) continue;
      const { data: al } = await supabase
        .from('email_log').select('id').eq('type', DAGOVERZICHT_TYPE).eq('to_email', o.email).neq('status', 'failed').contains('metadata', { dag }).limit(1);
      if (al && al.length > 0) continue;
      if (await sendEmail(o.email, mail.onderwerp, layout(mail.onderwerp, mail.html), { type: DAGOVERZICHT_TYPE, toName: o.naam, metadata: { dag, customer_id: k.id } })) verstuurd++;
    }
  }
  return verstuurd;
}
