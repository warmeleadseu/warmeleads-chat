import { describe, expect, it } from 'vitest';
import {
  collectPortalBatchesAwaitingPayment,
  isPortalBatchAwaitingPayment,
  pickPortalProgressBatch,
  pickPortalReorderSourceBatch,
} from '@/lib/portalBatches';

describe('portalBatches', () => {
  it('detects awaiting payment', () => {
    expect(isPortalBatchAwaitingPayment({ id: '1', status: 'pending_payment' })).toBe(true);
    expect(isPortalBatchAwaitingPayment({ id: '2', status: 'active', is_paid: false })).toBe(true);
    expect(isPortalBatchAwaitingPayment({ id: '3', status: 'active', is_paid: true })).toBe(false);
  });

  it('collects all unpaid batches without duplicates', () => {
    const list = collectPortalBatchesAwaitingPayment({
      pending_payment: [
        { id: 'a', status: 'pending_payment', created_at: '2026-01-02' },
        { id: 'b', status: 'pending_payment', created_at: '2026-01-03' },
      ],
      active: [{ id: 'b', status: 'pending_payment', is_paid: false, created_at: '2026-01-01' }],
    });
    expect(list.map(b => b.id)).toEqual(['b', 'a']);
  });

  it('picks progress batch only from paid actives', () => {
    const p = pickPortalProgressBatch({
      active: [
        { id: '1', status: 'pending_payment', batch_size: 100, leads_delivered: 0 },
        { id: '2', status: 'active', is_paid: true, batch_size: 50, leads_delivered: 40 },
        { id: '3', status: 'active', is_paid: true, batch_size: 50, leads_delivered: 10 },
      ],
    });
    expect(p?.id).toBe('2');
  });

  it('does not use pending batch as reorder source', () => {
    const batches = [
      { id: 'pending', branch: 'airco', status: 'pending_payment', is_paid: false },
      { id: 'done', branch: 'airco', status: 'completed', is_paid: true },
    ];
    expect(pickPortalReorderSourceBatch(batches, 'airco', 'pending')).toBeNull();
    expect(pickPortalReorderSourceBatch(batches, 'airco')?.id).toBe('done');
  });
});
