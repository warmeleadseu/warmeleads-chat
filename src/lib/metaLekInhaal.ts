/**
 * Inhaalslag voor lekkende advertenties: advertenties die volgens Meta leads
 * opleveren terwijl er bij ons nooit een lead van binnenkwam, meestal omdat het
 * formulier niet aan Zapier hangt (zie metaLekken.ts voor de waarschuwingsmail).
 * De cron meta-inhaalslag haalt de leads van zulke advertenties zelf bij Meta op.
 *
 * Puur en te testen; het ophalen en inladen staat in de cron.
 */

/** Zo ver terug kijken we; oudere leads zijn het inladen niet meer waard. */
export const LEK_INHAAL_DAGEN = 21;

/** Consumentenbranches die we uit de campagnenaam herkennen ("Thuisbatterij | Klant - Plaats"). */
const BRANCHES: Record<string, string> = {
  thuisbatterij: 'thuisbatterij',
  warmtepomp: 'warmtepomp',
  zonnepanelen: 'zonnepanelen',
  laadpaal: 'laadpaal',
  airco: 'airco',
};

/** Campagnes van een ander bedrijf; tellen nergens mee (zelfde regel als metaLekken.ts). */
const ANDER_BEDRIJF = /\b(pakketadvies|energie)\b/i;

/** Branche uit de campagnenaam, of null als het geen consumentencampagne is die we kennen. */
export function brancheUitCampagne(naam: string | null | undefined): string | null {
  const n = String(naam ?? '').trim();
  if (!n || ANDER_BEDRIJF.test(n) || /partner|zakelijk|b2b/i.test(n)) return null;
  const kop = n.split('|')[0].trim().toLowerCase();
  return BRANCHES[kop] ?? null;
}

export type SpendRegel = { ad_id: string | null; campaign_id: string | null; campaign_name: string | null; leads_count: number | null };
export type LekAdvertentie = { ad_id: string; campaign_id: string | null; campaign_name: string; branch: string; metaLeads: number };

/**
 * Advertenties om zelf uit te lezen: in de periode leads volgens Meta, een
 * herkenbare branche, en nog nooit een lead bij ons met dit advertentie-id.
 * Komt er wel iets binnen (deels lek), dan blijven we eraf: de ontdubbeling
 * vangt dat niet altijd en dubbele leads zijn erger dan een gemiste.
 */
export function lekAdvertenties(spend: SpendRegel[], binnenPerAd: ReadonlyMap<string, number>): LekAdvertentie[] {
  const perAd = new Map<string, LekAdvertentie>();
  for (const r of spend) {
    if (!r.ad_id) continue;
    const branch = brancheUitCampagne(r.campaign_name);
    if (!branch) continue;
    const a = perAd.get(r.ad_id) ?? { ad_id: r.ad_id, campaign_id: r.campaign_id, campaign_name: r.campaign_name ?? '', branch, metaLeads: 0 };
    a.metaLeads += Number(r.leads_count) || 0;
    perAd.set(r.ad_id, a);
  }
  return [...perAd.values()]
    .filter(a => a.metaLeads > 0 && (binnenPerAd.get(a.ad_id) ?? 0) === 0)
    .sort((a, b) => b.metaLeads - a.metaLeads);
}

/** Velden die we zelf vullen; de rest van het formulier gaat als antwoord in custom_fields, zoals bij Zapier. */
const NAW = /^(full_name|name|first_name|last_name|email|phone_number|phone|telefoon.*|post_?code|zip_code|huisnummer|street_address|city|plaats.*)$/i;

/** Antwoorden uit het Meta-formulier, met de vaste vertaling waar we die hebben. */
export function antwoordenUitFormulier(
  velden: { name: string; values?: string[] }[] | undefined,
  vertaling: Record<string, string> = {},
): Record<string, string> {
  const uit: Record<string, string> = {};
  for (const f of velden ?? []) {
    const v = f.values?.[0];
    if (!v || NAW.test(f.name)) continue;
    uit[vertaling[f.name] ?? f.name] = String(v);
  }
  return uit;
}
