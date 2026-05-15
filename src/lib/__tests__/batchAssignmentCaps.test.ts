import { describe, it, expect } from 'vitest';
import { getLeadLimitPeriodAnchors } from '../batchAssignmentCaps';

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
