/**
 * Optioneel afwijkend referentiepunt voor portal straalfilters
 * (plaats via geocode, of provincie-centroid(en)).
 */
import { resolveCity } from '@/lib/pdok';

export type LatLng = { lat: number; lng: number };

/** NL + BE provincie-centra voor afstandsberekening. */
export const PROVINCE_CENTROIDS: Record<string, LatLng> = {
  // NL
  Drenthe: { lat: 52.947, lng: 6.623 },
  Flevoland: { lat: 52.518, lng: 5.471 },
  Friesland: { lat: 53.164, lng: 5.781 },
  Gelderland: { lat: 52.057, lng: 5.872 },
  Groningen: { lat: 53.219, lng: 6.566 },
  Limburg: { lat: 51.442, lng: 6.06 },
  'Noord-Brabant': { lat: 51.571, lng: 5.067 },
  'Noord-Holland': { lat: 52.389, lng: 4.854 },
  Overijssel: { lat: 52.514, lng: 6.095 },
  Utrecht: { lat: 52.09, lng: 5.121 },
  Zeeland: { lat: 51.494, lng: 3.849 },
  'Zuid-Holland': { lat: 52.02, lng: 4.65 },
  // BE
  Antwerpen: { lat: 51.221, lng: 4.4 },
  Brussels: { lat: 50.85, lng: 4.351 },
  Henegouwen: { lat: 50.454, lng: 3.952 },
  'Limburg (BE)': { lat: 50.879, lng: 5.471 },
  Luik: { lat: 50.633, lng: 5.567 },
  Luxemburg: { lat: 49.815, lng: 5.748 },
  Namen: { lat: 50.467, lng: 4.867 },
  'Oost-Vlaanderen': { lat: 51.037, lng: 3.717 },
  'Vlaams-Brabant': { lat: 50.879, lng: 4.7 },
  'Waals-Brabant': { lat: 50.67, lng: 4.611 },
  'West-Vlaanderen': { lat: 51.053, lng: 3.145 },
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function minDistanceKm(lead: LatLng, refs: LatLng[]): number | null {
  if (refs.length === 0) return null;
  let best = Infinity;
  for (const ref of refs) {
    const d = haversineKm(lead.lat, lead.lng, ref.lat, ref.lng);
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? Math.round(best * 10) / 10 : null;
}

export type DistanceOrigin = {
  refs: LatLng[];
  label: string;
  kind: 'place' | 'province';
};

/**
 * Resolve custom distance origin from place name and/or province list.
 * Place wins when both are set (specifieker).
 */
export async function resolveDistanceOrigin(input: {
  place?: string | null;
  provinces?: string[];
}): Promise<DistanceOrigin | null> {
  const place = input.place?.trim() || '';
  if (place.length >= 2) {
    const resolved = await resolveCity(place);
    if (!resolved) return null;
    return {
      refs: [{ lat: resolved.lat, lng: resolved.lng }],
      label: resolved.naam || place,
      kind: 'place',
    };
  }

  const provinces = (input.provinces || []).map((p) => p.trim()).filter(Boolean);
  if (provinces.length === 0) return null;

  const refs: LatLng[] = [];
  const labels: string[] = [];
  for (const p of provinces) {
    const c = PROVINCE_CENTROIDS[p];
    if (c) {
      refs.push(c);
      labels.push(p);
    }
  }
  if (refs.length === 0) return null;
  return {
    refs,
    label: labels.length === 1 ? labels[0] : `${labels.length} provincies`,
    kind: 'province',
  };
}

/** Overschrijft distance_km t.o.v. custom origin (null als lead geen coords heeft). */
export function applyCustomDistanceOrigin(
  leads: Record<string, unknown>[],
  origin: DistanceOrigin,
): void {
  for (const lead of leads) {
    const plat = lead.lat as number | null | undefined;
    const plng = lead.lng as number | null | undefined;
    if (plat == null || plng == null || Number.isNaN(plat) || Number.isNaN(plng)) {
      lead.distance_km = null;
      continue;
    }
    lead.distance_km = minDistanceKm({ lat: plat, lng: plng }, origin.refs);
  }
}

export type PortalRadiusTarget = {
  target_type?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  created_at?: string | null;
};

/** Vestigingspunt: actieve radius-target met kleinste straal, anders null. */
export function pickVestigingRefFromTargets(targets: PortalRadiusTarget[]): LatLng | null {
  const radius = targets.filter((t) => {
    const ty = t.target_type || 'radius';
    return ty === 'radius' && t.lat != null && t.lng != null && Number(t.radius_km ?? 0) > 0;
  });
  if (radius.length === 0) return null;
  radius.sort((a, b) => {
    const ra = Number(a.radius_km ?? 999);
    const rb = Number(b.radius_km ?? 999);
    if (ra !== rb) return ra - rb;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
  return { lat: radius[0].lat as number, lng: radius[0].lng as number };
}

/**
 * Vult `distance_km` voor portal t.o.v. vestiging (radius-target).
 * Geen provincie-centroid fallback: zonder vestiging/coords blijft afstand null
 * zodat straalfilters die leads uitsluiten i.p.v. vals te laten slagen.
 */
export function enrichPortalLeadDistances(
  leads: Record<string, unknown>[],
  activeTargets: PortalRadiusTarget[],
): void {
  const vestiging = pickVestigingRefFromTargets(activeTargets);
  for (const lead of leads) {
    const raw = lead.distance_km as number | null | undefined;
    if (raw != null && raw > 0) continue;

    const plat = lead.lat as number | null | undefined;
    const plng = lead.lng as number | null | undefined;
    if (plat == null || plng == null || Number.isNaN(plat) || Number.isNaN(plng)) {
      if (raw === 0) lead.distance_km = null;
      continue;
    }

    if (!vestiging) {
      if (raw == null || raw === 0) lead.distance_km = null;
      continue;
    }

    lead.distance_km =
      Math.round(haversineKm(plat, plng, vestiging.lat, vestiging.lng) * 10) / 10;
  }
}

export type PortalGeoFilterContext = {
  /** Plaatsnaam-filter (leeg als plaats als straal-middelpunt wordt gebruikt). */
  plaatsFilter: string;
  distanceOrigin: DistanceOrigin | null;
};

/**
 * Portal geo-context: expliciete referentie wint; anders plaats+straal → geocode als middelpunt
 * (zelfde semantiek als admin Lead CRM).
 */
export async function resolvePortalGeoFilterContext(input: {
  plaats?: string | null;
  maxDistanceKm?: number | null;
  distanceOriginPlace?: string | null;
  distanceOriginProvinces?: string[];
}): Promise<
  | { ok: true; ctx: PortalGeoFilterContext }
  | { ok: false; error: string }
> {
  const plaats = input.plaats?.trim() || '';
  const originPlace = input.distanceOriginPlace?.trim() || '';
  const originProvinces = (input.distanceOriginProvinces || []).map((p) => p.trim()).filter(Boolean);
  const maxKm = input.maxDistanceKm ?? null;

  let distanceOrigin = await resolveDistanceOrigin({
    place: originPlace,
    provinces: originProvinces,
  });
  if ((originPlace || originProvinces.length > 0) && !distanceOrigin) {
    return {
      ok: false,
      error: originPlace
        ? `Plaats “${originPlace}” niet gevonden. Probeer een andere spelling.`
        : 'Geen geldige provincie voor afstandreferentie',
    };
  }

  let plaatsFilter = plaats;
  if (plaats && maxKm != null && !distanceOrigin) {
    distanceOrigin = await resolveDistanceOrigin({ place: plaats });
    if (!distanceOrigin) {
      return {
        ok: false,
        error: `Plaats “${plaats}” niet gevonden. Probeer een andere spelling.`,
      };
    }
    plaatsFilter = '';
  }

  return { ok: true, ctx: { plaatsFilter, distanceOrigin } };
}
