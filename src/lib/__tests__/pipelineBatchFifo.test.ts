import { describe, expect, it } from 'vitest';
import {
  filterPipelineBatchesToFifoHeads,
  isPipelineFifoHeadBatch,
  pickPipelineFifoHeadBatch,
} from '../pipelineBatchFifo';

const now = new Date('2026-05-27T12:00:00Z');

function batch(
  id: string,
  created: string,
  opts?: { priority?: boolean; delivered?: number; size?: number },
) {
  return {
    id,
    customer_id: 'cust-1',
    branch: 'thuisbatterij',
    created_at: created,
    leads_delivered: opts?.delivered ?? 0,
    batch_size: opts?.size ?? 50,
    distribution_priority: opts?.priority ?? false,
  };
}

describe('pickPipelineFifoHeadBatch', () => {
  it('picks oldest open batch when no priority', () => {
    const head = pickPipelineFifoHeadBatch(
      [batch('b-old', '2026-01-01'), batch('b-new', '2026-06-01')],
      now,
    );
    expect(head?.id).toBe('b-old');
  });

  it('priority batch wins over older open batch', () => {
    const head = pickPipelineFifoHeadBatch(
      [
        batch('b-old', '2026-01-01'),
        batch('b-urgent', '2026-06-01', { priority: true }),
      ],
      now,
    );
    expect(head?.id).toBe('b-urgent');
  });

  it('skips full batches and picks next open', () => {
    const head = pickPipelineFifoHeadBatch(
      [
        batch('b-full', '2026-01-01', { delivered: 50, size: 50 }),
        batch('b-open', '2026-02-01'),
      ],
      now,
    );
    expect(head?.id).toBe('b-open');
  });

  it('priority among two priority batches uses FIFO', () => {
    const head = pickPipelineFifoHeadBatch(
      [
        batch('p2', '2026-06-02', { priority: true }),
        batch('p1', '2026-06-01', { priority: true }),
      ],
      now,
    );
    expect(head?.id).toBe('p1');
  });
});

describe('filterPipelineBatchesToFifoHeads', () => {
  it('keeps one head per customer+branch', () => {
    const rows = [
      batch('a1', '2026-01-01'),
      batch('a2', '2026-02-01'),
      { ...batch('b1', '2026-01-01'), customer_id: 'cust-2' },
    ];
    const filtered = filterPipelineBatchesToFifoHeads(rows, now);
    expect(filtered.map((r) => r.id)).toEqual(['a1', 'b1']);
  });
});

describe('isPipelineFifoHeadBatch', () => {
  it('returns true only for head', () => {
    const siblings = [batch('old', '2026-01-01'), batch('urgent', '2026-06-01', { priority: true })];
    expect(isPipelineFifoHeadBatch(siblings[1], siblings, now)).toBe(true);
    expect(isPipelineFifoHeadBatch(siblings[0], siblings, now)).toBe(false);
  });
});
