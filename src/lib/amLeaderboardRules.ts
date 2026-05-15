/**
 * Kalendermaand voor het live AM-leaderboard: zelfde definitie als `live-stats`
 * (eerste dag van de maand in de runtime-timezone, daarna ISO-string voor Supabase).
 */
export function leaderboardYearMonthFromDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function leaderboardMonthStartIsoFromYearMonth(yearMonth: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!m) throw new Error(`Invalid year_month: ${yearMonth}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`Invalid year_month: ${yearMonth}`);
  return new Date(y, mo - 1, 1).toISOString();
}

export type MonthlyPaidBatchRow = {
  id: string;
  total_price: number | string | null;
  account_manager_id: string | null;
  customer_id?: string | null;
  branch?: string | null;
  batch_kind?: string | null;
  created_at?: string | null;
  customers?: { name?: string | null; account_manager_id?: string | null } | null;
};

export type ManualLineRow = {
  admin_user_id: string;
  amount_euro: number | string;
  counts_as_batch: number | string;
};

/**
 * Berekent revenue- en batch-telling per AM uit betaalde batches in de maand,
 * met uitsluitingen en handmatige regels (zelfde semantiek als live-dashboard).
 */
export function aggregateAmLeaderboardFromBatches(
  batches: MonthlyPaidBatchRow[],
  excludedBatchIds: Set<string>,
  manualLines: ManualLineRow[],
): { amRevenue: Map<string, number>; amBatchCount: Map<string, number> } {
  const amRevenue = new Map<string, number>();
  const amBatchCount = new Map<string, number>();

  for (const cb of batches) {
    if (excludedBatchIds.has(cb.id)) continue;
    const cust = cb.customers as { account_manager_id?: string | null } | null | undefined;
    const amId = cb.account_manager_id || cust?.account_manager_id;
    if (!amId) continue;
    const price = Number(cb.total_price) || 0;
    amRevenue.set(amId, (amRevenue.get(amId) || 0) + price);
    amBatchCount.set(amId, (amBatchCount.get(amId) || 0) + 1);
  }

  for (const row of manualLines) {
    const amId = row.admin_user_id;
    const amt = Number(row.amount_euro) || 0;
    amRevenue.set(amId, (amRevenue.get(amId) || 0) + amt);
    if (Number(row.counts_as_batch) === 1) {
      amBatchCount.set(amId, (amBatchCount.get(amId) || 0) + 1);
    }
  }

  return { amRevenue, amBatchCount };
}
