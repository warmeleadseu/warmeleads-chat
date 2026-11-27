/**
 * Decemberactie 2026 (mail van 26 nov, reminder 27 nov).
 *
 * - Decemberbonus: voor elke 3 betaalde verse leads die tot en met
 *   31 december 2026 worden besteld, 1 gratis lead bij de volgende bestelling.
 * - Warmtepomp: extra leads cadeau bij de bestelling zelf (30 → 5, 50 → 10,
 *   75 → 15, 100 → 20).
 *
 * De bestellink in de reminder (merge-tag {{bestel_link}}) gaat naar de
 * herbestelpagina met bron 'decemberactie'. Die toont de actie, en de
 * bestelling krijgt een notitie met wat de klant tegoed heeft, zodat het
 * team de gratis leads bij de volgende bestelling kan toevoegen.
 */

/** Laatste dag van de actie (en van de bestellink), in Nederlandse tijd. */
export const DECEMBERACTIE_TOT = '2026-12-31';

/** Vervaldag van de link als hele dagen sinds 1970 (zie herbestelToken). */
export const DECEMBERACTIE_TOT_DAG = Math.floor(Date.parse(`${DECEMBERACTIE_TOT}T23:59:59+01:00`) / 86_400_000);

export function decemberactieLoopt(nu: Date = new Date()): boolean {
  return nu.getTime() <= Date.parse(`${DECEMBERACTIE_TOT}T23:59:59+01:00`);
}

/** Gratis leads bij de volgende bestelling: 1 per 3. */
export function decemberbonus(grootte: number): number {
  return Math.floor(Math.max(0, grootte) / 3);
}

const CADEAU_WARMTEPOMP: [number, number][] = [[100, 20], [75, 15], [50, 10], [30, 5]];

/** Cadeauleads bij de bestelling zelf (alleen warmtepomp). */
export function cadeauLeads(branche: string, grootte: number): number {
  if (branche !== 'warmtepomp') return 0;
  return CADEAU_WARMTEPOMP.find(([vanaf]) => grootte >= vanaf)?.[1] ?? 0;
}

/** Knoppen op de actiepagina: de maten uit de mail, plus de vorige grootte. */
export function actieGroottes(vorige: number, minimum: number): number[] {
  return [...new Set([30, 50, 75, 100, vorige])].filter(n => n >= minimum && n <= 1000).sort((a, b) => a - b);
}

/** Notitie op de bestelling, zichtbaar bij de batch in het admin-paneel. */
export function actieNotitie(branche: string, grootte: number): string {
  const delen = [`Decemberactie: ${decemberbonus(grootte)} gratis leads tegoed bij volgende bestelling`];
  const cadeau = cadeauLeads(branche, grootte);
  if (cadeau) delen.push(`${cadeau} cadeauleads nog toe te voegen aan deze batch`);
  return delen.join('; ');
}
