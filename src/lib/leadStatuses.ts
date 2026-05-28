/** Gedeelde lead-statussen (portaal, API, admin). */
export const LEAD_STATUS_VALUES = [
  'nieuw',
  'gecontacteerd',
  'geen_gehoor',
  'offerte',
  'afspraak',
  'verkocht',
  'afgewezen',
] as const;

export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatusValue, string> = {
  nieuw: 'Nieuw',
  gecontacteerd: 'Gecontacteerd',
  geen_gehoor: 'Geen gehoor',
  offerte: 'Offerte',
  afspraak: 'Afspraak',
  verkocht: 'Verkocht',
  afgewezen: 'Afgewezen',
};

export function isValidLeadStatus(status: string): status is LeadStatusValue {
  return (LEAD_STATUS_VALUES as readonly string[]).includes(status);
}
