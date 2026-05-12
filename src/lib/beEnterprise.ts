/**
 * Belgisch ondernemingsnummer (KBO): 10 cijfers.
 * Wordt in dezelfde databasekolom opgeslagen als het Nederlandse KVK-nummer (`kvk_nummer`).
 */

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export function isNlKvkEightDigits(raw: string | null | undefined): boolean {
  return /^\d{8}$/.test(digitsOnly(raw || ''));
}

/**
 * Accepteert o.a. "0123.456.789", "0123456789", "BE0123456789" → precies 10 cijfers, anders null.
 */
export function normalizeBelgianKboDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = digitsOnly(raw);
  if (d.length === 10) return d;
  if (d.length > 10) return d.slice(-10);
  return null;
}

export function belgianKboDigitsToVatId(d10: string): string {
  return `BE${d10}`;
}

/** Korte registratienaam voor UI/PDF op basis van opgeslagen waarde. */
export function customerRegistryShortLabel(stored: string | null | undefined): 'KVK' | 'KBO' {
  if (!stored) return 'KVK';
  const d = digitsOnly(stored);
  if (d.length === 10) return 'KBO';
  return 'KVK';
}
