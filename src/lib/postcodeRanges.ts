/**
 * Parse and apply NL/BE postcode-area filters (PC4 ranges).
 *
 * Accepted input examples:
 *   "7500-7599"
 *   "2000-2099, 8000"
 *   "7511"
 *
 * Matching uses string bounds on `leads.postcode` (values like "7511AB" / "2000"),
 * which works for both Dutch (4 digits + letters) and Belgian (4 digits) formats.
 */

export type PostcodeRange = { from: number; to: number };

const TOKEN_RE = /^\s*(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?\s*$/;

export function parsePostcodeRanges(input: string | null | undefined): PostcodeRange[] {
  if (!input || !String(input).trim()) return [];
  const ranges: PostcodeRange[] = [];
  for (const raw of String(input).split(/[,;]+/)) {
    const m = raw.match(TOKEN_RE);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] != null ? Number(m[2]) : a;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a < 0 || b < 0 || a > 9999 || b > 9999) continue;
    ranges.push({ from: Math.min(a, b), to: Math.max(a, b) });
  }
  return ranges;
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * Builds a PostgREST `or(...)` filter string for the given PC4 ranges.
 * Uses half-open string bounds: postcode >= from AND postcode < (to+1).
 * Returns null when there are no valid ranges.
 */
export function buildPostcodeRangeOrFilter(ranges: PostcodeRange[]): string | null {
  if (ranges.length === 0) return null;
  const parts: string[] = [];
  for (const r of ranges) {
    const lower = pad4(r.from);
    const upperExclusive = pad4(r.to + 1);
    // to === 9999 → upperExclusive would be "10000"; use only gte in that case
    if (r.to >= 9999) {
      parts.push(`postcode.gte.${lower}`);
    } else {
      parts.push(`and(postcode.gte.${lower},postcode.lt.${upperExclusive})`);
    }
  }
  return parts.length === 1 ? parts[0]! : parts.join(',');
}
