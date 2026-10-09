/**
 * Hoe een factuur op "betaald" kwam. Voor de boekhouding moet een factuur die
 * de klant via Mollie betaalde, te scheiden zijn van een factuur die wij zelf
 * op betaald zetten (bijvoorbeeld omdat de klant een factuur uit Rompslomp
 * betaalde): die laatste staat ook in Rompslomp en mag niet dubbel mee.
 */

export type BetaaldVia = 'mollie' | 'handmatig';

/** Markering die het beheer als betaal-ID gebruikt bij handmatig betaald. */
export const HANDMATIG_PREFIX = 'admin-manual';

/** Een echte Mollie-betaling heeft een ID als tr_xxx; de rest is handwerk. */
export function betaaldViaUitBetaalId(betaalId: string | null | undefined): BetaaldVia {
  return betaalId && !betaalId.startsWith(HANDMATIG_PREFIX) ? 'mollie' : 'handmatig';
}

/** Wie het deed, zoals het in de factuur komt te staan. */
export function beheerderNaam(admin: { name?: string | null; email?: string | null } | null | undefined): string | null {
  return admin?.name || admin?.email || null;
}
