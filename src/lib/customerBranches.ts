import type { createServerClient } from '@/lib/supabase';
import { syncDemoLeadAssignmentsForCustomer } from '@/lib/demoPortalLeads';

type Supabase = ReturnType<typeof createServerClient>;

export type BranchChangeWarning = {
  code: 'active_batches_on_removed_branch';
  branch: string;
  batch_count: number;
};

export type ApplyCustomerBranchesResult = {
  warnings: BranchChangeWarning[];
  demo_assignments_synced: number;
  prospect_synced: boolean;
};

/** Normaliseer branches uit DB/API naar unieke, niet-lege slugs. */
export function normalizeCustomerBranchSlugs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const slug = String(item ?? '').trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

export function branchesChanged(before: string[], after: string[]): boolean {
  if (before.length !== after.length) return true;
  const a = [...before].sort();
  const b = [...after].sort();
  return a.some((slug, i) => slug !== b[i]);
}

export async function validateCustomerBranchSlugs(
  supabase: Supabase,
  slugs: string[],
): Promise<{ ok: true; slugs: string[] } | { ok: false; error: string }> {
  const normalized = normalizeCustomerBranchSlugs(slugs);
  if (normalized.length === 0) {
    return { ok: false, error: 'Selecteer minimaal één branche' };
  }

  const { data: rows, error } = await supabase
    .from('branches')
    .select('slug, is_active, is_partner_branch')
    .in('slug', normalized);

  if (error) {
    return { ok: false, error: 'Branches valideren mislukt' };
  }

  const bySlug = new Map(
    (rows || []).map(r => [r.slug as string, r as { slug: string; is_active: boolean; is_partner_branch?: boolean | null }]),
  );
  const unknown = normalized.filter(s => !bySlug.has(s));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Onbekende branche(s): ${unknown.join(', ')}`,
    };
  }

  const inactive = normalized.filter(s => bySlug.get(s)?.is_active === false);
  if (inactive.length > 0) {
    return {
      ok: false,
      error: `Branche(s) niet actief: ${inactive.join(', ')}. Activeer de branche eerst in Beheer → Branches.`,
    };
  }

  const partner = normalized.filter(s => bySlug.get(s)?.is_partner_branch === true);
  if (partner.length > 0) {
    return {
      ok: false,
      error: `Branche(s) ${partner.join(', ')} is/zijn partner-branches en kunnen niet aan een klant worden gekoppeld. Gebruik de prospects-pijplijn voor partner-acquisitie.`,
    };
  }

  return { ok: true, slugs: normalized };
}

async function findWarningsForRemovedBranches(
  supabase: Supabase,
  customerId: string,
  removed: string[],
): Promise<BranchChangeWarning[]> {
  if (removed.length === 0) return [];

  const { data: batches } = await supabase
    .from('customer_batches')
    .select('branch, status')
    .eq('customer_id', customerId)
    .in('branch', removed)
    .in('status', ['active', 'paused', 'pending_payment']);

  const counts = new Map<string, number>();
  for (const row of batches || []) {
    const br = row.branch as string;
    counts.set(br, (counts.get(br) || 0) + 1);
  }

  return [...counts.entries()].map(([branch, batch_count]) => ({
    code: 'active_batches_on_removed_branch' as const,
    branch,
    batch_count,
  }));
}

/**
 * Na wijziging van customers.branches: demo-portaal, gekoppelde prospect, opruimen meta-defaults.
 */
export async function applyCustomerBranchesChange(
  supabase: Supabase,
  customerId: string,
  previousBranches: string[],
  nextBranches: string[],
): Promise<ApplyCustomerBranchesResult> {
  const prev = normalizeCustomerBranchSlugs(previousBranches);
  const next = normalizeCustomerBranchSlugs(nextBranches);

  const removed = prev.filter(b => !next.includes(b));
  const warnings = await findWarningsForRemovedBranches(supabase, customerId, removed);

  if (removed.length > 0) {
    await supabase
      .from('customer_branch_meta_defaults')
      .delete()
      .eq('customer_id', customerId)
      .in('branch', removed);
  }

  let demo_assignments_synced = 0;
  try {
    demo_assignments_synced = await syncDemoLeadAssignmentsForCustomer(
      supabase,
      customerId,
      next,
    );
  } catch (e) {
    console.error('[customerBranches] demo sync failed:', e);
  }

  let prospect_synced = false;
  const { data: prospect } = await supabase
    .from('prospects')
    .select('id')
    .eq('converted_to_customer_id', customerId)
    .maybeSingle();

  if (prospect?.id) {
    const { error: pErr } = await supabase
      .from('prospects')
      .update({ branches: next })
      .eq('id', prospect.id);
    prospect_synced = !pErr;
    if (pErr) {
      console.error('[customerBranches] prospect branches sync failed:', pErr.message);
    }
  }

  return { warnings, demo_assignments_synced, prospect_synced };
}
