const SLEUTEL = 'warmeleads-apparaat';

/**
 * Een willekeurige code voor deze browser, zodat op een account met één
 * gedeelde login alleen de beller zelf zijn seintje krijgt. Geen
 * persoonsgegeven; verdwijnt met het wissen van de browsergegevens.
 */
export function apparaatKenmerk(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const oud = localStorage.getItem(SLEUTEL);
    if (oud) return oud;
    const nieuw = crypto.randomUUID();
    localStorage.setItem(SLEUTEL, nieuw);
    return nieuw;
  } catch {
    return null;
  }
}
