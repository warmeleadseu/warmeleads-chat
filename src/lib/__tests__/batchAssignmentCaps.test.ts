import { describe, it, expect } from 'vitest';
import {
  fetchBatchAssignmentCapCounts,
  getLeadLimitPeriodAnchors,
} from '../batchAssignmentCaps';

describe('getLeadLimitPeriodAnchors', () => {
  it('uses Monday 00:00 as week start and local midnight for day', () => {
    const now = new Date(2026, 4, 13, 14, 30, 0, 0);
    const { dayStart, weekStart } = getLeadLimitPeriodAnchors(now);
    expect(weekStart.getDay()).toBe(1);
    expect(weekStart.getHours()).toBe(0);
    expect(weekStart.getMinutes()).toBe(0);
    expect(dayStart.getHours()).toBe(0);
    expect(dayStart.getFullYear()).toBe(now.getFullYear());
    expect(dayStart.getMonth()).toBe(now.getMonth());
    expect(dayStart.getDate()).toBe(now.getDate());
    expect(dayStart.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(weekStart.getTime()).toBeLessThanOrEqual(dayStart.getTime());
  });
});

/** Minimal Supabase-style mock voor cap-count tests. */
function mockSupabaseWithAssignments(
  rows: Array<{ assigned_at: string; leads: { created_at: string } | null }>,
) {
  return {
    from() {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.gte = () => Promise.resolve({ data: rows, error: null });
      return builder;
    },
  } as unknown as Parameters<typeof fetchBatchAssignmentCapCounts>[0];
}

describe('fetchBatchAssignmentCapCounts', () => {
  it('telt op lead.created_at (niet assigned_at) zodat backfill geen dag-cap overschrijdt', async () => {
    const now = new Date(2026, 4, 28, 13, 0, 0, 0);
    const today9am = new Date(2026, 4, 28, 9, 0, 0, 0).toISOString();
    const today11am = new Date(2026, 4, 28, 11, 0, 0, 0).toISOString();
    const yesterday2pm = new Date(2026, 4, 27, 14, 0, 0, 0).toISOString();
    const yesterday7pm = new Date(2026, 4, 27, 19, 0, 0, 0).toISOString();

    // Alles backfill-stijl ingeschreven om 13:00 vandaag, maar leads zijn van
    // verschillende dagen aangemaakt.
    const assignedNow = new Date(2026, 4, 28, 13, 0, 1, 0).toISOString();
    const rows = [
      { assigned_at: assignedNow, leads: { created_at: today9am } },
      { assigned_at: assignedNow, leads: { created_at: today11am } },
      { assigned_at: assignedNow, leads: { created_at: yesterday2pm } },
      { assigned_at: assignedNow, leads: { created_at: yesterday7pm } },
    ];

    const sb = mockSupabaseWithAssignments(rows);
    const { todayCount, weekCount } = await fetchBatchAssignmentCapCounts(sb, 'b1', now);

    expect(todayCount).toBe(2); // alleen vandaag aangemaakte leads
    expect(weekCount).toBe(4); // alle vier vallen in dezelfde kalenderweek
  });

  it('valt terug op assigned_at als lead.created_at ontbreekt (data corruption-safe)', async () => {
    const now = new Date(2026, 4, 28, 13, 0, 0, 0);
    const assignedToday = new Date(2026, 4, 28, 11, 0, 0, 0).toISOString();
    const rows = [{ assigned_at: assignedToday, leads: null }];

    const sb = mockSupabaseWithAssignments(rows);
    const { todayCount, weekCount } = await fetchBatchAssignmentCapCounts(sb, 'b1', now);

    expect(todayCount).toBe(1);
    expect(weekCount).toBe(1);
  });

  it('telt vorige-week-leads die vandaag werden ge(re-)assignd NIET mee in deze week', async () => {
    const now = new Date(2026, 4, 28, 13, 0, 0, 0);
    const assignedToday = new Date(2026, 4, 28, 11, 0, 0, 0).toISOString();
    const lastWeek = new Date(2026, 4, 20, 10, 0, 0, 0).toISOString();
    const rows = [{ assigned_at: assignedToday, leads: { created_at: lastWeek } }];

    const sb = mockSupabaseWithAssignments(rows);
    const { todayCount, weekCount } = await fetchBatchAssignmentCapCounts(sb, 'b1', now);

    expect(todayCount).toBe(0);
    expect(weekCount).toBe(0);
  });
});
