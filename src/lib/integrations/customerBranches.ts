import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadCustomerBranchSlugs(
  supabase: SupabaseClient,
  customerId: string,
): Promise<string[]> {
  const { data } = await supabase.from('customers').select('branches').eq('id', customerId).single();
  return (data?.branches as string[] | null) ?? [];
}

export async function isCustomerBranch(
  supabase: SupabaseClient,
  customerId: string,
  branchSlug: string,
): Promise<boolean> {
  const slugs = await loadCustomerBranchSlugs(supabase, customerId);
  return slugs.includes(branchSlug);
}
