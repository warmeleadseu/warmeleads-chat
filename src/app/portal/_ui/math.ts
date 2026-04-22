export interface PricingTier {
  min_leads: number;
  price_per_lead: number;
}

/**
 * Return a sensible set of 3-4 quick preset sizes gegeven een minimum batch size.
 * Gebruikt door zowel leads- als afspraken-bestelflow.
 */
export function computeQuickSizes(minBatchSize: number, defaults: number[] = [50, 100, 200, 500]): number[] {
  const filtered = defaults.filter(s => s >= minBatchSize);
  if (filtered.length === 0) return [minBatchSize];
  if (!filtered.includes(minBatchSize) && minBatchSize < filtered[0]) filtered.unshift(minBatchSize);
  return filtered.slice(0, 4);
}

/**
 * Bereken preset snelheden gebaseerd op target doorlooptijden.
 */
export function computeSpeedPresets(effectiveSize: number, targetDays: number[] = [30, 14, 7]): number[] {
  if (effectiveSize <= 0) return [5, 10, 20];
  const presets: number[] = [];
  for (const days of targetDays) {
    const perDay = Math.ceil(effectiveSize / days);
    if (perDay >= 1 && !presets.includes(perDay)) presets.push(perDay);
  }
  if (presets.length < 3) {
    for (const fallback of [5, 10, 20]) {
      if (!presets.includes(fallback)) presets.push(fallback);
      if (presets.length >= 3) break;
    }
  }
  return presets.sort((a, b) => a - b).slice(0, 3);
}

/**
 * Vind de best-passende staffel voor de gegeven hoeveelheid.
 */
export function findTierPrice(tiers: PricingTier[] | null | undefined, size: number, fallback = 0): number {
  if (!tiers || tiers.length === 0) return fallback;
  const sorted = [...tiers].sort((a, b) => b.min_leads - a.min_leads);
  const tier = sorted.find(t => size >= t.min_leads);
  return tier ? tier.price_per_lead : fallback;
}

/**
 * Is dit de actieve staffel voor de gegeven hoeveelheid?
 */
export function isActiveTier(tiers: PricingTier[], index: number, size: number): boolean {
  const sorted = [...tiers].sort((a, b) => a.min_leads - b.min_leads);
  const current = sorted[index];
  if (!current) return false;
  if (size < current.min_leads) return false;
  const next = sorted[index + 1];
  if (!next) return true;
  return size < next.min_leads;
}
