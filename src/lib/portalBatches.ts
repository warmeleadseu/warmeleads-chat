/** Minimale batch-vorm voor portaal-logica (customer_batches + appointment_batches). */
export type PortalBatchLike = {
  id: string;
  branch?: string | null;
  branch_name?: string | null;
  batch_size?: number;
  leads_delivered?: number;
  status?: string | null;
  is_paid?: boolean | null;
  total_price?: number | null;
  price_per_lead?: number | null;
  price_per_appointment?: number | null;
  batch_product?: 'leads' | 'appointments';
  batch_name?: string | null;
  created_at?: string;
  delivery_model?: string | null;
  batch_kind?: string | null;
};

export function isPortalBatchAwaitingPayment(batch: PortalBatchLike): boolean {
  if (batch.status === 'pending_payment') return true;
  if (batch.is_paid === false) return true;
  return false;
}

export function sortPortalBatchesNewestFirst<T extends { created_at?: string }>(batches: T[]): T[] {
  return [...batches].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );
}

/** Alle batches die nog betaald moeten worden (admin heeft ze klaargezet). */
export function collectPortalBatchesAwaitingPayment(groups: {
  pending_payment?: PortalBatchLike[];
  active?: PortalBatchLike[];
}): PortalBatchLike[] {
  const pending = groups.pending_payment || [];
  const seen = new Set(pending.map(b => b.id));
  const extra = (groups.active || []).filter(
    b => isPortalBatchAwaitingPayment(b) && !seen.has(b.id),
  );
  return sortPortalBatchesNewestFirst([...pending, ...extra]);
}

/** Actieve (betaalde) batch voor voortgang — niet de openstaande betalingen. */
export function pickPortalProgressBatch(groups: {
  active?: PortalBatchLike[];
}): PortalBatchLike | null {
  const active = (groups.active || []).filter(b => !isPortalBatchAwaitingPayment(b));
  if (active.length === 0) return null;
  return [...active].sort((a, b) => {
    const aSize = Number(a.batch_size || 0);
    const bSize = Number(b.batch_size || 0);
    const aPct = aSize > 0 ? Number(a.leads_delivered || 0) / aSize : 0;
    const bPct = bSize > 0 ? Number(b.leads_delivered || 0) / bSize : 0;
    return bPct - aPct;
  })[0];
}

/**
 * Batch als sjabloon voor een vervolgbestelling (actief/voltooid).
 * Openstaande `pending_payment` batches worden niet gebruikt — die zijn alleen om te betalen.
 */
export function pickPortalReorderSourceBatch(
  batches: PortalBatchLike[],
  branch: string,
  explicitBatchId?: string | null,
): PortalBatchLike | null {
  const inBranch = batches.filter(b => (b.branch || '') === branch);
  if (explicitBatchId) {
    const explicit = inBranch.find(b => b.id === explicitBatchId);
    if (explicit) {
      if (isPortalBatchAwaitingPayment(explicit)) return null;
      return explicit;
    }
  }
  const statusRank = (s?: string | null) =>
    s === 'active' ? 0 : s === 'paused' ? 1 : s === 'completed' ? 2 : 9;
  const candidates = inBranch.filter(b => !isPortalBatchAwaitingPayment(b));
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => statusRank(a.status) - statusRank(b.status))[0];
}

export function portalBatchUnitLabel(batch: PortalBatchLike): 'leads' | 'afspraken' {
  return batch.batch_product === 'appointments' ? 'afspraken' : 'leads';
}

export function portalBatchPricePerUnit(batch: PortalBatchLike): number {
  if (batch.batch_product === 'appointments') {
    return Number(batch.price_per_appointment ?? 0);
  }
  return Number(batch.price_per_lead ?? 0);
}
