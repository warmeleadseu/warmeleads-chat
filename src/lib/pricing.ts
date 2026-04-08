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

/**
 * Merge custom pricing tiers with standard branch tiers.
 *
 * Rules:
 * 1. Custom tiers override standard tiers at the same min_leads.
 * 2. Standard tiers that are MORE expensive than an applicable custom
 *    tier at a lower threshold are removed (prices should never go up
 *    as quantity increases).
 * 3. Standard tiers that are cheaper than any custom tier are kept
 *    (volume discounts below the custom price still apply).
 *
 * Example: standard [30→37.50, 50→35, 75→32.50, 100→30], custom [30→30]
 * Result: [30→30] (all standard tiers ≥ €30 at higher quantities are
 * equal or more expensive, so they add no value).
 */
export function mergeCustomTiers(
  branchTiers: PricingTier[],
  customTiers: PricingTier[],
): PricingTier[] {
  if (!customTiers || customTiers.length === 0) return [...branchTiers];
  if (!branchTiers || branchTiers.length === 0) return [...customTiers];

  const customByMin = new Map(customTiers.map(t => [t.min_leads, t]));

  const merged: PricingTier[] = [];

  for (const bt of branchTiers) {
    if (customByMin.has(bt.min_leads)) continue;
    merged.push(bt);
  }
  for (const ct of customTiers) {
    merged.push(ct);
  }

  merged.sort((a, b) => a.min_leads - b.min_leads);

  const result: PricingTier[] = [];
  let lowestPriceSeen = Infinity;

  for (const tier of merged) {
    if (tier.price_per_lead < lowestPriceSeen) {
      result.push(tier);
      lowestPriceSeen = tier.price_per_lead;
    } else if (result.length === 0) {
      result.push(tier);
      lowestPriceSeen = tier.price_per_lead;
    }
  }

  return result;
}
