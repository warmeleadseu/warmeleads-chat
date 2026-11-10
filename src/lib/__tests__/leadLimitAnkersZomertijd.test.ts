import { describe, expect, it } from 'vitest';
import { getLeadLimitPeriodAnchors } from '../batchAssignmentCaps';

/** Dag- en weekgrens op middernacht Nederlandse tijd, ook rond de wisseling van zomer- naar wintertijd. */
describe('getLeadLimitPeriodAnchors rond de tijdwisseling', () => {
  it('zondag 25 okt 2026 (wintertijd vanaf 03:00): dag begint om 00:00 zomertijd', () => {
    const { dayStart, weekStart } = getLeadLimitPeriodAnchors(new Date('2026-10-25T20:00:00Z'));
    expect(dayStart.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(weekStart.toISOString()).toBe('2026-10-18T22:00:00.000Z');
  });

  it('maandag na de wisseling: week begint maandag 00:00 wintertijd', () => {
    const { dayStart, weekStart } = getLeadLimitPeriodAnchors(new Date('2026-10-26T10:00:00Z'));
    expect(dayStart.toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(weekStart.toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('woensdag in de week na de wisseling', () => {
    const { weekStart } = getLeadLimitPeriodAnchors(new Date('2026-10-28T10:00:00Z'));
    expect(weekStart.toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('zondag 29 maart 2026 (zomertijd vanaf 02:00)', () => {
    const { dayStart, weekStart } = getLeadLimitPeriodAnchors(new Date('2026-03-29T20:00:00Z'));
    expect(dayStart.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(weekStart.toISOString()).toBe('2026-03-22T23:00:00.000Z');
  });
});
