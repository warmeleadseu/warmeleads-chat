/**
 * Gedeelde teksten voor reclamaties in het klantportaal.
 *
 * Stonden eerder alleen in portal/page.tsx. Nu het overzicht op een eigen
 * pagina staat, moeten beide plekken exact dezelfde labels en kleuren tonen:
 * een reclamatie die op de ene plek "Goedgekeurd" heet mag op de andere plek
 * niet iets anders heten.
 */

export const RECLAMATION_REASONS = [
  { value: 'foutief_telefoonnummer', label: 'Foutief telefoonnummer' },
  { value: 'dubbele_lead', label: 'Dubbele lead binnen 30 dagen' },
  { value: 'buiten_doelgebied', label: 'Buiten mijn afgesproken gebied' },
] as const;

export const RECLAMATION_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: 'In behandeling', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80' },
  approved: { label: 'Goedgekeurd', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80' },
  rejected: { label: 'Afgewezen', cls: 'bg-red-50 text-red-600 ring-1 ring-red-200/80' },
};

export function reclamationReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '';
  return RECLAMATION_REASONS.find(r => r.value === reason)?.label ?? reason;
}

/** Zoals de klant hem ziet: alles behalve 'in behandeling' is afgehandeld. */
export function isAfgehandeld(status: string): boolean {
  return status === 'approved' || status === 'rejected';
}
