import { describe, expect, it } from 'vitest';
import {
  addCivilDays,
  amsterdamDayOfWeek,
  amsterdamWallTimeToUtc,
  amsterdamYmd,
  filterAvailabilityRows,
  filterBusyAppointments,
} from '../appointmentSlots';

describe('amsterdam timezone helpers', () => {
  it('formats YMD in Europe/Amsterdam', () => {
    // 2026-07-15 22:30 UTC = 2026-07-16 00:30 Amsterdam (CEST)
    const d = new Date('2026-07-15T22:30:00.000Z');
    expect(amsterdamYmd(d)).toBe('2026-07-16');
  });

  it('maps weekday in Amsterdam', () => {
    // Wednesday 2026-07-15 local Amsterdam
    const d = amsterdamWallTimeToUtc('2026-07-15', '12:00');
    expect(amsterdamDayOfWeek(d)).toBe(3);
  });

  it('converts winter (CET) wall time to UTC', () => {
    const d = amsterdamWallTimeToUtc('2026-01-15', '09:00');
    expect(d.toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('converts summer (CEST) wall time to UTC', () => {
    const d = amsterdamWallTimeToUtc('2026-07-15', '09:00');
    expect(d.toISOString()).toBe('2026-07-15T07:00:00.000Z');
  });

  it('addCivilDays rolls months', () => {
    expect(addCivilDays('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('availability inheritance filters', () => {
  const rows = [
    { portal_user_id: null, label: 'company' },
    { portal_user_id: 'agent-a', label: 'a' },
    { portal_user_id: 'agent-b', label: 'b' },
  ];

  it('undefined returns all (union)', () => {
    expect(filterAvailabilityRows(rows, undefined)).toHaveLength(3);
  });

  it('null returns only company rows', () => {
    expect(filterAvailabilityRows(rows, null).map((r) => r.label)).toEqual(['company']);
  });

  it('agent inherits company + own', () => {
    expect(filterAvailabilityRows(rows, 'agent-a').map((r) => r.label)).toEqual(['company', 'a']);
  });

  it('busy appointments: agent sees own + unassigned, not other agents', () => {
    expect(filterBusyAppointments(rows, 'agent-a').map((r) => r.label)).toEqual(['company', 'a']);
    expect(filterBusyAppointments(rows, null).map((r) => r.label)).toEqual(['company']);
  });
});
