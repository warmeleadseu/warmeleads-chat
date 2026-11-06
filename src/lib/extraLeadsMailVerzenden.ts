import type { SupabaseClient } from '@supabase/supabase-js';
import { ALLOWED_FROM_DOMAIN, dispatchEmail } from './email';
import { buildUnsubscribeUrl, generateUnsubscribeToken } from './email/sendAsAdmin';
import { laadAanbod } from './losseLeads';
import { LOSSE_LEADS_BRANCHES } from './losseLeadsRegels';
import {
  INTRO_TYPE, MAANDAG_TYPE, SCHAKELAAR_KEY, TEMPLATE_KEY, TEST_ADRES, TEST_TYPE,
  bouwIntroMail, bouwMaandagMail, maandagVan, regioVan, voornaamVan, type MailInhoud, type MailLead,
} from './extraLeadsMail';

/**
 * Versturen van de Extra leads-mails (inhoud in extraLeadsMail.ts).
 *
 * Ontvangers: klanten die ooit in het portaal hebben ingelogd, zonder interne
 * klanten, demo-accounts en adressen die zich voor marketingmail hebben
 * afgemeld. Niemand krijgt de introductie twee keer, of twee keer dezelfde
 * maandagmail: dat checken we in email_log, zodat opnieuw starten veilig is.
 */

/** Geen koper: het aanbod zoals iedere klant het ziet. */
const GEEN_KOPER = '00000000-0000-0000-0000-000000000000';
/** Resend staat 2 verzoeken per seconde toe. */
const PAUZE_MS = 600;
const REGIO_DAGEN = 90;

export type Ontvanger = {
  id: string;
  naam: string;
  email: string;
  voornaam: string;
  branches: Set<string>;
  regios: string[];
};

export type Soort = 'intro' | 'maandag';

const pauze = (ms: number) => new Promise(r => setTimeout(r, ms));

/** "thuisbatterij_partners" en "zonnepaneel_partners" horen bij de gewone branche. */
export function losseLeadBrancheVan(slug: string): string | null {
  const basis = slug.replace(/_partners$/, '').replace(/^zonnepaneel$/, 'zonnepanelen');
  return (LOSSE_LEADS_BRANCHES as readonly string[]).includes(basis) ? basis : null;
}

export async function isMaandagmailAan(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', SCHAKELAAR_KEY).maybeSingle();
  return String(data?.value ?? '').toLowerCase() === 'true';
}

export async function zetMaandagmail(supabase: SupabaseClient, aan: boolean): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key: SCHAKELAAR_KEY, value: aan ? 'true' : 'false' }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export async function laadMailAanbod(supabase: SupabaseClient): Promise<{ leads: MailLead[]; brancheNaam: (slug: string) => string }> {
  const [aanbod, { data: br }] = await Promise.all([
    laadAanbod(supabase, GEEN_KOPER),
    supabase.from('branches').select('slug, name').in('slug', [...LOSSE_LEADS_BRANCHES]),
  ]);
  const namen = new Map((br ?? []).map(b => [b.slug as string, b.name as string]));
  return { leads: aanbod, brancheNaam: slug => namen.get(slug) ?? slug };
}

export async function laadOntvangers(supabase: SupabaseClient): Promise<Ontvanger[]> {
  const [{ data: klanten, error }, { data: users }] = await Promise.all([
    supabase.from('customers').select('id, name, email, contact_person, branches, intern, demo_mode, last_login_at, login_count'),
    supabase.from('portal_users').select('customer_id, last_login_at, login_count'),
  ]);
  if (error) throw new Error(`Klanten laden mislukt: ${error.message}`);
  const viaPortaalUser = new Set((users ?? []).filter(u => u.last_login_at || Number(u.login_count) > 0).map(u => u.customer_id as string));
  const basis = (klanten ?? []).filter(k =>
    !k.intern && !k.demo_mode && typeof k.email === 'string' && k.email.includes('@')
    && (k.last_login_at || Number(k.login_count) > 0 || viaPortaalUser.has(k.id as string)));

  const { data: afgemeld } = await supabase.from('email_optouts').select('email').in('scope', ['all', 'marketing']);
  const uit = new Set((afgemeld ?? []).map(a => String(a.email).toLowerCase()));
  const ids = basis.map(k => k.id as string);

  /* Branches: van de klantkaart en uit alle batches. */
  const branches = new Map<string, Set<string>>();
  const voegToe = (id: string, slug: unknown) => {
    const b = typeof slug === 'string' ? losseLeadBrancheVan(slug) : null;
    if (!b) return;
    if (!branches.has(id)) branches.set(id, new Set());
    branches.get(id)!.add(b);
  };
  for (const k of basis) for (const b of (k.branches as string[] | null) ?? []) voegToe(k.id as string, b);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('customer_batches').select('customer_id, branch').in('customer_id', ids.slice(i, i + 200));
    for (const r of data ?? []) voegToe(r.customer_id as string, r.branch);
  }

  /* Regio's: waar de klant de laatste 90 dagen zelf leads kreeg, meeste eerst. */
  const telling = new Map<string, Map<string, number>>();
  const sinds = new Date(Date.now() - REGIO_DAGEN * 86_400_000).toISOString();
  for (let i = 0; i < ids.length; i += 100) {
    for (let p = 0; p < 20; p++) {
      const { data } = await supabase
        .from('lead_assignments')
        .select('customer_id, leads!inner(provincie, land)')
        .in('customer_id', ids.slice(i, i + 100))
        .gte('assigned_at', sinds)
        .or('source.is.null,source.neq.mirror')
        .range(p * 1000, p * 1000 + 999);
      for (const r of data ?? []) {
        const l = (Array.isArray(r.leads) ? r.leads[0] : r.leads) as { provincie: string | null; land: string | null } | null;
        if (!l || (!l.provincie && l.land !== 'BE')) continue;
        const regio = regioVan(l);
        const m = telling.get(r.customer_id as string) ?? new Map<string, number>();
        m.set(regio, (m.get(regio) ?? 0) + 1);
        telling.set(r.customer_id as string, m);
      }
      if (!data || data.length < 1000) break;
    }
  }

  const gezien = new Set<string>();
  const ontvangers: Ontvanger[] = [];
  for (const k of basis) {
    const email = String(k.email).trim().toLowerCase();
    if (uit.has(email) || gezien.has(email)) continue;
    gezien.add(email);
    ontvangers.push({
      id: k.id as string,
      naam: (k.name as string) || email,
      email,
      voornaam: voornaamVan(k.contact_person as string | null),
      branches: branches.get(k.id as string) ?? new Set(),
      regios: [...(telling.get(k.id as string) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r),
    });
  }
  return ontvangers.sort((a, b) => a.naam.localeCompare(b.naam));
}

/** De mail voor één ontvanger; null als er voor hem niets te koop staat. */
export function bouwVoor(
  soort: Soort,
  o: Pick<Ontvanger, 'voornaam' | 'branches' | 'regios'>,
  aanbod: { leads: MailLead[]; brancheNaam: (slug: string) => string },
  afmeldUrl: string,
): MailInhoud | null {
  return soort === 'intro'
    ? bouwIntroMail({ leads: aanbod.leads, brancheNaam: aanbod.brancheNaam, voornaam: o.voornaam, afmeldUrl })
    : bouwMaandagMail({ leads: aanbod.leads, brancheNaam: aanbod.brancheNaam, voornaam: o.voornaam, afmeldUrl, eigenBranches: o.branches, eigenRegios: o.regios });
}

async function stuur(to: string, inhoud: MailInhoud, opts: { type: string; toName: string; customerId: string | null; metadata: Record<string, unknown>; token: string }) {
  const url = buildUnsubscribeUrl(opts.token);
  return dispatchEmail(to, inhoud.onderwerp, inhoud.html, {
    type: opts.type,
    toName: opts.toName,
    customerId: opts.customerId,
    templateKey: TEMPLATE_KEY,
    metadata: opts.metadata,
    unsubscribeToken: opts.token,
    headers: {
      'List-Unsubscribe': `<${url}>, <mailto:unsubscribe@${ALLOWED_FROM_DOMAIN}?subject=unsubscribe%20${encodeURIComponent(opts.token)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

/** Testmail naar info@: de introductie, of de maandagmail zoals deze klant hem krijgt. */
export async function stuurTest(supabase: SupabaseClient, soort: Soort, klantId?: string | null): Promise<{ ok: boolean; error?: string; onderwerp?: string }> {
  const aanbod = await laadMailAanbod(supabase);
  let o: Pick<Ontvanger, 'voornaam' | 'branches' | 'regios'> & { naam?: string } = { voornaam: 'Jan', branches: new Set(LOSSE_LEADS_BRANCHES), regios: [] };
  if (klantId) {
    const k = (await laadOntvangers(supabase)).find(x => x.id === klantId);
    if (!k) return { ok: false, error: 'Deze klant krijgt de mail niet (geen portaal, demo, intern of afgemeld)' };
    o = k;
  }
  const token = generateUnsubscribeToken();
  const inhoud = bouwVoor(soort, o, aanbod, buildUnsubscribeUrl(token));
  if (!inhoud) return { ok: false, error: 'Er staat voor deze klant nu niets te koop, dus er is geen mail' };
  const r = await stuur(TEST_ADRES, { ...inhoud, onderwerp: `[TEST] ${inhoud.onderwerp}` }, {
    type: TEST_TYPE, toName: 'WarmeLeads', customerId: null, metadata: { soort, voorbeeld_klant: klantId ?? null }, token,
  });
  return { ok: r.ok, error: r.error, onderwerp: inhoud.onderwerp };
}

export type Verzending = {
  soort: Soort;
  week: string | null;
  ontvangers: number;
  verstuurd: number;
  alGehad: number;
  geenAanbod: number;
  mislukt: { email: string; fout: string }[];
  /** Gestopt om binnen de tijdslimiet te blijven; opnieuw starten gaat verder. */
  onderbroken: boolean;
};

/** Wie deze mail al kreeg (introductie: ooit; maandag: deze week). */
async function alVerstuurd(supabase: SupabaseClient, soort: Soort, week: string): Promise<Set<string>> {
  const gehad = new Set<string>();
  for (let p = 0; p < 20; p++) {
    let q = supabase.from('email_log').select('to_email').eq('type', soort === 'intro' ? INTRO_TYPE : MAANDAG_TYPE).neq('status', 'failed');
    if (soort === 'maandag') q = q.contains('metadata', { week });
    const { data } = await q.range(p * 1000, p * 1000 + 999);
    for (const r of data ?? []) gehad.add(String(r.to_email).toLowerCase());
    if (!data || data.length < 1000) break;
  }
  return gehad;
}

export async function verstuurAanIedereen(
  supabase: SupabaseClient,
  soort: Soort,
  opts: { nu?: Date; deadlineMs?: number } = {},
): Promise<Verzending> {
  const start = Date.now();
  const week = maandagVan(opts.nu);
  const [aanbod, ontvangers] = await Promise.all([laadMailAanbod(supabase), laadOntvangers(supabase)]);
  const gehad = await alVerstuurd(supabase, soort, week);
  const res: Verzending = { soort, week: soort === 'maandag' ? week : null, ontvangers: ontvangers.length, verstuurd: 0, alGehad: 0, geenAanbod: 0, mislukt: [], onderbroken: false };

  for (const o of ontvangers) {
    if (gehad.has(o.email)) { res.alGehad++; continue; }
    if (opts.deadlineMs && Date.now() - start > opts.deadlineMs) { res.onderbroken = true; break; }
    const token = generateUnsubscribeToken();
    const inhoud = bouwVoor(soort, o, aanbod, buildUnsubscribeUrl(token));
    if (!inhoud) { res.geenAanbod++; continue; }
    const r = await stuur(o.email, inhoud, {
      type: soort === 'intro' ? INTRO_TYPE : MAANDAG_TYPE,
      toName: o.naam,
      customerId: o.id,
      metadata: { week, aanbod: inhoud.aantal },
      token,
    });
    if (r.ok) res.verstuurd++;
    else res.mislukt.push({ email: o.email, fout: r.error ?? 'onbekend' });
    await pauze(PAUZE_MS);
  }
  return res;
}
