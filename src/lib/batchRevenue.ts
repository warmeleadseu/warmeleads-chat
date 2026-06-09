/**
 * Bepaalt de omzet die hoort bij een (deel van een) batch in de admin/costs-flow.
 *
 * Reguliere lead-batches worden per geleverde lead afgerekend (`price_per_lead`),
 * dus de omzet schaalt met het aantal toegewezen leads in de periode.
 *
 * Niche-onderzoeksbatches worden EENMALIG afgerekend (`total_price` is het
 * vaste pakkettarief). Elke extra geleverde lead voegt geen extra omzet toe;
 * de klant heeft het pakket al betaald bij bestelling. Vóór deze helper telde
 * `/api/admin/costs` per ingeladen niche-lead nogmaals €1.000 omzet bij,
 * waardoor totals dramatisch werden overschat.
 */
export type BatchRevenueInput = {
  batch_kind?: string | null;
  price_per_lead?: number | string | null;
  total_price?: number | string | null;
};

export function batchRevenueForCosts(
  batch: BatchRevenueInput,
  deliveredInPeriod: number,
): number {
  if (deliveredInPeriod <= 0) return 0;
  if (batch.batch_kind === 'niche_research') {
    const total = Number(batch.total_price);
    return Number.isFinite(total) ? total : 0;
  }
  const ppl = Number(batch.price_per_lead);
  if (!Number.isFinite(ppl) || ppl <= 0) return 0;
  return ppl * deliveredInPeriod;
}
