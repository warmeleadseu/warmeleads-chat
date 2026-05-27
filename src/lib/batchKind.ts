/** Pipeline: verse leads via distributie/backfill */
export type BatchKind = 'leads' | 'niche_research' | 'bulk_leads';

export function normalizeBatchKind(raw: string | null | undefined): BatchKind {
  if (raw === 'niche_research') return 'niche_research';
  if (raw === 'bulk_leads') return 'bulk_leads';
  return 'leads';
}

export function isPipelineBatchKind(kind: string | null | undefined): boolean {
  return normalizeBatchKind(kind) === 'leads';
}

export function isBulkLeadsBatchKind(kind: string | null | undefined): boolean {
  return normalizeBatchKind(kind) === 'bulk_leads';
}

export function isNicheResearchBatchKind(kind: string | null | undefined): boolean {
  return normalizeBatchKind(kind) === 'niche_research';
}

/** Pipeline + onderzoek: Meta-campagne koppelen en ACTIVE/PAUSED sync (niet bulk). */
export function isMetaCampaignSyncBatchKind(kind: string | null | undefined): boolean {
  const k = normalizeBatchKind(kind);
  return k === 'leads' || k === 'niche_research';
}
