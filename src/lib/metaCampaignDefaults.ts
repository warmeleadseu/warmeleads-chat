import { coerceCustomerBatchMetaCampaignIds } from '@/lib/metaCampaignIds';

/** Set-equality voor meta-campaign-ID lijsten (volgorde-onafhankelijk). */
export function metaIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const id of b) if (!sa.has(id)) return false;
  return true;
}

export type BranchDefaultSnapshot = {
  meta_campaign_ids: string[];
  meta_campaign_paused_ids: string[];
  meta_campaign_sync_enabled: boolean;
};

export type BatchMetaSnapshot = {
  meta_campaign_ids?: unknown;
  meta_campaign_paused_ids?: unknown;
  meta_campaign_sync_enabled?: boolean | null;
};

/**
 * Bepaalt of `defaults` exact matched met de huidige meta-staat van een batch:
 *  - zelfde set actieve meta_campaign_ids;
 *  - zelfde set paused-ids;
 *  - zelfde sync-vlag.
 *
 * Wordt gebruikt om het "Standaard voor nieuwe batches"-vinkje match-aware te
 * initialiseren in admin/batches: alleen `true` als deze batch's koppeling
 * daadwerkelijk de actieve standaard voor klant + (lead-)branche is. Zo
 * voorkomen we dat een save op batch Y stilletjes de default die door batch
 * X is gezet overschrijft.
 */
export function batchMatchesBranchDefault(
  batch: BatchMetaSnapshot,
  defaults: BranchDefaultSnapshot,
): boolean {
  const batchIds = coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_ids);
  if (!metaIdsEqual(batchIds, defaults.meta_campaign_ids)) return false;
  const batchPaused = coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_paused_ids);
  if (!metaIdsEqual(batchPaused, defaults.meta_campaign_paused_ids)) return false;
  const batchSync = batch.meta_campaign_sync_enabled !== false;
  return batchSync === defaults.meta_campaign_sync_enabled;
}
