import { resolveLeadLandForProvinceMatch } from './provinceTargetMatch';

/**
 * Land-restrictie voor één `customer_targets`-rij.
 *
 * Semantiek (afgesproken in migratie 136):
 *   target.country = NULL  → geen restrictie (geometrie/provincies bepalen)
 *   target.country = 'NL'  → alleen leads waarvan land = NL (postcode-fallback)
 *   target.country = 'BE'  → alleen leads waarvan land = BE (postcode-fallback)
 *
 * Wordt gebruikt door zowel pipeline-distributie (`distribution.ts`) als
 * niche-research distributie (`nicheResearchDistribution.ts`) om te
 * voorkomen dat bv. een NL-klant met "Heel Nederland" 200km radius
 * (cirkel raakt noord-België) toch BE-leads krijgt.
 */
export function targetCountryAllowsLead(
  target: { country?: string | null },
  lead: { land?: string | null; postcode?: string | null },
): boolean {
  const required = (target.country || '').toUpperCase();
  if (required !== 'NL' && required !== 'BE') return true;
  const leadLand = resolveLeadLandForProvinceMatch(lead);
  if (!leadLand) return false;
  return leadLand === required;
}
