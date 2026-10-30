/**
 * Najaarsactie 2026 (afgesproken 30 okt 2026): loten voor 20 gratis leads.
 *
 * - Looptijd 30 oktober t/m 13 november 2026 (Nederlandse tijd).
 * - Per nieuwe leadbatch die in die periode betaald wordt: 1 lot per volle
 *   10 leads (25 leads = 2 loten). Betaald vóór de start telt niet.
 * - Bulk: 1 lot per volle 100 bulkleads die in de periode geleverd zijn,
 *   opgeteld per klant. Bulkkopers krijgen geen mail; die informeert beheer zelf.
 * - Niet: afsprakenbatches, gratis batches, interne en demo-klanten.
 *   Gecrediteerd of niet meer betaald: de loten van die batch vervallen.
 * - Na afloop één trekking: één winnaar krijgt alle 20 leads, elk lot even zwaar.
 *
 * Alles hier is puur en te testen; laden en mailen zitten elders.
 */

export const ACTIE = {
  code: 'najaar-2026',
  naam: 'Najaarsactie: 20 gratis leads',
  /** 30 okt 2026 00:00 Nederlandse tijd (CET, UTC+1). */
  start: '2026-10-29T23:00:00.000Z',
  /** 14 nov 2026 00:00 Nederlandse tijd: alles tot en met 13 november telt. */
  eind: '2026-11-13T23:00:00.000Z',
  startLabel: '30 oktober 2026',
  eindLabel: '13 november 2026',
  prijsLeads: 20,
  leadsPerLot: 10,
  bulkPerLot: 100,
} as const;

export function lotenVoorBatch(batchSize: number): number {
  return batchSize > 0 ? Math.floor(batchSize / ACTIE.leadsPerLot) : 0;
}

export function lotenVoorBulk(bulkLeads: number): number {
  return bulkLeads > 0 ? Math.floor(bulkLeads / ACTIE.bulkPerLot) : 0;
}

export function binnenActie(moment: string | Date | null | undefined): boolean {
  if (!moment) return false;
  const t = new Date(moment).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.parse(ACTIE.start) && t < Date.parse(ACTIE.eind);
}

export type ActieFase = 'voor' | 'loopt' | 'afgelopen';
export function actieFase(nu: Date = new Date()): ActieFase {
  const t = nu.getTime();
  if (t < Date.parse(ACTIE.start)) return 'voor';
  if (t < Date.parse(ACTIE.eind)) return 'loopt';
  return 'afgelopen';
}

export type FactuurRij = {
  id: string;
  status: string;
  paid_at: string | null;
  credit_note_of: string | null;
};

/**
 * Wanneer is de batch betaald? Via de eerste betaalde factuur. Een batch
 * zonder enige factuur die als betaald is aangemaakt (bijvoorbeeld door
 * beheer) geldt als betaald op zijn aanmaakmoment. Zo telt een batch die al
 * vóór de actie betaald was nooit mee, ook al ziet de ronde hem pas later.
 */
export function betaalMoment(
  batch: { is_paid: boolean | null; created_at: string },
  facturen: FactuurRij[],
): string | null {
  if (batch.is_paid !== true) return null;
  const gewoon = facturen.filter(f => !f.credit_note_of);
  const betaald = gewoon
    .filter(f => f.status === 'paid' && f.paid_at)
    .map(f => f.paid_at as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  if (betaald.length > 0) return betaald[0];
  return gewoon.length === 0 ? batch.created_at : null;
}

/** Is een betaalde factuur van deze batch gecrediteerd? */
export function isGecrediteerd(facturen: FactuurRij[]): boolean {
  const gewoon = new Set(facturen.filter(f => !f.credit_note_of).map(f => f.id));
  return facturen.some(f => f.credit_note_of && gewoon.has(f.credit_note_of));
}

export type BatchKandidaat = {
  id: string;
  customer_id: string;
  batch_kind: string | null;
  batch_size: number | null;
  is_paid: boolean | null;
  created_at: string;
  total_price: number | string | null;
  price_per_lead: number | string | null;
  klant: { intern?: boolean | null; demo_mode?: boolean | null } | null;
};

export type Beoordeling =
  | { telt: true; loten: number; betaaldOp: string }
  | { telt: false; reden: string };

export function beoordeelBatch(b: BatchKandidaat, facturen: FactuurRij[]): Beoordeling {
  if ((b.batch_kind ?? 'leads') !== 'leads') return { telt: false, reden: 'geen leadbatch' };
  if (b.klant?.intern || b.klant?.demo_mode) return { telt: false, reden: 'interne of demo-klant' };
  if (!(Number(b.total_price) > 0 || Number(b.price_per_lead) > 0)) return { telt: false, reden: 'gratis batch' };
  const loten = lotenVoorBatch(Number(b.batch_size) || 0);
  if (loten < 1) return { telt: false, reden: 'minder dan 10 leads' };
  if (isGecrediteerd(facturen)) return { telt: false, reden: 'gecrediteerd' };
  const betaaldOp = betaalMoment(b, facturen);
  if (!betaaldOp) return { telt: false, reden: 'niet betaald' };
  if (!binnenActie(betaaldOp)) return { telt: false, reden: 'buiten de actieperiode betaald' };
  return { telt: true, loten, betaaldOp };
}

export type Deelnemer = { customer_id: string; loten: number };

/**
 * Gewogen trekking: lotnummer 0..totaal-1 wijst één deelnemer aan. De
 * volgorde staat vast (op klant-id), zodat de uitslag met het vastgelegde
 * lotnummer en de deelnemerslijst altijd na te rekenen is.
 */
export function wijsWinnaarAan(deelnemers: Deelnemer[], lotnummer: number): Deelnemer | null {
  const lijst = [...deelnemers].filter(d => d.loten > 0).sort((a, b) => a.customer_id.localeCompare(b.customer_id));
  const totaal = lijst.reduce((s, d) => s + d.loten, 0);
  if (totaal === 0 || !Number.isInteger(lotnummer) || lotnummer < 0 || lotnummer >= totaal) return null;
  let teller = lotnummer;
  for (const d of lijst) {
    if (teller < d.loten) return d;
    teller -= d.loten;
  }
  return null;
}
