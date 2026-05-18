import { formatProvinceTargetLabel } from '@/lib/provinceTargetMatch';

/** Rij uit `customer_targets` (PostgREST / admin API). */
export interface CustomerTargetRow {
  id?: string;
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  is_active?: boolean | null;
  target_type?: string | null;
  provinces?: string[] | null;
}

export function parseCustomerTargets(raw: unknown): CustomerTargetRow[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerTargetRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const provinces = Array.isArray(o.provinces)
      ? o.provinces.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : null;
    out.push({
      id: typeof o.id === 'string' ? o.id : undefined,
      label: typeof o.label === 'string' ? o.label : o.label === null ? null : undefined,
      lat: typeof o.lat === 'number' ? o.lat : o.lat === null ? null : undefined,
      lng: typeof o.lng === 'number' ? o.lng : o.lng === null ? null : undefined,
      radius_km:
        o.radius_km != null && o.radius_km !== '' && Number.isFinite(Number(o.radius_km))
          ? Number(o.radius_km)
          : null,
      is_active: typeof o.is_active === 'boolean' ? o.is_active : undefined,
      target_type: typeof o.target_type === 'string' ? o.target_type : undefined,
      provinces,
    });
  }
  return out;
}

/** Zelfde filter als `distributeLead`: alleen `is_active !== false`. */
export function activeCustomerTargets(rows: CustomerTargetRow[]): CustomerTargetRow[] {
  return rows.filter(t => t.is_active !== false);
}

/** Eén regel per gebied (badges, tooltips, live-feed). */
export function formatCustomerTargetSummary(t: CustomerTargetRow): string {
  const type = t.target_type || 'radius';
  if (type === 'province') {
    const provs = Array.isArray(t.provinces) ? t.provinces.filter(Boolean) : [];
    if (provs.length === 0) {
      return (t.label && String(t.label).trim()) || 'Provincie-target';
    }
    const lab = (t.label && String(t.label).trim()) || 'Provincies';
    const labels = provs.map(p => formatProvinceTargetLabel(p));
    if (labels.length <= 4) return `${lab}: ${labels.join(', ')}`;
    return `${lab}: ${labels.slice(0, 3).join(', ')} +${labels.length - 3}`;
  }
  const r = t.radius_km != null && Number.isFinite(Number(t.radius_km)) ? Number(t.radius_km) : 25;
  const lab = (t.label && String(t.label).trim()) ? String(t.label).trim() : 'Radius';
  if (r >= 500) return `${lab} · ${r} km (zeer breed)`;
  return `${lab} · ${r} km`;
}

export function activeTargetSummariesFromUnknown(raw: unknown): string[] {
  return activeCustomerTargets(parseCustomerTargets(raw)).map(formatCustomerTargetSummary);
}
