/** Nederlandse provincies (officiële namen in CRM / PDOK-normalisatie). */
export const PROVINCES_NL = [
  'Drenthe',
  'Flevoland',
  'Friesland',
  'Gelderland',
  'Groningen',
  'Limburg',
  'Noord-Brabant',
  'Noord-Holland',
  'Overijssel',
  'Utrecht',
  'Zeeland',
  'Zuid-Holland',
] as const;

/** Belgische provincies (zelfde namen als `beProvincie()` in pdok.ts). */
export const PROVINCES_BE = [
  'Antwerpen',
  'Brussels',
  'Henegouwen',
  'Limburg',
  'Luik',
  'Luxemburg',
  'Namen',
  'Oost-Vlaanderen',
  'Vlaams-Brabant',
  'Waals-Brabant',
  'West-Vlaanderen',
] as const;

export const PROVINCES_ALL = [...PROVINCES_NL, ...PROVINCES_BE].sort((a, b) =>
  a.localeCompare(b, 'nl'),
);
