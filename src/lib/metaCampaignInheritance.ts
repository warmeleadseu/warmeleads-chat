import type { SupabaseClient } from '@supabase/supabase-js';
import { isPipelineBatchKind } from '@/lib/batchKind';
import { normalizeCampaignIds } from '@/lib/metaBatchCampaignSync';

export type MetaInheritanceSource = 'source_batch' | 'branch_default' | 'latest_batch' | 'none';

export type ResolvedCustomerBatchMeta = {
  meta_campaign_ids: string[];
  meta_campaign_sync_enabled: boolean;
  inheritance_source: MetaInheritanceSource;
};

type SourceBatchRow = {
  customer_id: string;
  branch: string;
  batch_kind: string | null;
  meta_campaign_ids: unknown;
  meta_campaign_sync_enabled: boolean | null;
};

/** Puur testbare waterfall (async resolver vult de argumenten). */
export function applyMetaInheritanceWaterfall(input: {
  orderBranch: string;
  customerId: string;
  sourceBatch: SourceBatchRow | null;
  branchDefault: { meta_campaign_ids: unknown; meta_campaign_sync_enabled: boolean | null } | null;
  historical: Array<{ batch_kind: string | null; meta_campaign_ids: unknown; meta_campaign_sync_enabled: boolean | null }>;
}): ResolvedCustomerBatchMeta {
  const { orderBranch, customerId, sourceBatch, branchDefault, historical } = input;

  if (sourceBatch) {
    if (
      sourceBatch.customer_id === customerId &&
      sourceBatch.branch === orderBranch &&
      isPipelineBatchKind(sourceBatch.batch_kind)
    ) {
      const ids = normalizeCampaignIds(sourceBatch.meta_campaign_ids);
      if (ids.length > 0) {
        return {
          meta_campaign_ids: ids,
          meta_campaign_sync_enabled: sourceBatch.meta_campaign_sync_enabled !== false,
          inheritance_source: 'source_batch',
        };
      }
    }
  }

  if (branchDefault) {
    const ids = normalizeCampaignIds(branchDefault.meta_campaign_ids);
    if (ids.length > 0) {
      return {
        meta_campaign_ids: ids,
        meta_campaign_sync_enabled: branchDefault.meta_campaign_sync_enabled !== false,
        inheritance_source: 'branch_default',
      };
    }
  }

  for (const row of historical) {
    if (!isPipelineBatchKind(row.batch_kind)) continue;
    const ids = normalizeCampaignIds(row.meta_campaign_ids);
    if (ids.length > 0) {
      return {
        meta_campaign_ids: ids,
        meta_campaign_sync_enabled: row.meta_campaign_sync_enabled !== false,
        inheritance_source: 'latest_batch',
      };
    }
  }

  return {
    meta_campaign_ids: [],
    meta_campaign_sync_enabled: true,
    inheritance_source: 'none',
  };
}

export function metaInheritanceNoteSuffix(source: Exclude<MetaInheritanceSource, 'none'>): string {
  const labels: Record<Exclude<MetaInheritanceSource, 'none'>, string> = {
    source_batch: 'bron-batch (portaal)',
    branch_default: 'standaardinstelling klant+branche',
    latest_batch: 'laatste eerdere batch',
  };
  return ` [Meta: campagnes overgenomen — ${labels[source]}]`;
}

/**
 * Bepaalt Meta-campagne-ID(s) voor een nieuwe **leads**-batch: eerst `source_batch_id` op de order
 * (zelfde klant + branche), dan tabel `customer_branch_meta_defaults`, dan laatste pipeline-batch
 * met niet-lege koppeling.
 */
export async function resolveMetaCampaignFieldsForNewLeadBatch(
  supabase: SupabaseClient,
  input: { customerId: string; branch: string; sourceBatchId: string | null | undefined },
): Promise<ResolvedCustomerBatchMeta> {
  const { customerId, branch, sourceBatchId } = input;

  let sourceBatch: SourceBatchRow | null = null;
  if (sourceBatchId) {
    const { data } = await supabase
      .from('customer_batches')
      .select('customer_id, branch, batch_kind, meta_campaign_ids, meta_campaign_sync_enabled')
      .eq('id', sourceBatchId)
      .maybeSingle();
    if (data) sourceBatch = data as SourceBatchRow;
  }

  let branchDefault: { meta_campaign_ids: unknown; meta_campaign_sync_enabled: boolean | null } | null = null;
  const { data: defRow } = await supabase
    .from('customer_branch_meta_defaults')
    .select('meta_campaign_ids, meta_campaign_sync_enabled')
    .eq('customer_id', customerId)
    .eq('branch', branch)
    .maybeSingle();
  if (defRow) branchDefault = defRow;

  const { data: histRows } = await supabase
    .from('customer_batches')
    .select('batch_kind, meta_campaign_ids, meta_campaign_sync_enabled')
    .eq('customer_id', customerId)
    .eq('branch', branch)
    .order('created_at', { ascending: false })
    .limit(40);

  return applyMetaInheritanceWaterfall({
    orderBranch: branch,
    customerId,
    sourceBatch,
    branchDefault,
    historical: (histRows || []) as Array<{
      batch_kind: string | null;
      meta_campaign_ids: unknown;
      meta_campaign_sync_enabled: boolean | null;
    }>,
  });
}

export async function upsertCustomerBranchMetaDefaults(
  supabase: SupabaseClient,
  input: {
    customerId: string;
    branch: string;
    meta_campaign_ids: string[];
    meta_campaign_sync_enabled: boolean;
    updatedBy: string | null;
  },
): Promise<void> {
  const { customerId, branch, meta_campaign_ids, meta_campaign_sync_enabled, updatedBy } = input;
  const ids = normalizeCampaignIds(meta_campaign_ids);

  if (ids.length === 0) {
    await supabase.from('customer_branch_meta_defaults').delete().eq('customer_id', customerId).eq('branch', branch);
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from('customer_branch_meta_defaults').upsert(
    {
      customer_id: customerId,
      branch,
      meta_campaign_ids: ids,
      meta_campaign_sync_enabled,
      updated_at: now,
      updated_by: updatedBy,
    },
    { onConflict: 'customer_id,branch' },
  );
  if (error) throw new Error(error.message);
}
