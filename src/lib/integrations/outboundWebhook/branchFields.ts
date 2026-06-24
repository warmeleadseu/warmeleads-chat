import type { SupabaseClient } from '@supabase/supabase-js';
import type { DynamicField } from './fields';

/**
 * Haalt de branche-specifieke velden (branch_fields) op voor de opgegeven
 * branches van een klant, in een nette volgorde. Dedupliceert op sleutel
 * (een lead hoort bij één branche, dus custom_fields-keys overlappen niet).
 */
export async function getWebhookDynamicFields(
  supabase: SupabaseClient,
  branches: string[],
): Promise<DynamicField[]> {
  if (!branches || branches.length === 0) return [];

  const { data: branchRows } = await supabase
    .from('branches')
    .select('id, slug')
    .in('slug', branches);
  if (!branchRows || branchRows.length === 0) return [];

  const ids = branchRows.map((b) => b.id as string);

  const { data: fieldRows } = await supabase
    .from('branch_fields')
    .select('key, label, sort_order, branch_id')
    .in('branch_id', ids)
    .order('sort_order', { ascending: true });
  if (!fieldRows) return [];

  const seen = new Set<string>();
  const out: DynamicField[] = [];
  for (const f of fieldRows) {
    const key = f.key as string;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: (f.label as string) || key });
  }
  return out;
}
