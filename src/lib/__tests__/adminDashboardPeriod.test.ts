import { describe, expect, it } from 'vitest';
import { getPeriodStart, getPrevPeriodStart } from '../adminDashboardPeriod';

/** Kalendergrenzen in Nederlandse tijd, ook als de server in UTC draait. */
describe('adminDashboardPeriod', () => {
  const nu = new Date('2026-11-10T23:30:00Z'); // woensdag 11 nov 00:30 in Nederland

  it('dag begint om middernacht Nederlandse tijd', () => {
    expect(getPeriodStart('day', nu).toISOString()).toBe('2026-11-10T23:00:00.000Z');
    expect(getPrevPeriodStart('day', nu).toISOString()).toBe('2026-11-09T23:00:00.000Z');
  });

  it('week begint op maandag', () => {
    expect(getPeriodStart('week', nu).toISOString()).toBe('2026-11-08T23:00:00.000Z');
    expect(getPrevPeriodStart('week', nu).toISOString()).toBe('2026-11-01T23:00:00.000Z');
  });

  it('maand, kwartaal en jaar, over de zomertijd heen', () => {
    expect(getPeriodStart('month', nu).toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(getPrevPeriodStart('month', nu).toISOString()).toBe('2026-09-30T22:00:00.000Z');
    expect(getPeriodStart('quarter', nu).toISOString()).toBe('2026-09-30T22:00:00.000Z');
    expect(getPrevPeriodStart('quarter', nu).toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(getPeriodStart('year', nu).toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });

  it('januari: vorige maand is december van het jaar ervoor', () => {
    expect(getPrevPeriodStart('month', new Date('2027-01-15T12:00:00Z')).toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });

  it('zondag hoort bij de week vanaf de maandag ervoor', () => {
    expect(getPeriodStart('week', new Date('2026-11-15T12:00:00Z')).toISOString()).toBe('2026-11-08T23:00:00.000Z');
  });
});
