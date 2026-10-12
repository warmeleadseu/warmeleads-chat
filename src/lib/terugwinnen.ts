/**
 * Klanten terugwinnen: klanten die ooit een batch betaalden maar nu niets
 * meer lopen hebben. Van de 67 klanten die ooit een leadbatch afrondden had
 * op 11 okt 2026 maar een handvol een lopende batch; 39 stonden al langer dan
 * 60 dagen stil. Dit bepaalt wie op de lijst komt en met welke gegevens.
 */

export type TwBatch = {
  id: string;
  customer_id: string;
  branch: string;
  soort: 'leads' | 'afspraken';
  batch_kind?: string | null;
  status: string;
  is_paid: boolean | null;
  batch_size: number;
  geleverd: number;
  total_price: number | null;
  price_per_unit: number | null;
  created_at: string;
  completed_at: string | null;
};

export type TwSegment = 'net_klaar' | 'stil' | 'slapend';

export type TwKlantStand = {
  customer_id: string;
  laatsteBatch: TwBatch;
  laatsteActiviteit: string;
  dagenStil: number;
  segment: TwSegment;
  betaaldeBatches: number;
  omzet: number;
  branches: string[];
  openstaandeBestelling: boolean;
};

const LOPEND = new Set(['active', 'paused']);

export function segmentVoor(dagen: number): TwSegment {
  if (dagen < 14) return 'net_klaar';
  if (dagen < 60) return 'stil';
  return 'slapend';
}

/**
 * Per klant: staat hij op de lijst, en zo ja met welke stand. Een klant komt
 * erop als hij minstens één betaalde batch had en nu geen lopende betaalde
 * batch heeft (leads of afspraken). Een bestelling die nog betaald moet
 * worden haalt hem er niet af, maar wordt wel getoond.
 *
 * `laatsteLevering` is per klant het moment van de laatst geleverde lead,
 * als die later ligt dan de afronding van de batch.
 */
export function bepaalTerugwinlijst(
  batches: TwBatch[],
  laatsteLevering: Map<string, string>,
  nu: Date = new Date(),
): TwKlantStand[] {
  const perKlant = new Map<string, TwBatch[]>();
  for (const b of batches) perKlant.set(b.customer_id, [...(perKlant.get(b.customer_id) ?? []), b]);

  const uit: TwKlantStand[] = [];
  for (const [klantId, lijst] of perKlant) {
    const betaald = lijst.filter(b => b.is_paid);
    if (betaald.length === 0) continue;
    if (betaald.some(b => LOPEND.has(b.status))) continue;

    const laatste = [...betaald].sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at))[0];
    const kandidaten = [laatste.completed_at, laatste.created_at, laatsteLevering.get(klantId)].filter((x): x is string => !!x);
    const laatsteActiviteit = kandidaten.reduce((a, b) => (new Date(b) > new Date(a) ? b : a));
    const dagenStil = Math.max(0, Math.floor((nu.getTime() - new Date(laatsteActiviteit).getTime()) / 86_400_000));

    uit.push({
      customer_id: klantId,
      laatsteBatch: laatste,
      laatsteActiviteit,
      dagenStil,
      segment: segmentVoor(dagenStil),
      betaaldeBatches: betaald.length,
      omzet: Math.round(betaald.reduce((s, b) => s + (Number(b.total_price) || 0), 0) * 100) / 100,
      branches: [...new Set(betaald.map(b => b.branch))],
      openstaandeBestelling: lijst.some(b => b.status === 'pending_payment' && new Date(b.created_at) > new Date(laatste.created_at)),
    });
  }
  return uit;
}
