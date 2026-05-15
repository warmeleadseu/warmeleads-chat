/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { beoordeelBatchLevering } from '@/lib/deliveryHealth';

const baseBatch = {
  id: 'b1',
  customer_id: 'c1',
  branch: 'thuisbatterij',
  leads_per_day: 15,
  leads_delivered: 7,
  batch_size: 42,
  starts_at: null as string | null,
};

function counts(...vals: number[]) {
  const m = new Map<string, number>();
  const days = ['2026-05-12', '2026-05-13', '2026-05-14'];
  days.forEach((d, i) => m.set(d, vals[i] ?? 0));
  return m;
}

describe('beoordeelBatchLevering', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tijdens opstartfase: drie dagen ruim onder cap → actie, geen vals “op schema”', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: { ...baseBatch, created_at: '2026-05-13T08:00:00.000Z' },
      customerName: 'Zon Optimaal',
      branchLabel: 'Thuisbatterij',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(0, 5, 2),
    });

    expect(row.badge).toBe('actie');
    expect(row.kop).toContain('opstartfase');
    expect(row.kop).toContain('achter');
  });

  it('na opstartfase: zelfde cijfers blijven actie met standaardkop', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: { ...baseBatch, created_at: '2026-05-10T08:00:00.000Z' },
      customerName: 'X',
      branchLabel: 'Y',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(0, 5, 2),
    });

    expect(row.badge).toBe('actie');
    expect(row.kop).toBe('Duidelijk minder leads per dag dan afgesproken');
  });

  it('tijdens opstartfase: dagen rond of boven drempel → goed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: { ...baseBatch, created_at: '2026-05-13T08:00:00.000Z' },
      customerName: 'X',
      branchLabel: 'Y',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(14, 15, 12),
    });

    expect(row.badge).toBe('goed');
    expect(row.kop).toBe('Nog opstartfase');
  });

  it('twee dagen onder drempel tijdens opstart → let_op', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: { ...baseBatch, created_at: '2026-05-13T08:00:00.000Z' },
      customerName: 'X',
      branchLabel: 'Y',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(14, 5, 2),
    });

    expect(row.badge).toBe('let_op');
    expect(row.kop).toContain('opstartfase');
  });
});
