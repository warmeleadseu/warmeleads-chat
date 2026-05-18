/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  calendarMonthDateBounds,
  shouldCountAssignmentForAmTargetLead,
} from '@/lib/amTargetsProgress';

describe('shouldCountAssignmentForAmTargetLead', () => {
  const bulk = new Set(['bulk-batch-1']);

  it('counts distribution assignment', () => {
    expect(shouldCountAssignmentForAmTargetLead('distribution', 'batch-1', bulk)).toBe(true);
  });

  it('excludes bulk_export and demo', () => {
    expect(shouldCountAssignmentForAmTargetLead('bulk_export', null, bulk)).toBe(false);
    expect(shouldCountAssignmentForAmTargetLead('demo', 'batch-1', bulk)).toBe(false);
  });

  it('excludes assignment on bulk_leads batch', () => {
    expect(shouldCountAssignmentForAmTargetLead('distribution', 'bulk-batch-1', bulk)).toBe(false);
  });
});

describe('calendarMonthDateBounds', () => {
  it('returns first and last day', () => {
    expect(calendarMonthDateBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(calendarMonthDateBounds('2024-03')).toEqual({ first: '2024-03-01', last: '2024-03-31' });
  });
});
