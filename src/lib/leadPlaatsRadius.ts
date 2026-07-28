/**
 * Admin Lead CRM: filter leads within a radius (km) of a geocoded place name.
 * Uses PDOK/Nominatim via resolveDistanceOrigin (NL + BE).
 */
import { haversineKm, resolveDistanceOrigin, type DistanceOrigin } from '@/lib/portalDistanceOrigin';
import { parseMaxDistanceKm } from '@/lib/portalLeadGeoFilters';

export type PlaatsRadiusOrigin = {
  lat: number;
  lng: number;
  label: string;
  radiusKm: number;
};

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/** Approx bounding box for PostgREST prefilter before exact haversine. */
export function boundingBoxFromRadius(lat: number, lng: number, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const lngDelta = radiusKm / (111.32 * Math.max(cos, 0.01));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export function leadWithinRadiusKm(
  lead: { lat?: number | null; lng?: number | null },
  origin: { lat: number; lng: number },
  radiusKm: number,
): boolean {
  if (lead.lat == null || lead.lng == null) return false;
  if (!Number.isFinite(lead.lat) || !Number.isFinite(lead.lng)) return false;
  const d = haversineKm(lead.lat, lead.lng, origin.lat, origin.lng);
  return d <= radiusKm;
}

export function distanceKmToOrigin(
  lead: { lat?: number | null; lng?: number | null },
  origin: { lat: number; lng: number },
): number | null {
  if (lead.lat == null || lead.lng == null) return null;
  if (!Number.isFinite(lead.lat) || !Number.isFinite(lead.lng)) return null;
  return Math.round(haversineKm(lead.lat, lead.lng, origin.lat, origin.lng) * 10) / 10;
}

/**
 * Resolve plaats + radius into an origin. Returns null if plaats empty or radius unset.
 * Throws with a user-facing message if the place cannot be geocoded.
 */
export async function resolvePlaatsRadiusOrigin(input: {
  plaats?: string | null;
  plaats_radius_km?: string | number | null;
}): Promise<PlaatsRadiusOrigin | null> {
  const plaats = String(input.plaats || '').trim();
  const radiusKm = parseMaxDistanceKm(
    input.plaats_radius_km == null ? null : String(input.plaats_radius_km),
  );
  if (!plaats || radiusKm == null) return null;

  const origin: DistanceOrigin | null = await resolveDistanceOrigin({ place: plaats });
  if (!origin || origin.refs.length === 0) {
    throw new Error(`Plaats “${plaats}” niet gevonden. Probeer een andere spelling (NL of BE).`);
  }
  const ref = origin.refs[0]!;
  return {
    lat: ref.lat,
    lng: ref.lng,
    label: origin.label,
    radiusKm,
  };
}

export function applyBoundingBoxFilter<T extends {
  not(col: string, op: string, val: string): T;
  gte(col: string, val: unknown): T;
  lte(col: string, val: unknown): T;
}>(query: T, box: BoundingBox): T {
  let q = query.not('lat', 'is', 'null').not('lng', 'is', 'null');
  q = q.gte('lat', box.minLat).lte('lat', box.maxLat);
  q = q.gte('lng', box.minLng).lte('lng', box.maxLng);
  return q;
}

/** Soft cap on matched rows / candidates scanned for radius filter (admin CRM). */
export const PLAATS_RADIUS_MATCH_CAP = 50_000;
export const PLAATS_RADIUS_CANDIDATE_SCAN_CAP = 100_000;
export const PLAATS_RADIUS_PAGE_SIZE = 1000;

type IdLatLng = { id: string; lat: number | null; lng: number | null };

/**
 * Page through a PostgREST query that already has filters + bbox applied,
 * keep only rows within the exact haversine radius.
 */
export async function filterQueryRowsByPlaatsRadius<T extends IdLatLng>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>,
  origin: PlaatsRadiusOrigin,
  matchLimit: number = PLAATS_RADIUS_MATCH_CAP,
): Promise<{ rows: T[]; capped: boolean; error: string | null }> {
  const matched: T[] = [];
  let offset = 0;
  let scanned = 0;
  let capped = false;

  while (matched.length < matchLimit && scanned < PLAATS_RADIUS_CANDIDATE_SCAN_CAP) {
    const { data, error } = await fetchPage(offset, offset + PLAATS_RADIUS_PAGE_SIZE - 1);
    if (error) {
      return { rows: matched, capped, error: error.message || 'Leads ophalen mislukt' };
    }
    if (!data || data.length === 0) break;

    scanned += data.length;
    for (const row of data) {
      if (leadWithinRadiusKm(row, origin, origin.radiusKm)) {
        matched.push(row);
        if (matched.length >= matchLimit) {
          capped = true;
          break;
        }
      }
    }
    if (capped) break;
    if (data.length < PLAATS_RADIUS_PAGE_SIZE) break;
    offset += data.length;
  }

  if (!capped && scanned >= PLAATS_RADIUS_CANDIDATE_SCAN_CAP) {
    capped = true;
  }

  return { rows: matched, capped, error: null };
}
