import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hardcoded "well-known" partner-branche-slugs.
 *
 * Sinds migratie 131 is de canonieke bron van waarheid de DB-kolom
 * `branches.is_partner_branch`. Deze constante blijft als safety-net /
 * fallback (pre-migratie, of als de DB-vlag per ongeluk uitgezet wordt voor
 * een van de oude branches) en als seed voor de default-AM-config.
 */
export const PARTNER_PROSPECT_BRANCH_SLUGS = [
  'thuisbatterij_partners',
  'airco_partners',
  'nei_begun_partners',
] as const;

/**
 * Type voor de hardcoded slugs. Voor runtime-paden waar slugs ook van nieuwe,
 * dynamische DB-partner-branches kunnen komen (bv. webhook-routing of
 * prospect-insert) gebruiken we gewoon `string`.
 */
export type PartnerProspectBranchSlug = string;

/** Eerste hardcoded partner-branch (legacy default / fallback in AM-config). */
export const PARTNER_PROSPECT_BRANCH_SLUG: PartnerProspectBranchSlug = PARTNER_PROSPECT_BRANCH_SLUGS[0];

/** Mooie weergavenamen voor de well-known slugs. */
export const PARTNER_PROSPECT_BRANCH_LABELS: Record<string, string> = {
  thuisbatterij_partners: 'Thuisbatterij Partners',
  airco_partners: 'Airco Partners',
  nei_begun_partners: 'Nei Begun Partners',
};

/** Fallback accountmanager als er geen geldige config staat (Rick Schlimback). */
export const DEFAULT_PARTNER_PROSPECT_AM_ID = '64cad239-1eaf-497e-9c2b-d2ea60cb0512';

/**
 * Synchrone normalisatie tegen de **hardcoded** lijst — alleen voor paden
 * waar je per definitie een well-known slug verwacht (tests, defaults).
 * Voor runtime-routing (webhook/backfill) gebruik je de async DB-variant.
 */
export function normalizePartnerProspectBranchSlug(
  branch: string | undefined | null,
): PartnerProspectBranchSlug | null {
  const s = (branch || '').trim();
  if (!s) return null;
  return (PARTNER_PROSPECT_BRANCH_SLUGS as readonly string[]).includes(s) ? s : null;
}

export function isPartnerProspectBranchSlug(
  branch: string | undefined | null,
): boolean {
  return normalizePartnerProspectBranchSlug(branch) != null;
}

/**
 * Maak van een onbekende partner-slug (bv. `bulk`) een nette label-string.
 * Voor well-known slugs gebruiken we het label uit de constante.
 */
export function humanizePartnerBranchLabel(slug: string): string {
  if (PARTNER_PROSPECT_BRANCH_LABELS[slug]) return PARTNER_PROSPECT_BRANCH_LABELS[slug];
  const cleaned = slug.replace(/[_-]+/g, ' ').trim();
  if (!cleaned) return slug;
  return cleaned
    .split(/\s+/)
    .map(w => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Laad alle partner-branches uit de DB op basis van `is_partner_branch=true`.
 * Voegt de hardcoded fallback-slugs toe zodat detectie nooit kapot kan als de
 * DB-vlag voor een legacy-branche niet (meer) staat.
 *
 * Gebruik dit in routes die maar één branche-slug evalueren door het
 * resultaat te hergebruiken; bij echt incidenteel verbruik kan
 * `isPartnerBranchSlugDynamic` direct.
 */
export async function loadPartnerBranchSlugs(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const out = new Set<string>(PARTNER_PROSPECT_BRANCH_SLUGS);
  const { data, error } = await supabase
    .from('branches')
    .select('slug')
    .eq('is_partner_branch', true);
  if (error) {
    console.error(
      '[partnerProspectConstants] loadPartnerBranchSlugs failed:',
      error.message,
    );
    return out;
  }
  for (const row of data || []) {
    const slug = String((row as { slug?: unknown }).slug ?? '').trim();
    if (slug) out.add(slug);
  }
  return out;
}

/**
 * True als `slug` een partner-branche is — eerst via de DB-vlag, dan via de
 * hardcoded fallback. Geeft `null` terug bij lege / onbekende input.
 */
export async function isPartnerBranchSlugDynamic(
  supabase: SupabaseClient,
  slug: string | null | undefined,
): Promise<boolean> {
  const s = (slug || '').trim();
  if (!s) return false;
  if ((PARTNER_PROSPECT_BRANCH_SLUGS as readonly string[]).includes(s)) return true;
  const { data } = await supabase
    .from('branches')
    .select('is_partner_branch')
    .eq('slug', s)
    .maybeSingle();
  return (data as { is_partner_branch?: boolean | null } | null)?.is_partner_branch === true;
}
