import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Exclusieve en uitgesloten Meta-campagnes.
 *
 * Bij een batch kun je per gekoppelde campagne kiezen:
 * - 24u:    leads uit die campagne gaan de eerste 24 uur na binnenkomst alleen
 *           naar de batches die de campagne zo gekoppeld hebben; daarna ook
 *           naar anderen, met de gewone regels;
 * - altijd: leads uit die campagne gaan nooit naar een andere klant.
 * En campagnes die een batch nooit krijgt (uitgesloten).
 *
 * Eén plek bepaalt dit: het blok Meta-campagnes van de batch. Elke route die
 * een lead aan een batch geeft (verdeling bij binnenkomst, vangnet,
 * kwartierronde, lookback, wachtrij, Restleads) vraagt hier of het mag.
 * Leads zonder campagne vallen er nooit onder.
 */

export type ExclusiefModus = '24u' | 'altijd';
export const EXCLUSIEF_UREN = 24;

/** Batches in deze statussen houden hun exclusiviteit vast (ook als ze even vol of gepauzeerd zijn). */
const HOUDT_EXCLUSIVITEIT = ['active', 'paused', 'pending_payment'];

/** Alleen geldige keuzes voor campagnes die ook echt gekoppeld zijn. */
export function normaliseerExclusief(raw: unknown, gekoppeld: string[]): Record<string, ExclusiefModus> {
  const uit: Record<string, ExclusiefModus> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return uit;
  const set = new Set(gekoppeld);
  for (const [id, modus] of Object.entries(raw as Record<string, unknown>)) {
    if (!set.has(id)) continue;
    if (modus === '24u' || modus === 'altijd') uit[id] = modus;
  }
  return uit;
}

/** Uitgesloten campagnes: alleen cijfers, uniek, niet tegelijk gekoppeld, hooguit 50. */
export function normaliseerUitgesloten(raw: unknown, gekoppeld: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const gek = new Set(gekoppeld);
  const uit = new Set<string>();
  for (const x of raw) {
    const id = String(x ?? '').trim();
    if (/^\d{5,25}$/.test(id) && !gek.has(id)) uit.add(id);
  }
  return [...uit].slice(0, 50);
}

export type CampagneRegelBatch = {
  id: string;
  customer_id: string;
  status: string | null;
  meta_campagne_exclusief: unknown;
  meta_campagne_uitgesloten: unknown;
};

export type CampagneRegels = {
  /** Per campagne: welke batches (en klanten) hem exclusief hebben, en in welke stand. */
  exclusief: Map<string, { modus: ExclusiefModus; batchIds: Set<string>; klantIds: Set<string> }>;
  /** Per batch: campagnes die hij nooit krijgt. */
  uitgesloten: Map<string, Set<string>>;
};

export const GEEN_REGELS: CampagneRegels = { exclusief: new Map(), uitgesloten: new Map() };

export function bouwCampagneRegels(batches: CampagneRegelBatch[]): CampagneRegels {
  const exclusief: CampagneRegels['exclusief'] = new Map();
  const uitgesloten: CampagneRegels['uitgesloten'] = new Map();
  for (const b of batches) {
    if (!b.status || !HOUDT_EXCLUSIVITEIT.includes(b.status)) continue;
    const raw = b.meta_campagne_exclusief;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [id, modus] of Object.entries(raw as Record<string, unknown>)) {
        if (modus !== '24u' && modus !== 'altijd') continue;
        const r = exclusief.get(id) ?? { modus, batchIds: new Set<string>(), klantIds: new Set<string>() };
        /* Twee batches met een andere stand voor dezelfde campagne: de
           strengste wint (de API voorkomt dit tussen klanten al). */
        if (modus === 'altijd') r.modus = 'altijd';
        r.batchIds.add(b.id);
        r.klantIds.add(b.customer_id);
        exclusief.set(id, r);
      }
    }
    if (Array.isArray(b.meta_campagne_uitgesloten) && b.meta_campagne_uitgesloten.length > 0) {
      uitgesloten.set(b.id, new Set(b.meta_campagne_uitgesloten.map(String)));
    }
  }
  return { exclusief, uitgesloten };
}

export type LeadVoorCampagne = { meta_campaign_id?: string | null; created_at?: string | null };

/** Geldt er nu een exclusiviteit voor deze lead? Zo ja: voor welke batches en tot wanneer. */
export function exclusiviteitVan(
  lead: LeadVoorCampagne,
  regels: CampagneRegels,
  nu: Date = new Date(),
): { modus: ExclusiefModus; batchIds: Set<string>; klantIds: Set<string>; tot: Date | null } | null {
  const id = lead.meta_campaign_id ? String(lead.meta_campaign_id) : '';
  if (!id) return null;
  const r = regels.exclusief.get(id);
  if (!r) return null;
  if (r.modus === 'altijd') return { ...r, tot: null };
  const binnen = lead.created_at ? new Date(lead.created_at).getTime() : NaN;
  /* Zonder bekende binnenkomst: voorzichtig, als vers behandelen. */
  const tot = Number.isNaN(binnen) ? nu.getTime() + 1 : binnen + EXCLUSIEF_UREN * 3_600_000;
  if (nu.getTime() >= tot) return null;
  return { ...r, tot: new Date(tot) };
}

/** Mag deze batch deze lead krijgen, gezien de campagneregels? */
export function campagneStaatToe(
  batchId: string,
  lead: LeadVoorCampagne,
  regels: CampagneRegels,
  nu: Date = new Date(),
): boolean {
  const id = lead.meta_campaign_id ? String(lead.meta_campaign_id) : '';
  if (!id) return true;
  if (regels.uitgesloten.get(batchId)?.has(id)) return false;
  const excl = exclusiviteitVan(lead, regels, nu);
  return !excl || excl.batchIds.has(batchId);
}

/** Leesbare reden waarom een batch de lead niet mag, of null als het mag. */
export function campagneWeigering(
  batchId: string,
  lead: LeadVoorCampagne,
  regels: CampagneRegels,
  nu: Date = new Date(),
): string | null {
  const id = lead.meta_campaign_id ? String(lead.meta_campaign_id) : '';
  if (!id) return null;
  if (regels.uitgesloten.get(batchId)?.has(id)) return 'deze batch sluit de campagne van deze lead uit';
  const excl = exclusiviteitVan(lead, regels, nu);
  if (excl && !excl.batchIds.has(batchId)) {
    return excl.modus === 'altijd'
      ? 'lead uit een campagne die altijd exclusief is voor een andere batch'
      : `lead uit een campagne die tot ${excl.tot?.toISOString()} exclusief is voor een andere batch`;
  }
  return null;
}

/** De regels uit de database: alleen batches die er een hebben. */
export async function laadCampagneRegels(supabase: SupabaseClient): Promise<CampagneRegels> {
  const { data, error } = await supabase
    .from('customer_batches')
    .select('id, customer_id, status, meta_campagne_exclusief, meta_campagne_uitgesloten')
    .in('status', HOUDT_EXCLUSIVITEIT)
    .limit(5000);
  if (error) {
    /* Bij twijfel liever niets uitdelen dan een exclusieve lead weggeven:
       de aanroeper krijgt een fout en slaat deze ronde over. */
    throw new Error(`campagneregels laden mislukt: ${error.message}`);
  }
  return bouwCampagneRegels((data ?? []) as CampagneRegelBatch[]);
}

/**
 * Staat een van deze campagnes al exclusief bij een batch van een andere klant?
 * Dan is een tweede exclusieve koppeling tegenstrijdig.
 */
export async function exclusiefBijAndereKlant(
  supabase: SupabaseClient,
  campagneIds: string[],
  klantId: string,
): Promise<{ campagneId: string; klant: string } | null> {
  if (campagneIds.length === 0) return null;
  const { data, error } = await supabase
    .from('customer_batches')
    .select('id, customer_id, status, meta_campagne_exclusief, customers(name)')
    .in('status', HOUDT_EXCLUSIVITEIT)
    .neq('customer_id', klantId)
    .limit(5000);
  if (error) throw new Error(error.message);
  for (const b of data ?? []) {
    const raw = b.meta_campagne_exclusief as Record<string, unknown> | null;
    if (!raw) continue;
    for (const id of campagneIds) {
      if (raw[id] === '24u' || raw[id] === 'altijd') {
        const k = (Array.isArray(b.customers) ? b.customers[0] : b.customers) as { name?: string } | null;
        return { campagneId: id, klant: k?.name ?? 'een andere klant' };
      }
    }
  }
  return null;
}

/**
 * Bij het overnemen van een koppeling (vervolgbatch, betaling): campagnes die
 * intussen bij een andere klant exclusief staan, vallen weg in plaats van een
 * tegenstrijdige tweede exclusiviteit te maken.
 */
export async function zonderBotsingen(
  supabase: SupabaseClient,
  exclusief: Record<string, ExclusiefModus>,
  klantId: string,
): Promise<Record<string, ExclusiefModus>> {
  const uit: Record<string, ExclusiefModus> = {};
  for (const [id, modus] of Object.entries(exclusief)) {
    const botsing = await exclusiefBijAndereKlant(supabase, [id], klantId);
    if (!botsing) uit[id] = modus;
  }
  return uit;
}
