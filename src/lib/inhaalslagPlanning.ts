/**
 * Een inhaalslag (terugkijkperiode van een batch) gefaseerd over 8 uur.
 *
 * Een batch met een terugkijkperiode kreeg de oudere leads in één klap: bij
 * kWh Garant (12 okt 2026) zouden dat er in één minuut 7 zijn. Nu worden ze
 * gelijkmatig over 8 uur verdeeld; de verdeelronde levert ze elk kwartier af
 * zodra hun tijd daar is.
 */

export const INHAALSLAG_VENSTER_UREN = 8;
export const INHAALSLAG_PAUZE_UREN = 12;

export type InhaalslagKandidaat = {
  lead_id: string;
  /** Vroegste moment waarop deze lead mag (12 uur na de vorige klant), of null. */
  vroegst: Date | null;
};

/**
 * Tijdstippen voor de kandidaten: gelijk verdeeld over het venster, de eerste
 * meteen. Mag een lead nog niet (12 uur na een andere klant), dan op het
 * eerste moment dat het wel mag. Valt dat buiten het venster, dan valt hij af.
 */
export function planInhaalslag(
  kandidaten: InhaalslagKandidaat[],
  nu: Date = new Date(),
  vensterUren: number = INHAALSLAG_VENSTER_UREN,
): { lead_id: string; gepland_voor: Date }[] {
  const venster = vensterUren * 3_600_000;
  const einde = nu.getTime() + venster;
  const binnen = kandidaten.filter(k => !k.vroegst || k.vroegst.getTime() <= einde);
  if (binnen.length === 0) return [];
  const stap = venster / binnen.length;
  return binnen.map((k, i) => {
    const slot = nu.getTime() + i * stap;
    const t = Math.max(slot, k.vroegst?.getTime() ?? 0);
    return { lead_id: k.lead_id, gepland_voor: new Date(Math.min(t, einde)) };
  });
}

/** Wanneer de 12 uur na de laatste andere klant om zijn, of null als dat al zo is. */
export function vroegsteMoment(
  bestaande: { customer_id: string | null; assigned_at: string | null }[],
  klantId: string,
  nu: Date = new Date(),
): Date | null {
  const tijden = bestaande
    .filter(a => a.customer_id && a.customer_id !== klantId && a.assigned_at)
    .map(a => new Date(a.assigned_at as string).getTime());
  if (tijden.length === 0) return null;
  const vrij = Math.max(...tijden) + INHAALSLAG_PAUZE_UREN * 3_600_000;
  return vrij > nu.getTime() ? new Date(vrij) : null;
}
