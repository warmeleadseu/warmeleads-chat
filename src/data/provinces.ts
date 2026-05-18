export type ProvinceLand = 'NL' | 'BE';

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

function provinceTargetValue(land: ProvinceLand, name: string): string {
  return `${land}:${name}`;
}

function provinceTargetLabel(land: ProvinceLand, name: string): string {
  return name === 'Limburg' ? `Limburg (${land})` : name;
}

/** Unieke waarden voor platte filters (geen dubbele Limburg). */
export const PROVINCES_ALL = [
  ...PROVINCES_NL.map(p => provinceTargetValue('NL', p)),
  ...PROVINCES_BE.map(p => provinceTargetValue('BE', p)),
].sort((a, b) =>
  provinceTargetLabel(
    a.startsWith('BE:') ? 'BE' : 'NL',
    a.split(':').slice(1).join(':'),
  ).localeCompare(
    provinceTargetLabel(b.startsWith('BE:') ? 'BE' : 'NL', b.split(':').slice(1).join(':')),
    'nl',
  ),
);

export type ProvinceOption = {
  name: string;
  land: ProvinceLand;
  /** Opgeslagen in targets / assignment rules */
  value: string;
  /** UI-label */
  label: string;
};

function provinceOption(name: string, land: ProvinceLand): ProvinceOption {
  return {
    name,
    land,
    value: provinceTargetValue(land, name),
    label: provinceTargetLabel(land, name),
  };
}

export const PROVINCE_OPTIONS_NL = PROVINCES_NL.map(p => provinceOption(p, 'NL'));
export const PROVINCE_OPTIONS_BE = PROVINCES_BE.map(p => provinceOption(p, 'BE'));
