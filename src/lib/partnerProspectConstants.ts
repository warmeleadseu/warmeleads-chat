/** Zelfde slugs als `branches.slug` voor Meta/Zapier partner-acquisitie → prospects-pijplijn. */
export const PARTNER_PROSPECT_BRANCH_SLUGS = [
  'thuisbatterij_partners',
  'airco_partners',
  'nei_begun_partners',
] as const;

export type PartnerProspectBranchSlug = (typeof PARTNER_PROSPECT_BRANCH_SLUGS)[number];

/** Eerste partner-branch (legacy default / fallback in AM-config). */
export const PARTNER_PROSPECT_BRANCH_SLUG: PartnerProspectBranchSlug = PARTNER_PROSPECT_BRANCH_SLUGS[0];

export const PARTNER_PROSPECT_BRANCH_LABELS: Record<PartnerProspectBranchSlug, string> = {
  thuisbatterij_partners: 'Thuisbatterij Partners',
  airco_partners: 'Airco Partners',
  nei_begun_partners: 'Nei Begun Partners',
};

/** Fallback accountmanager als er geen geldige config staat (Rick Schlimback). */
export const DEFAULT_PARTNER_PROSPECT_AM_ID = '64cad239-1eaf-497e-9c2b-d2ea60cb0512';

export function normalizePartnerProspectBranchSlug(
  branch: string | undefined | null,
): PartnerProspectBranchSlug | null {
  const s = (branch || '').trim();
  if (!s) return null;
  return (PARTNER_PROSPECT_BRANCH_SLUGS as readonly string[]).includes(s)
    ? (s as PartnerProspectBranchSlug)
    : null;
}

export function isPartnerProspectBranchSlug(
  branch: string | undefined | null,
): branch is PartnerProspectBranchSlug {
  return normalizePartnerProspectBranchSlug(branch) != null;
}
