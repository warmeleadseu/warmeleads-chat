import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Batch-specifieke targetgebieden (`batch_targets`) overrulen de klant-targetgebieden
 * (`customer_targets`) tijdens distributie. Deze rijen hebben dezelfde geo-velden als
 * `customer_targets`, zodat de bestaande match-logica (radius/provincie/land) ongewijzigd
 * werkt met beide bronnen.
 */
export interface GeoTargetRow {
  id?: string;
  label?: string | null;
  target_type?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  provinces?: string[] | null;
  country?: string | null;
  is_active?: boolean | null;
}

// Eenmalige detectie of de `batch_targets`-tabel al bestaat (werkt mét/zonder migratie 144).
let _batchTargetsTable: 'unknown' | 'yes' | 'no' = 'unknown';

async function batchTargetsTableExists(supabase: SupabaseClient): Promise<boolean> {
  if (_batchTargetsTable !== 'unknown') return _batchTargetsTable === 'yes';
  const { error } = await supabase.from('batch_targets').select('id', { head: true, count: 'exact' }).limit(1);
  if (!error) {
    _batchTargetsTable = 'yes';
    return true;
  }
  const code = (error as { code?: string }).code;
  const msg = (error as { message?: string }).message || '';
  if (code === '42P01' || /relation .* does not exist/i.test(msg) || /could not find the table/i.test(msg)) {
    _batchTargetsTable = 'no';
    return false;
  }
  // Andere fout (RLS/netwerk): optimistisch true, niet cachen.
  return true;
}

/**
 * Haalt de actieve batch-target-overrides op, gegroepeerd per `batch_id`.
 * Batches zonder eigen (actieve) targets komen niet in de map voor.
 */
export async function fetchActiveBatchTargetsByBatch(
  supabase: SupabaseClient,
  batchIds: string[],
): Promise<Map<string, GeoTargetRow[]>> {
  const map = new Map<string, GeoTargetRow[]>();
  const ids = [...new Set(batchIds.filter(Boolean))];
  if (ids.length === 0) return map;
  if (!(await batchTargetsTableExists(supabase))) return map;

  const { data, error } = await supabase
    .from('batch_targets')
    .select('*')
    .in('batch_id', ids)
    .eq('is_active', true);

  if (error || !data) return map;

  for (const row of data as (GeoTargetRow & { batch_id: string })[]) {
    const arr = map.get(row.batch_id) || [];
    arr.push(row);
    map.set(row.batch_id, arr);
  }
  return map;
}

/** Test-only: reset gecachte tabel-detectie. */
export function __resetBatchTargetsTableCacheForTests(): void {
  _batchTargetsTable = 'unknown';
}
