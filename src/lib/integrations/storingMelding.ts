import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, EMAIL_BASE_URL } from '@/lib/email';
import { partnerOpProvider } from './partners/registry';

/**
 * Mail naar de beheerder zodra een koppeling een dag lang niets meer aflevert.
 *
 * Aanleiding: de Teamleader-koppeling van Energiekompas viel op 3 september
 * uit (het token kon niet meer worden vernieuwd). Een maand lang kwam er geen
 * enkele lead meer in hun Teamleader, en niemand merkte het. De fouten stonden
 * wel in de synclog, maar daar kijkt niemand dagelijks in.
 *
 * Een storing is: er zijn mislukte leveringen sinds de laatste geslaagde, en
 * de oudste daarvan is minstens een dag oud. Eén afgewezen lead tussen
 * geslaagde leveringen door (zoals een adres dat de klant niet accepteert) is
 * dus geen storing. Per koppeling hooguit één mail per dag.
 */

export const STORING_NA_UREN = 24;
const MAIL_TYPE = 'integratie_storing';
const BEHEER_ADRES = 'info@warmeleads.eu';

export type FoutRij = {
  customer_id: string;
  provider: string;
  created_at: string;
  updated_at: string | null;
  error_message: string | null;
};

export type Storing = {
  sleutel: string;
  customer_id: string;
  provider: string;
  aantal: number;
  sinds: string;
  laatsteFout: string | null;
  laatsteSucces: string | null;
};

export const storingSleutel = (customerId: string, provider: string) => `${customerId}:${provider}`;

/** Puur: welke koppelingen zijn nu in storing. */
export function bepaalStoringen(
  fouten: FoutRij[],
  laatsteSucces: Map<string, string | null>,
  nu: Date = new Date(),
): Storing[] {
  const perKoppeling = new Map<string, FoutRij[]>();
  for (const f of fouten) {
    const k = storingSleutel(f.customer_id, f.provider);
    const succes = laatsteSucces.get(k);
    /* Mislukt vóór de laatste geslaagde levering: de koppeling werkte daarna
       weer, dus dit hoort niet bij een storing. */
    if (succes && new Date(f.created_at) <= new Date(succes)) continue;
    perKoppeling.set(k, [...(perKoppeling.get(k) ?? []), f]);
  }

  const uit: Storing[] = [];
  for (const [sleutel, rijen] of perKoppeling) {
    const t = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
    const sinds = rijen.reduce((a, r) => (t(r.created_at) < t(a) ? r.created_at : a), rijen[0].created_at);
    if (nu.getTime() - new Date(sinds).getTime() < STORING_NA_UREN * 3_600_000) continue;
    const recentst = rijen.reduce((a, r) => (t(r.updated_at ?? r.created_at) > t(a.updated_at ?? a.created_at) ? r : a), rijen[0]);
    uit.push({
      sleutel,
      customer_id: rijen[0].customer_id,
      provider: rijen[0].provider,
      aantal: rijen.length,
      sinds,
      laatsteFout: recentst.error_message,
      laatsteSucces: laatsteSucces.get(sleutel) ?? null,
    });
  }
  return uit.sort((a, b) => b.aantal - a.aantal);
}

export function providerLabel(provider: string): string {
  if (provider === 'teamleader') return 'Teamleader';
  if (provider === 'google_sheets') return 'Google Sheets';
  if (provider === 'outbound_webhook') return 'Webhook (API-koppeling)';
  return partnerOpProvider(provider)?.naam ?? provider;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function datum(iso: string | null): string {
  if (!iso) return 'nooit (sinds de laatste 30 dagen)';
  return new Date(iso).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

export function bouwStoringMail(storingen: (Storing & { klant: string })[]): { onderwerp: string; html: string } {
  const totaal = storingen.reduce((n, s) => n + s.aantal, 0);
  const leads = `${totaal} ${totaal === 1 ? 'lead' : 'leads'}`;
  const onderwerp = storingen.length === 1
    ? `[STORING] ${providerLabel(storingen[0].provider)} van ${storingen[0].klant} levert al een dag niets af (${leads})`
    : `[STORING] ${storingen.length} koppelingen leveren al een dag niets af (${leads})`;

  const blokken = storingen.map(s => `
    <tr><td style="padding:14px 16px;border:1px solid #fecaca;border-radius:10px;background:#fef2f2">
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a">${esc(s.klant)} &middot; ${esc(providerLabel(s.provider))}</p>
      <p style="margin:0 0 2px;font-size:13px;color:#334155"><strong>${s.aantal}</strong> ${s.aantal === 1 ? 'lead kwam' : 'leads kwamen'} niet aan, sinds ${esc(datum(s.sinds))}.</p>
      <p style="margin:0 0 2px;font-size:13px;color:#334155">Laatste geslaagde levering: ${esc(datum(s.laatsteSucces))}.</p>
      ${s.laatsteFout ? `<p style="margin:6px 0 0;font-size:12px;color:#b91c1c">Laatste fout: ${esc(s.laatsteFout.slice(0, 300))}</p>` : ''}
      <p style="margin:8px 0 0;font-size:13px"><a href="${EMAIL_BASE_URL}/admin/customers?open=${s.customer_id}" style="color:#3B2F75;font-weight:600">Klant openen</a></p>
    </td></tr>
    <tr><td style="height:10px"></td></tr>`).join('');

  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:24px 12px">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
      <tr><td style="padding:24px 24px 8px">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a">Een koppeling levert geen leads meer af</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#475569">
          Bij de koppeling${storingen.length === 1 ? '' : 'en'} hieronder is al minstens een dag geen enkele lead meer aangekomen.
          De klant ziet deze leads dus niet in zijn eigen systeem. In het portaal staan ze wel.
          Meestal moet de klant de koppeling opnieuw verbinden (bijvoorbeeld opnieuw inloggen bij Teamleader).
          Werkt hij weer, dan sturen we de gemiste leads van de afgelopen 72 uur vanzelf na; oudere leads kunnen we op verzoek nasturen.
        </p>
      </td></tr>
      <tr><td style="padding:0 24px 16px"><table width="100%" cellpadding="0" cellspacing="0" role="presentation">${blokken}</table></td></tr>
      <tr><td style="padding:0 24px 24px;font-size:12px;color:#94a3b8">Je krijgt deze melding hooguit één keer per dag per koppeling, zolang de storing duurt.</td></tr>
    </table>
  </td></tr></table></body></html>`;

  return { onderwerp, html };
}

/**
 * Kijkt naar de synclog van de afgelopen 30 dagen en mailt over koppelingen
 * die in storing zijn en vandaag nog niet gemeld zijn.
 */
export async function meldIntegratieStoringen(
  supabase: SupabaseClient,
  nu: Date = new Date(),
): Promise<{ inStoring: number; gemeld: number }> {
  const vanaf = new Date(nu.getTime() - 30 * 24 * 3_600_000).toISOString();
  const fouten: FoutRij[] = [];
  for (let p = 0; p < 10; p++) {
    const { data } = await supabase
      .from('integration_sync_log')
      .select('customer_id, provider, created_at, updated_at, error_message')
      .eq('status', 'failed')
      .gte('created_at', vanaf)
      .order('created_at', { ascending: true })
      .range(p * 1000, p * 1000 + 999);
    if (!data?.length) break;
    fouten.push(...(data as FoutRij[]));
    if (data.length < 1000) break;
  }
  if (fouten.length === 0) return { inStoring: 0, gemeld: 0 };

  const laatsteSucces = new Map<string, string | null>();
  for (const k of new Set(fouten.map(f => storingSleutel(f.customer_id, f.provider)))) {
    const [customerId, provider] = k.split(':');
    const { data } = await supabase
      .from('integration_sync_log')
      .select('updated_at, created_at')
      .eq('customer_id', customerId)
      .eq('provider', provider)
      .eq('status', 'success')
      .order('updated_at', { ascending: false })
      .limit(1);
    const r = data?.[0] as { updated_at: string | null; created_at: string } | undefined;
    laatsteSucces.set(k, r ? (r.updated_at ?? r.created_at) : null);
  }

  const storingen = bepaalStoringen(fouten, laatsteSucces, nu);
  if (storingen.length === 0) return { inStoring: 0, gemeld: 0 };

  /* Wat de afgelopen dag al gemeld is, niet nog eens. */
  const { data: recenteMails } = await supabase
    .from('email_log')
    .select('metadata')
    .eq('type', MAIL_TYPE)
    .neq('status', 'failed')
    .gte('created_at', new Date(nu.getTime() - 24 * 3_600_000).toISOString());
  const alGemeld = new Set<string>();
  for (const m of recenteMails || []) {
    const sleutels = (m.metadata as { sleutels?: unknown } | null)?.sleutels;
    if (Array.isArray(sleutels)) for (const s of sleutels) alGemeld.add(String(s));
  }
  if (storingen.every(s => alGemeld.has(s.sleutel))) return { inStoring: storingen.length, gemeld: 0 };

  /* Is er iets nieuws te melden, dan in dezelfde mail ook de lopende
     storingen: één compleet overzicht. */
  const { data: klanten } = await supabase
    .from('customers')
    .select('id, name')
    .in('id', [...new Set(storingen.map(s => s.customer_id))]);
  const naam = new Map((klanten || []).map(k => [k.id as string, (k.name as string) || 'Onbekende klant']));
  const metNaam = storingen.map(s => ({ ...s, klant: naam.get(s.customer_id) ?? 'Onbekende klant' }));

  const { onderwerp, html } = bouwStoringMail(metNaam);
  const ok = await sendEmail(BEHEER_ADRES, onderwerp, html, {
    type: MAIL_TYPE,
    metadata: { sleutels: storingen.map(s => s.sleutel), leads: storingen.reduce((n, s) => n + s.aantal, 0) },
  });
  return { inStoring: storingen.length, gemeld: ok ? storingen.filter(s => !alGemeld.has(s.sleutel)).length : 0 };
}
