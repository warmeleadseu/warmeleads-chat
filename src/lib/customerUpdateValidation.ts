import { normalizeCustomerBranchSlugs } from './customerBranches';
import { normalizeVatId, normalizeBillingCountry } from './invoiceVat';

/**
 * Bepaalt of een veld opnieuw gekeurd moet worden bij het opslaan van een klant.
 *
 * Achtergrond: het bewerkformulier stuurt altijd het complete klantobject mee,
 * ook velden die niemand heeft aangeraakt. Wie dan bij elke opslag alles
 * valideert, laat historisch foute data het bewerken van álle andere velden
 * blokkeren. In augustus 2026 waren twintig klanten daardoor onbewerkbaar:
 * zes met een partner-branche, twee zonder branche, en twaalf met een
 * e-mailadres in het btw-nummerveld. Zelfs een telefoonnummer aanpassen lukte
 * niet meer.
 *
 * De regel is dus: keuren wat verandert, doorlaten wat blijft. Wie de waarde
 * wél aanpast krijgt onverkort dezelfde controle als voorheen.
 */

/** Zijn de ingediende branches anders dan wat er is opgeslagen? */
export function brancheKeuringNodig(
  opgeslagen: unknown,
  ingediend: unknown,
): boolean {
  /* Vergelijk hoofdletterongevoelig en zonder volgorde. Deze functie bepaalt
     of iemand geblokkeerd wordt; een verschil in schrijfwijze mag daar nooit
     de aanleiding voor zijn. Wat er wordt weggeschreven blijft de opgeslagen
     of de gevalideerde waarde, niet deze genormaliseerde vergelijking. */
  const sleutel = (raw: unknown) =>
    normalizeCustomerBranchSlugs(raw as string[] | null | undefined)
      .map(s => s.toLowerCase())
      .sort();
  const a = sleutel(opgeslagen);
  const b = sleutel(ingediend);
  if (a.length !== b.length) return true;
  return a.some((slug, i) => slug !== b[i]);
}

/**
 * Is het btw-nummer of het factuurland veranderd? Beide zijn relevant, want
 * dezelfde btw-string kan geldig zijn voor NL en ongeldig voor BE.
 */
export function btwKeuringNodig(args: {
  vatOpgeslagen: string | null | undefined;
  vatIngediend: string | null | undefined;
  landOpgeslagen: string | null | undefined;
  landIngediend: string | null | undefined;
  landMeegestuurd: boolean;
}): boolean {
  const vatVeranderd = normalizeVatId(args.vatOpgeslagen) !== normalizeVatId(args.vatIngediend);
  const landVeranderd =
    args.landMeegestuurd &&
    normalizeBillingCountry(args.landOpgeslagen) !== normalizeBillingCountry(args.landIngediend);
  return vatVeranderd || landVeranderd;
}
