/**
 * Telefoonzoeken: dezelfde regel herkennen ongeacht NL-notatie (06…, +31 6…, 0031 6…).
 * Gebruikt voor PostgREST `.or()`-fragmenten en voor prospect-RPC-varianten.
 */

/** Alleen cijfers, leeg als er geen cijfers in de invoer zaten. */
export function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Unieke digit-only strings om als substring te matchen (min. 3 cijfers).
 * NL-mobiel: 06 + 8 cijfers ⇄ 316 + dezelfde 8 cijfers; 0031… wordt genormaliseerd naar 31….
 */
export function phoneSearchDigitVariants(raw: string): string[] {
  let d = digitsOnlyPhone(raw);
  if (d.length < 3) return [];

  if (d.startsWith('0031')) {
    d = d.slice(2);
  }

  const out = new Set<string>();
  out.add(d);

  const m06 = /^06(\d{8})$/.exec(d);
  if (m06) {
    out.add(`316${m06[1]}`);
  }

  const m316 = /^316(\d{8})$/.exec(d);
  if (m316) {
    out.add(`06${m316[1]}`);
  }

  return [...out];
}

export function sanitizePostgrestIlike(value: string): string {
  return value.replace(/[%_\\]/g, c => `\\${c}`);
}

/** PostgREST-filterregels `kolom.ilike.%…%` voor telefoon (alle relevante varianten). */
export function buildPhoneSearchIlikeClauses(column: string, rawSearch: string): string[] {
  const clauses: string[] = [];
  for (const v of phoneSearchDigitVariants(rawSearch)) {
    if (v.length < 3) continue;
    clauses.push(`${column}.ilike.%${sanitizePostgrestIlike(v)}%`);
  }
  return clauses;
}
