/**
 * Branch-policy helpers — bepalen welke branches selecteerbaar zijn in
 * verschillende UI-flows en server-side guards.
 *
 * Achtergrond:
 *  - `is_partner_branch=true`: prospects-acquisitiebranche (partner-leads → prospects-pijplijn).
 *    Mag NIET als leverbare lead-branche worden gekozen bij batch-creatie of klant-branches.
 *  - `slug='niche_research'`: systeem-branche voor facturatie van onderzoeksbatches.
 *    Mag NIET als gewone lead-branche worden gekozen.
 */

import { NICHE_RESEARCH_SYSTEM_BRANCH } from './nicheResearch';
import { PARTNER_PROSPECT_BRANCH_SLUGS } from './partnerProspectConstants';

export type BranchPolicyInput = {
  slug: string;
  is_active?: boolean | null;
  is_partner_branch?: boolean | null;
};

/**
 * Detecteert partner-branches op zowel de DB-kolom (na migratie 131) als de
 * hardcoded slug-lijst (zodat detectie pre-migratie ook werkt en als safety net
 * blijft fungeren).
 */
export function isPartnerBranch(b: BranchPolicyInput): boolean {
  if (b.is_partner_branch === true) return true;
  return (PARTNER_PROSPECT_BRANCH_SLUGS as readonly string[]).includes(b.slug);
}

export function isNicheResearchSystemBranch(b: BranchPolicyInput): boolean {
  return b.slug === NICHE_RESEARCH_SYSTEM_BRANCH;
}

/**
 * True als deze branche door een AM/admin als leverbare lead-branche mag
 * worden gekozen (nieuwe batch, klant-branches, lead-branch-koppeling van
 * onderzoeksbatch).
 */
export function isSellableLeadBranch(b: BranchPolicyInput): boolean {
  if (b.is_active === false) return false;
  if (isPartnerBranch(b)) return false;
  if (isNicheResearchSystemBranch(b)) return false;
  return true;
}

/**
 * True als deze branche selecteerbaar is als inbound-branche voor een niche-
 * onderzoeksbatch. Identiek aan `isSellableLeadBranch` (partner/niche uitgesloten),
 * maar als losse helper genoemd voor leesbaarheid op de niche-flows.
 */
export function isSelectableNicheInboundBranch(b: BranchPolicyInput): boolean {
  return isSellableLeadBranch(b);
}
