/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateAmLeaderboardFromBatches,
  leaderboardMonthStartIsoFromYearMonth,
  leaderboardYearMonthFromDate,
} from '@/lib/amLeaderboardRules';

describe('amLeaderboardRules', () => {
  it('leaderboardYearMonthFromDate', () => {
    expect(leaderboardYearMonthFromDate(new Date(2026, 2, 15))).toBe('2026-03');
  });

  it('leaderboardMonthStartIsoFromYearMonth', () => {
    expect(() => leaderboardMonthStartIsoFromYearMonth('2026-13')).toThrow();
    const iso = leaderboardMonthStartIsoFromYearMonth('2026-01');
    expect(typeof iso).toBe('string');
    expect(iso.length).toBeGreaterThan(15);
  });

  it('aggregateAmLeaderboardFromBatches excludes and adds manual', () => {
    const batches = [
      {
        id: 'a',
        total_price: 100,
        account_manager_id: 'am1',
        customers: { account_manager_id: null },
      },
      {
        id: 'b',
        total_price: 50,
        account_manager_id: 'am1',
        customers: { account_manager_id: null },
      },
    ];
    const excluded = new Set<string>(['b']);
    const manual = [{ admin_user_id: 'am1', amount_euro: 25, counts_as_batch: 1 }];
    const { amRevenue, amBatchCount } = aggregateAmLeaderboardFromBatches(batches, excluded, manual);
    expect(amRevenue.get('am1')).toBe(125);
    expect(amBatchCount.get('am1')).toBe(2);
  });
});
