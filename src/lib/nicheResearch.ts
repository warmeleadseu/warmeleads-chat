import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBatchKind } from './batchKind';

/** Systeem-branche voor facturatie-FK; geen inbound Zapier-leads. */
export const NICHE_RESEARCH_SYSTEM_BRANCH = 'niche_research';

export function isNicheResearchBatchKind(kind: string | null | undefined): boolean {
  return normalizeBatchKind(kind) === 'niche_research';
}

/** Branches waar inbound leads vandaan komen (niet de systeem-branche). */
export function isInboundLeadBranchSlug(slug: string | null | undefined): boolean {
  if (!slug || slug === NICHE_RESEARCH_SYSTEM_BRANCH) return false;
  return true;
}

export async function ensureCustomerHasBranch(
  supabase: SupabaseClient,
  customerId: string,
  branchSlug: string,
): Promise<void> {
  const { data } = await supabase.from('customers').select('branches').eq('id', customerId).single();
  const current = (data?.branches as string[] | null) ?? [];
  if (current.includes(branchSlug)) return;
  const next = [...current, branchSlug];
  await supabase.from('customers').update({ branches: next }).eq('id', customerId);
}

export async function validateLeadBranchSlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const trimmed = slug.trim();
  if (!trimmed) {
    return { ok: false, error: 'Kies een inbound-branche voor deze onderzoeksbatch.' };
  }
  if (trimmed === NICHE_RESEARCH_SYSTEM_BRANCH) {
    return { ok: false, error: 'Kies de echte lead-branche (niet Niche-onderzoek).' };
  }
  const { data, error } = await supabase
    .from('branches')
    .select('slug, name, is_active')
    .eq('slug', trimmed)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: 'Branche bestaat niet. Maak de branche eerst aan in Beheer → Branches.' };
  }
  if (!data.is_active) {
    return { ok: false, error: 'De gekozen branche is niet actief.' };
  }
  return { ok: true, name: data.name };
}
