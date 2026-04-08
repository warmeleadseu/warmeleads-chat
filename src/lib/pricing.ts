export interface PricingTier {
  min_leads: number;
  price_per_lead: number;
}

export interface PricingResult {
  price_per_lead: number;
  tier: PricingTier;
  nationwide_discount_applied: number;
  is_custom: boolean;
}

/**
 * Determine the applicable price per lead based on tiered pricing.
 * Returns null if batchSize is below the lowest tier (under minimum).
 */
export function calculatePricePerLead(
  tiers: PricingTier[],
  batchSize: number,
  options?: {
    nationwideDiscount?: number;
    isNationwide?: boolean;
    isCustom?: boolean;
  },
): PricingResult | null {
  if (!tiers || tiers.length === 0) return null;

  const sorted = [...tiers].sort((a, b) => b.min_leads - a.min_leads);
  const tier = sorted.find(t => batchSize >= t.min_leads);
  if (!tier) return null;

  const discount =
    options?.isNationwide && options?.nationwideDiscount
      ? options.nationwideDiscount
      : 0;

  return {
    price_per_lead: Math.max(0, tier.price_per_lead - discount),
    tier,
    nationwide_discount_applied: discount,
    is_custom: options?.isCustom ?? false,
  };
}

/**
 * Get the minimum batch size from tiers (lowest min_leads value).
 */
export function getMinBatchSize(tiers: PricingTier[]): number {
  if (!tiers || tiers.length === 0) return 10;
  return Math.min(...tiers.map(t => t.min_leads));
}

/**
 * Sort tiers ascending by min_leads for display purposes.
 */
export function sortTiersAscending(tiers: PricingTier[]): PricingTier[] {
  return [...tiers].sort((a, b) => a.min_leads - b.min_leads);
}
