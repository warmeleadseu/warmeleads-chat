import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Eén bron van waarheid voor de advertentiekosten-boekhouding (CPL, winst).
 *
 * Afgesproken definitie (28 augustus 2026):
 *  - Alle Meta-spend telt mee vanaf 1 mei 2026, ongeacht of de campagne aan
 *    leads in de database gekoppeld is. De oude aanpak telde alleen campagnes
 *    waar minstens één lead met attributie aan hing; 73% van de leads komt
 *    zonder campagne-id binnen, waardoor tienduizenden euro's spend onzichtbaar
 *    bleven en de CPL veel te laag uitviel.
 *  - Uitgezonderd: campagnes met het losse woord "pakketadvies" of "energie"
 *    in de titel. Dat zijn geen leadcampagnes voor dit CRM.
 *  - Woordgrens is bewust: "Energie Zakelijk" valt eruit, maar
 *    "Warmtepomp | Energiekompas - Almelo" (klantnaam) telt gewoon mee.
 *
 * Alle drie de afnemers (live-stats, costs, en de SQL-functie
 * period_profit_stats in migratie 155) volgen deze definitie. Wijzig je hier
 * iets, wijzig dan ook de migratie.
 */

/** Vanaf deze datum telt de boekhouding. Eerdere spend en omzet blijven buiten beeld. */
export const META_SPEND_START_DATE = '2026-05-01';
export const META_SPEND_START_ISO = '2026-05-01T00:00:00.000Z';

const UITGESLOTEN_WOORDEN = /\b(pakketadvies|energie)\b/i;

/** Valt deze campagne buiten de boekhouding? */
export function isExcludedCampaign(campaignName: string | null | undefined): boolean {
  return UITGESLOTEN_WOORDEN.test(campaignName ?? '');
}

export type SpendRow = {
  campaign_id: string;
  campaign_name: string | null;
  date: string; // YYYY-MM-DD
  spend: string | number;
  leads_count: number | null;
};

const SPEND_PAGE = 1000;
/** Ruim boven de verwachte omvang (nu ~4.600 regels; groeit met ~2.500/kwartaal). */
const SPEND_MAX_PAGES = 200;

/**
 * Haalt ALLE spend-regels op vanaf `fromDate`, gepagineerd.
 *
 * Supabase geeft maximaal 1000 rijen per query terug, zonder foutmelding.
 * Precies die stille afkapping maakte de CPL maandenlang 60% te laag: één
 * ongepagineerde query zag 1.000 van de 2.522 regels. Vandaar hier een vaste
 * sortering (date, id) en een expliciete truncated-vlag als zelfs 200 pagina's
 * niet genoeg zouden zijn.
 */
export async function fetchSpendRowsSince(
  supabase: SupabaseClient,
  fromDate: string = META_SPEND_START_DATE,
): Promise<{ rows: SpendRow[]; truncated: boolean }> {
  const rows: SpendRow[] = [];
  let truncated = false;
  let offset = 0;
  for (let page = 0; page < SPEND_MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from('meta_ad_spend')
      .select('campaign_id, campaign_name, date, spend, leads_count')
      .gte('date', fromDate)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + SPEND_PAGE - 1);
    if (error) throw new Error(`meta_ad_spend ophalen mislukt: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as SpendRow[]));
    if (data.length < SPEND_PAGE) break;
    offset += SPEND_PAGE;
    if (page === SPEND_MAX_PAGES - 1) truncated = true;
  }
  return { rows, truncated };
}

export type SpendTotals = {
  /** Regels die meetellen (uitgesloten campagnes er al uit). */
  rows: SpendRow[];
  includedTotal: number;
  excludedTotal: number;
  /** Campagne-ids van uitgesloten campagnes; hun leads tellen ook niet mee. */
  excludedCampaignIds: string[];
};

/** Past de uitsluitingsregel toe en telt de totalen. */
export function splitSpend(all: SpendRow[]): SpendTotals {
  const rows: SpendRow[] = [];
  const excludedIds = new Set<string>();
  let includedTotal = 0;
  let excludedTotal = 0;
  for (const r of all) {
    const bedrag = typeof r.spend === 'number' ? r.spend : parseFloat(r.spend) || 0;
    if (isExcludedCampaign(r.campaign_name)) {
      excludedTotal += bedrag;
      excludedIds.add(r.campaign_id);
    } else {
      includedTotal += bedrag;
      rows.push(r);
    }
  }
  return {
    rows,
    includedTotal: afgerond(includedTotal),
    excludedTotal: afgerond(excludedTotal),
    excludedCampaignIds: [...excludedIds],
  };
}

/** Som van meetellende spend binnen [from, to], beide als YYYY-MM-DD en inclusief. */
export function sumSpendBetween(rows: SpendRow[], from: string, to: string): number {
  let som = 0;
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    som += typeof r.spend === 'number' ? r.spend : parseFloat(r.spend) || 0;
  }
  return afgerond(som);
}

/**
 * Begrens een periodestart op de boekhoudstart: een jaar- of kwartaalvenster
 * dat vóór 1 mei 2026 begint, telt pas vanaf 1 mei.
 */
export function clampToSpendStart(isoOrDate: string): string {
  const datum = isoOrDate.slice(0, 10);
  return datum < META_SPEND_START_DATE ? META_SPEND_START_DATE : datum;
}

/**
 * PostgREST-filterexpressie die leads uit uitgesloten campagnes weert maar
 * leads zonder attributie behoudt. Voor gebruik in `.or(...)`, eventueel met
 * `{ foreignTable: 'leads' }`. Geeft null terug als er niets uit te sluiten is.
 */
export function leadExclusionOrFilter(excludedCampaignIds: string[]): string | null {
  if (excludedCampaignIds.length === 0) return null;
  const lijst = excludedCampaignIds.join(',');
  return `meta_campaign_id.is.null,meta_campaign_id.not.in.(${lijst})`;
}

function afgerond(n: number): number {
  return Math.round(n * 100) / 100;
}
