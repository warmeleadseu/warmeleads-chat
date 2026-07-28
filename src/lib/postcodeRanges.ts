/**
 * Parse and apply NL/BE postcode-area filters (PC4 ranges).
 *
 * Accepted input examples:
 *   "7500-7599"
 *   "2000-2099, 8000"
 *   "7511"
 *   "7511AB" / "7511 AB"   (letters/spaces ignored; first 4 digits used)
 *   "75"                   (→ 7500-7599)
 *   "751"                  (→ 7510-7519)
 *
 * Matching uses string bounds on `leads.postcode` (values like "7511AB" / "7511 AB" / "2000"),
 * which works for both Dutch (4 digits + letters) and Belgian (4 digits) formats.
 */

export type PostcodeRange = { from: number; to: number };

/** Extract PC digits from a token; if >4 digits, take the first 4 (NL/BE PC4). */
function extractPcDigits(token: string): { value: number; len: number } | null {
  const digits = String(token).replace(/\D/g, '');
  if (!digits) return null;
  const sliced = digits.length > 4 ? digits.slice(0, 4) : digits;
  const value = Number(sliced);
  if (!Number.isFinite(value) || value < 0 || value > 9999) return null;
  return { value, len: sliced.length };
}

/**
 * Expand short PC prefixes to a full PC4 range:
 *   2 digits → xx00–xx99
 *   3 digits → xxx0–xxx9
 *   4 digits → exact
 */
function expandToPc4Range(value: number, len: number): PostcodeRange {
  if (len <= 2) {
    const from = value * 100;
    return { from, to: Math.min(from + 99, 9999) };
  }
  if (len === 3) {
    const from = value * 10;
    return { from, to: Math.min(from + 9, 9999) };
  }
  return { from: value, to: value };
}

export function parsePostcodeRanges(input: string | null | undefined): PostcodeRange[] {
  if (!input || !String(input).trim()) return [];
  const ranges: PostcodeRange[] = [];

  for (const raw of String(input).split(/[,;]+/)) {
    const token = raw.trim();
    if (!token) continue;

    // Range separator: hyphen / en-dash / em-dash (not in the middle of "7511-AB")
    const rangeParts = token.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);

    if (rangeParts.length === 2) {
      const a = extractPcDigits(rangeParts[0]!);
      const b = extractPcDigits(rangeParts[1]!);
      if (!a || !b) continue;
      // Pad short sides like portal: 75-76 → 7500-7699
      const from = a.len < 4 ? Number(String(a.value).padEnd(4, '0')) : a.value;
      const to = b.len < 4 ? Number(String(b.value).padEnd(4, '9')) : b.value;
      if (from > 9999 || to > 9999) continue;
      ranges.push({ from: Math.min(from, to), to: Math.max(from, to) });
      continue;
    }

    if (rangeParts.length !== 1) continue;
    const one = extractPcDigits(rangeParts[0]!);
    if (!one) continue;
    ranges.push(expandToPc4Range(one.value, one.len));
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
