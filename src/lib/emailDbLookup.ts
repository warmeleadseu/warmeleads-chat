/**
 * Escape `%`, `_` en `\` zodat PostgREST `.ilike()` ze letterlijk behandelt
 * (exacte match, hoofdletterongevoelig).
 */
export function escapeForIlikeExact(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Kies rij waarvan e-mail na lowercasing gelijk is aan `normalizedEmail`, anders eerste treffer. */
export function pickEmailRow<T extends { email?: string | null }>(rows: T[], normalizedEmail: string): T | null {
  if (!rows.length) return null;
  const hit = rows.find(r => (r.email || '').toLowerCase() === normalizedEmail);
  return hit ?? rows[0];
}
