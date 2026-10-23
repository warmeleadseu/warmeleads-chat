/**
 * Wachttijd tussen de klanten van één lead.
 *
 * - De tweede klant krijgt een lead op zijn vroegst 12 uur na de eerste.
 * - De derde klant op zijn vroegst 8 uur na de tweede (afgesproken 24 okt 2026;
 *   voorheen ook 12 uur).
 *
 * Eén plek, zodat de verdeling, de wachtrij, de lookback en Restleads (labels,
 * handmatig en massaal uitdelen) altijd dezelfde tijden aanhouden.
 */

export const WACHTTIJD_TWEEDE_KLANT_UUR = 12;
export const WACHTTIJD_DERDE_KLANT_UUR = 8;

/** Hoe lang wachten na de laatste klant, als de lead er al `aantalKlanten` heeft. */
export function wachttijdUren(aantalKlanten: number): number {
  return aantalKlanten >= 2 ? WACHTTIJD_DERDE_KLANT_UUR : WACHTTIJD_TWEEDE_KLANT_UUR;
}

/**
 * Vanaf wanneer mag de lead naar een volgende klant? Telt de klanten die de
 * lead al heeft (behalve `klantId`, de klant om wie het gaat). Null = nu al.
 */
export function volgendeKlantVanaf(
  bestaande: { customer_id: string | null; assigned_at: string | null }[],
  klantId: string | null,
  nu: Date = new Date(),
): Date | null {
  const anderen = bestaande.filter(a => a.customer_id && a.customer_id !== klantId && a.assigned_at);
  if (anderen.length === 0) return null;
  const aantal = new Set(anderen.map(a => a.customer_id)).size;
  const laatste = Math.max(...anderen.map(a => new Date(a.assigned_at as string).getTime()));
  const vrij = laatste + wachttijdUren(aantal) * 3_600_000;
  return vrij > nu.getTime() ? new Date(vrij) : null;
}
