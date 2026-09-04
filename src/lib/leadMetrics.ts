/**
 * Eén definitie van "verse lead" en "verse uitdeling", voor alle tellers op het
 * dashboard en in de kostenboekhouding.
 *
 * AANLEIDING
 * ----------
 * Het periodeoverzicht liet in de week van 31 augustus 2026 "98 leads geworven"
 * naast "160 leads uitgedeeld" zien, oftewel een conversieratio van 163%. Die
 * 160 bevatte echter 55 bulkverkoop-rijen, waarvan er 54 gingen over leads die
 * wéken eerder waren binnengekomen. Eén bulkverkoop uit oude voorraad tilde
 * daarmee de ratio van een week verse instroom op. De effectieve CPL op
 * dezelfde pagina rekende met een heel andere verzameling (1,06x per lead) en
 * sprak het cijfer ernaast dus tegen.
 *
 * Vanaf nu geldt: verse instroom in de teller, verse uitdeling in de noemer,
 * en bulk telt nergens mee. Omdat alles uit de ruwe rijen wordt herrekend,
 * werkt de correctie meteen met terugwerkende kracht voor elke periode.
 */

/**
 * Leadbronnen die geen verse instroom zijn: handmatig ingelezen bestanden en
 * demo-/testleads. Deze tellen nooit als geworven lead.
 */
export const NIET_VERSE_LEAD_BRONNEN = ['excel_import', 'demo'] as const;

/**
 * Toewijzingsbronnen die géén verse uitdeling zijn.
 *
 *  - `bulk_export`  : export van een voorraad leads, geen levering uit de pijplijn.
 *  - `bulk_assign`  : handmatige bulkverkoop, doorgaans uit oude voorraad.
 *  - `demo`         : demo-portaal, geen echte klant.
 *  - `mirror`       : kopie in een masterportaal; telt in `distribution.ts`
 *                     bewust ook niet mee voor cooldown of verdeel-cap, dus
 *                     hier evenmin als levering.
 */
export const NIET_VERSE_TOEWIJZING_BRONNEN = [
  'bulk_export',
  'bulk_assign',
  'demo',
  'mirror',
] as const;

/**
 * PostgREST-filter voor verse uitdelingen. Een lege `source` is historisch
 * gelijk aan `distribution`, dus die telt mee.
 *
 * Gebruik: `query.or(verseToewijzingFilter())`.
 */
export function verseToewijzingFilter(): string {
  return `source.is.null,source.not.in.(${NIET_VERSE_TOEWIJZING_BRONNEN.join(',')})`;
}

/** Rij-vorm waarop de in-memory varianten hieronder werken. */
type ToewijzingRij = { source?: string | null };
type LeadRij = { bron?: string | null };

/** Is dit een verse uitdeling (dus geen bulk, demo of mirror)? */
export function isVerseToewijzing(rij: ToewijzingRij): boolean {
  const bron = rij.source || 'distribution';
  return !(NIET_VERSE_TOEWIJZING_BRONNEN as readonly string[]).includes(bron);
}

/** Is dit een verse lead (dus geen import of demo)? */
export function isVerseLead(lead: LeadRij): boolean {
  const bron = lead.bron || '';
  return !(NIET_VERSE_LEAD_BRONNEN as readonly string[]).includes(bron);
}
