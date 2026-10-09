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

export type ExterneFactuur = { extern_factuurnummer: string | null; extern_bedrag_excl: number | null };

/**
 * Leest factuurnummer en bedrag excl. btw van een factuur die buiten het
 * systeem om ging (bijvoorbeeld Rompslomp). Een leeg bedrag betekent: de
 * batchprijs geldt. Geeft een foutmelding terug bij een ongeldig bedrag.
 */
export function leesExterneFactuur(invoer: { extern_factuurnummer?: unknown; extern_bedrag_excl?: unknown }):
  { ok: true; waarde: ExterneFactuur } | { ok: false; fout: string } {
  const nr = typeof invoer.extern_factuurnummer === 'string' ? invoer.extern_factuurnummer.trim().slice(0, 100) : '';
  const ruw = invoer.extern_bedrag_excl;
  let bedrag: number | null = null;
  if (ruw !== null && ruw !== undefined && String(ruw).trim() !== '') {
    const n = Number(String(ruw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, fout: 'Vul een geldig bedrag excl. btw in' };
    bedrag = Math.round(n * 100) / 100;
  }
  return { ok: true, waarde: { extern_factuurnummer: nr || null, extern_bedrag_excl: bedrag } };
}
