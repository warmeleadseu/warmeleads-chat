/**
 * Helpers voor geo-/gebiedfilters op portal leads.
 */

export type PostcodeAreaFilter =
  | { kind: 'prefix'; prefix: string }
  | { kind: 'range'; from: number; to: number };

/**
 * Parse gebruikersinvoer voor postcodegebied:
 * - `75` / `7500` → prefix
 * - `7500-7599` → numerieke range op de eerste 4 cijfers
 */
export function parsePostcodeArea(raw: string | null | undefined): PostcodeAreaFilter | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/\*/g, '');
  if (!s) return null;

  const range = s.match(/^(\d{2,4})-(\d{2,4})$/);
  if (range) {
    const from = parseInt(range[1].padEnd(4, '0'), 10);
    const to = parseInt(range[2].padEnd(4, '9'), 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) return null;
    return { kind: 'range', from, to };
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length >= 2 && digits.length <= 4) {
    return { kind: 'prefix', prefix: digits };
  }
  return null;
}

export function leadPostcodeDigits(postcode: unknown): string | null {
  if (typeof postcode !== 'string') return null;
  const digits = postcode.replace(/\D/g, '');
  return digits.length >= 2 ? digits : null;
}

export function matchesPostcodeArea(
  postcode: unknown,
  filter: PostcodeAreaFilter | null,
): boolean {
  if (!filter) return true;
  const digits = leadPostcodeDigits(postcode);
  if (!digits) return false;
  if (filter.kind === 'prefix') {
    return digits.startsWith(filter.prefix);
  }
  if (digits.length < 4) return false;
  const num = parseInt(digits.slice(0, 4), 10);
  if (Number.isNaN(num)) return false;
  return num >= filter.from && num <= filter.to;
}

export function parseProvinceList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(',')
      .map((p) => p.trim())
      .filter(Boolean),
  )];
}

export function parseMaxDistanceKm(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, 500);
}

export const DISTANCE_PRESETS_KM = [10, 25, 50, 100] as const;
