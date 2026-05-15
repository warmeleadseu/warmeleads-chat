/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { calendarMonthDateBounds } from '@/lib/amTargetsProgress';

describe('calendarMonthDateBounds', () => {
  it('returns first and last day', () => {
    expect(calendarMonthDateBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(calendarMonthDateBounds('2024-03')).toEqual({ first: '2024-03-01', last: '2024-03-31' });
  });
});
