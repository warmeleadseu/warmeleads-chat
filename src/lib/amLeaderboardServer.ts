import type { SupabaseClient } from '@supabase/supabase-js';
import {
  aggregateAmLeaderboardFromBatches,
  leaderboardMonthStartIsoFromYearMonth,
  type ManualLineRow,
  type MonthlyPaidBatchRow,
} from '@/lib/amLeaderboardRules';

/** PostgREST / Postgres fout wanneer migratie 107 nog niet is toegepast. */
export function isAmLeaderboardMigrationMissingError(message: string): boolean {
  const m = message.toLowerCase();
  const tables =
    m.includes('am_leaderboard_batch_exclusions') || m.includes('am_leaderboard_manual_lines');
  const missing =
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('undefined_table');
  return tables && missing;
}

export async function loadLeaderboardExcludedBatchIds(
  supabase: SupabaseClient,
  yearMonth: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('am_leaderboard_batch_exclusions')
    .select('customer_batch_id')
    .eq('year_month', yearMonth);
  if (error) {
    if (isAmLeaderboardMigrationMissingError(error.message)) {
      throw new Error('AM_LEADERBOARD_MIGRATION_107_MISSING');
    }
    throw new Error(error.message);
  }
  return new Set((data || []).map(r => r.customer_batch_id as string));
}

export async function loadLeaderboardManualLines(
  supabase: SupabaseClient,
  yearMonth: string,
): Promise<ManualLineRow[]> {
  const { data, error } = await supabase
    .from('am_leaderboard_manual_lines')
    .select('admin_user_id, amount_euro, counts_as_batch')
    .eq('year_month', yearMonth);
  if (error) {
    if (isAmLeaderboardMigrationMissingError(error.message)) {
      throw new Error('AM_LEADERBOARD_MIGRATION_107_MISSING');
    }
    throw new Error(error.message);
  }
  return (data || []) as ManualLineRow[];
}

export async function fetchMonthlyPaidBatchesForLeaderboard(
  supabase: SupabaseClient,
  yearMonth: string,
): Promise<MonthlyPaidBatchRow[]> {
  const monthStart = leaderboardMonthStartIsoFromYearMonth(yearMonth);
  const { data, error } = await supabase
    .from('customer_batches')
    .select(
      'id, total_price, branch, batch_kind, created_at, account_manager_id, customer_id, customers(name, account_manager_id)',
    )
    .eq('is_paid', true)
    .gte('created_at', monthStart);
  if (error) throw new Error(error.message);
  return (data || []) as MonthlyPaidBatchRow[];
}

export function resolveBatchAmId(cb: MonthlyPaidBatchRow): string | null {
  const cust = cb.customers as { account_manager_id?: string | null } | null | undefined;
  return cb.account_manager_id || cust?.account_manager_id || null;
}

export function computeLeaderboardMapsFromDbRows(
  batches: MonthlyPaidBatchRow[],
  excludedBatchIds: Set<string>,
  manualLines: ManualLineRow[],
) {
  return aggregateAmLeaderboardFromBatches(batches, excludedBatchIds, manualLines);
}
