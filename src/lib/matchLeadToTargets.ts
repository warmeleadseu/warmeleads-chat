import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';
import { targetCountryAllowsLead } from './targetCountryMatch';
import type { GeoTargetRow } from './batchTargets';

export type LeadForTargetMatch = {
  lat?: number | null;
  lng?: number | null;
  provincie?: string | null;
  land?: string | null;
  postcode?: string | null;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type TargetMatchResult = {
  matches: boolean;
  distance_km: number | null;
  matched_target_type: 'radius' | 'province' | null;
};

/**
 * Checks whether a lead falls within any of the customer's active targets.
 * Shared by automatic distribution and manual-assignment guardrails.
 */
export function matchLeadToTargets(
  lead: LeadForTargetMatch,
  targets: GeoTargetRow[],
): TargetMatchResult {
  if (!targets.length) {
    return { matches: false, distance_km: null, matched_target_type: null };
  }

  const hasCoords =
    lead.lat != null &&
    lead.lng != null &&
    !Number.isNaN(lead.lat) &&
    !Number.isNaN(lead.lng);

  let bestDistance: number | null = null;
  let matchedType: 'radius' | 'province' | null = null;

  for (const t of targets) {
    if (!targetCountryAllowsLead(t as { country?: string | null }, lead)) continue;

    if ((t.target_type || 'radius') === 'province') {
      const provs: string[] = Array.isArray(t.provinces) ? t.provinces : [];
      if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) {
        return { matches: true, distance_km: 0, matched_target_type: 'province' };
      }
    } else if (hasCoords && t.lat != null && t.lng != null && t.radius_km != null) {
      const dist = haversineKm(lead.lat!, lead.lng!, t.lat, t.lng);
      if (dist <= t.radius_km) {
        const rounded = Math.round(dist * 10) / 10;
        if (bestDistance == null || rounded < bestDistance) {
          bestDistance = rounded;
          matchedType = 'radius';
        }
      }
    }
  }

  if (matchedType) {
    return { matches: true, distance_km: bestDistance, matched_target_type: matchedType };
  }
  return { matches: false, distance_km: null, matched_target_type: null };
}
