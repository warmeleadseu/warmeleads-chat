/**
 * @vitest-environment node
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { beoordeelBatchLevering, mergeEarliestPaidAtByBatchId } from '@/lib/deliveryHealth';

const baseBatch = {
  id: 'b1',
  customer_id: 'c1',
  branch: 'thuisbatterij',
  leads_per_day: 15,
  leads_delivered: 7,
  batch_size: 42,
  starts_at: null as string | null,
  created_at: '2026-05-13T08:00:00.000Z',
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

  it('tijdens opstartfase: meetdagen vanaf aanmaak; 12 mei telt niet mee → twee dagen onder cap → let_op', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: { ...baseBatch, created_at: '2026-05-13T08:00:00.000Z' },
      customerName: 'Zon Optimaal',
      branchLabel: 'Thuisbatterij',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(0, 5, 2),
    });

    expect(row.badge).toBe('let_op');
    expect(row.kop).toContain('opstartfase');
    expect(row.dagen.map(d => d.datum)).toEqual(['2026-05-13', '2026-05-14']);
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

  it('opstart telt vanaf betaaldatum, niet vanaf oude aanmaak; dagen vóór betaling tellen niet mee', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: {
        ...baseBatch,
        created_at: '2026-01-01T08:00:00.000Z',
        paid_at: '2026-05-13T08:00:00.000Z',
      },
      customerName: 'X',
      branchLabel: 'Y',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(0, 5, 2),
    });

    expect(row.badge).toBe('let_op');
    expect(row.kop).toContain('opstartfase');
    expect(row.uitleg).toContain('kort betaald');
    expect(row.dagen.map(d => d.datum)).toEqual(['2026-05-13', '2026-05-14']);
  });

  it('eerste betaling vandaag: geen voltooide meetdag in venster → goed, Net gestart', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: {
        ...baseBatch,
        created_at: '2026-05-10T08:00:00.000Z',
        paid_at: '2026-05-15T10:00:00.000Z',
      },
      customerName: 'LBS',
      branchLabel: 'Thuisbatterij',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(0, 0, 0),
    });

    expect(row.badge).toBe('goed');
    expect(row.kop).toBe('Net gestart');
    expect(row.dagen).toHaveLength(0);
    expect(row.uitleg).toContain('eerste betaling');
  });

  it('meer dan vier kalenderdagen na betaling: geen opstart-kop meer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

    const row = beoordeelBatchLevering({
      batch: {
        ...baseBatch,
        created_at: '2026-01-01T08:00:00.000Z',
        paid_at: '2026-05-10T08:00:00.000Z',
      },
      customerName: 'X',
      branchLabel: 'Y',
      dagenYmd: ['2026-05-12', '2026-05-13', '2026-05-14'],
      countsByDay: counts(0, 5, 2),
    });

    expect(row.badge).toBe('actie');
    expect(row.kop).toBe('Duidelijk minder leads per dag dan afgesproken');
    expect(row.uitleg).not.toContain('kort betaald');
  });
});

describe('mergeEarliestPaidAtByBatchId', () => {
  it('kiest vroegste paid_at per batch', () => {
    const m = mergeEarliestPaidAtByBatchId([
      { batch_id: 'a', paid_at: '2026-05-14T10:00:00.000Z' },
      { batch_id: 'a', paid_at: '2026-05-12T08:00:00.000Z' },
      { batch_id: 'b', paid_at: '2026-05-10T00:00:00.000Z' },
    ]);
    expect(m.get('a')).toBe('2026-05-12T08:00:00.000Z');
    expect(m.get('b')).toBe('2026-05-10T00:00:00.000Z');
  });
});
