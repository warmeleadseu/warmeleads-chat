import { isPipelineBatchOpenForInbound } from './distribution';

/** Minimale velden voor FIFO-kop per klant+branche (incl. voorrang). */
export type PipelineFifoBatchRow = {
  id: string;
  customer_id: string;
  branch: string;
  created_at: string;
  leads_delivered: number | null;
  batch_size: number;
  starts_at?: string | null;
  delivery_model?: string | null;
  batch_kind?: string | null;
  distribution_priority?: boolean | null;
};

function priorityRank(b: PipelineFifoBatchRow): number {
  return b.distribution_priority === true ? 1 : 0;
}

/**
 * Kiest de pipeline-batch die nieuwe leads ontvangt binnen één klant+branche.
 * Voorrang-batch wint van oudere open batches; daarna FIFO op created_at.
 */
export function pickPipelineFifoHeadBatch<T extends PipelineFifoBatchRow>(
  batches: T[],
  now: Date = new Date(),
): T | null {
  const open = batches.filter((b) => isPipelineBatchOpenForInbound(b, now));
  if (open.length === 0) return null;

  open.sort((a, b) => {
    const pr = priorityRank(b) - priorityRank(a);
    if (pr !== 0) return pr;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return open[0];
}

/**
 * Filtert naar batches die de FIFO-kop zijn (per customer_id + branch).
 */
export function filterPipelineBatchesToFifoHeads<T extends PipelineFifoBatchRow>(
  batches: T[],
  now: Date = new Date(),
): T[] {
  const byKey = new Map<string, T[]>();
  for (const b of batches) {
    const key = `${b.customer_id}|${b.branch}`;
    const list = byKey.get(key);
    if (list) list.push(b);
    else byKey.set(key, [b]);
  }

  const keep = new Set<string>();
  for (const list of byKey.values()) {
    const head = pickPipelineFifoHeadBatch(list, now);
    if (head) keep.add(head.id);
  }

  return batches.filter((b) => keep.has(b.id));
}

export function isPipelineFifoHeadBatch<T extends PipelineFifoBatchRow>(
  batch: T,
  siblings: T[],
  now: Date = new Date(),
): boolean {
  const head = pickPipelineFifoHeadBatch(siblings, now);
  return head?.id === batch.id;
}
