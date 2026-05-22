/** Standaard leadvelden in het portaal (alle branches). */
export const PORTAL_STANDARD_FIELDS = [
  { key: 'naam_klant', label: 'Naam klant', native: 'name' as const },
  { key: 'email', label: 'E-mail', native: 'email' as const },
  { key: 'telefoonnummer', label: 'Telefoon', native: 'phone' as const },
  { key: 'postcode', label: 'Postcode', native: 'address' as const },
  { key: 'huisnummer', label: 'Huisnummer', native: 'address' as const },
  { key: 'plaatsnaam', label: 'Plaats', native: 'address' as const },
  { key: 'provincie', label: 'Provincie', native: 'none' as const },
  { key: 'wervingsdatum', label: 'Wervingsdatum', native: 'none' as const },
  { key: 'notities', label: 'Notities', native: 'none' as const },
  { key: 'land', label: 'Land', native: 'none' as const },
] as const;

export type PortalStandardFieldKey = (typeof PORTAL_STANDARD_FIELDS)[number]['key'];

export const FIELD_MAP_SKIP = '_skip';
/** Ongekoppelde waarden in deal-samenvatting (fallback). */
export const FIELD_MAP_SUMMARY = '_summary';
