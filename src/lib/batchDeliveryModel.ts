import { normalizeBatchKind, type BatchKind } from './batchKind';

/** Hoe voortgang en vol-cap werken — onafhankelijk van batch_size als factuur-eenheid. */
export type BatchDeliveryModel = 'capped' | 'unlimited' | 'manual';

export const DELIVERY_MODEL_LABELS: Record<BatchDeliveryModel, string> = {
  capped: 'Lead-batch (cap)',
  unlimited: 'Onderzoek (doorlopend)',
  manual: 'Bulk / handmatig',
};

export function deliveryModelFromBatchKind(kind: string | null | undefined): BatchDeliveryModel {
  const normalized = normalizeBatchKind(kind);
  if (normalized === 'niche_research') return 'unlimited';
  if (normalized === 'bulk_leads') return 'manual';
  return 'capped';
}

export function normalizeDeliveryModel(
  raw: string | null | undefined,
  batchKind?: string | null,
): BatchDeliveryModel {
  if (raw === 'capped' || raw === 'unlimited' || raw === 'manual') return raw;
  return deliveryModelFromBatchKind(batchKind);
}

export function isCappedDeliveryModel(model: string | null | undefined, batchKind?: string | null): boolean {
  return normalizeDeliveryModel(model, batchKind) === 'capped';
}

export function isUnlimitedDeliveryModel(model: string | null | undefined, batchKind?: string | null): boolean {
  return normalizeDeliveryModel(model, batchKind) === 'unlimited';
}

export function isManualDeliveryModel(model: string | null | undefined, batchKind?: string | null): boolean {
  return normalizeDeliveryModel(model, batchKind) === 'manual';
}

export type BatchProgressInput = {
  delivery_model?: string | null;
  batch_kind?: string | null;
  batch_size: number;
  leads_delivered: number | null;
};

export type BatchProgressView = {
  model: BatchDeliveryModel;
  primaryLabel: string;
  secondaryLabel: string | null;
  progressPercent: number | null;
  showOverdelivery: boolean;
  overdeliveryLabel: string | null;
  remaining: number | null;
  sortProgress: number;
};

export function getBatchProgressView(input: BatchProgressInput): BatchProgressView {
  const model = normalizeDeliveryModel(input.delivery_model, input.batch_kind);
  const delivered = Math.max(0, Number(input.leads_delivered) || 0);
  const size = Math.max(0, Number(input.batch_size) || 0);

  if (model === 'unlimited') {
    const word = delivered === 1 ? 'onderzoekslead' : 'onderzoeksleads';
    return {
      model,
      primaryLabel: `${delivered} ${word}`,
      secondaryLabel: null,
      progressPercent: null,
      showOverdelivery: false,
      overdeliveryLabel: null,
      remaining: null,
      sortProgress: delivered,
    };
  }

  if (model === 'manual') {
    const pct = size > 0 ? Math.min(100, Math.round((delivered / size) * 100)) : 0;
    return {
      model,
      primaryLabel: `${delivered} / ${size}`,
      secondaryLabel: size > 0 ? `(${pct}% in portaal)` : null,
      progressPercent: pct,
      showOverdelivery: false,
      overdeliveryLabel: delivered > size ? `${delivered - size} boven pakket` : null,
      remaining: size > 0 ? Math.max(0, size - delivered) : null,
      sortProgress: size > 0 ? delivered / size : 0,
    };
  }

  const pct = size > 0 ? Math.min(100, Math.round((delivered / size) * 100)) : 0;
  const over = delivered > size ? delivered - size : 0;
  return {
    model,
    primaryLabel: `${delivered} / ${size}`,
    secondaryLabel: `(${pct}%)`,
    progressPercent: pct,
    showOverdelivery: over > 0,
    overdeliveryLabel: over > 0 ? 'overlevering' : null,
    remaining: Math.max(0, size - delivered),
    sortProgress: size > 0 ? delivered / size : 0,
  };
}

export function progressBarColorClass(percent: number): string {
  if (percent >= 100) return 'bg-blue-500';
  if (percent >= 75) return 'bg-emerald-500';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-brand-purple';
}

export function deliveryModelForNewBatch(batchKind: BatchKind | string | null | undefined): BatchDeliveryModel {
  return deliveryModelFromBatchKind(batchKind);
}

/** Of er geen nieuwe pipeline-toewijzingen meer bij mogen (alleen capped). */
export function batchIsAtCapacity(input: BatchProgressInput): boolean {
  if (!isCappedDeliveryModel(input.delivery_model, input.batch_kind)) return false;
  const size = Math.max(0, Number(input.batch_size) || 0);
  if (size <= 0) return false;
  return (Number(input.leads_delivered) || 0) >= size;
}
