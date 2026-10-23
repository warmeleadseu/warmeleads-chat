import type { SupabaseClient } from '@supabase/supabase-js';
import { isNicheResearchBatchKind, isPipelineBatchKind } from '@/lib/batchKind';
import { normalizeCampaignIds, sanitizePausedMetaCampaignIds } from '@/lib/metaBatchCampaignSync';
import { normaliseerExclusief, normaliseerUitgesloten, type ExclusiefModus } from '@/lib/campagneExclusiviteit';

export type MetaInheritanceSource = 'source_batch' | 'branch_default' | 'latest_batch' | 'none';

export type ResolvedCustomerBatchMeta = {
  meta_campaign_ids: string[];
  meta_campaign_paused_ids: string[];
  meta_campaign_sync_enabled: boolean;
  /** Exclusieve en uitgesloten campagnes gaan mee met de koppeling (zie campagneExclusiviteit.ts). */
  meta_campagne_exclusief: Record<string, ExclusiefModus>;
  meta_campagne_uitgesloten: string[];
  inheritance_source: MetaInheritanceSource;
};

type SourceBatchRow = {
  customer_id: string;
  branch: string;
  batch_kind: string | null;
  meta_campaign_ids: unknown;
  meta_campaign_paused_ids?: unknown;
  meta_campaign_sync_enabled: boolean | null;
  meta_campagne_exclusief?: unknown;
  meta_campagne_uitgesloten?: unknown;
};

type MetaInheritRow = {
  batch_kind: string | null;
  meta_campaign_ids: unknown;
  meta_campaign_paused_ids?: unknown;
  meta_campaign_sync_enabled: boolean | null;
  meta_campagne_exclusief?: unknown;
  meta_campagne_uitgesloten?: unknown;
};

function resolvedFromRow(
  row: {
    meta_campaign_ids: unknown; meta_campaign_paused_ids?: unknown; meta_campaign_sync_enabled: boolean | null;
    meta_campagne_exclusief?: unknown; meta_campagne_uitgesloten?: unknown;
  },
  source: MetaInheritanceSource,
): ResolvedCustomerBatchMeta {
  const meta_campaign_ids = normalizeCampaignIds(row.meta_campaign_ids);
  return {
    meta_campaign_ids,
    meta_campaign_paused_ids: sanitizePausedMetaCampaignIds(meta_campaign_ids, row.meta_campaign_paused_ids),
    meta_campaign_sync_enabled: row.meta_campaign_sync_enabled !== false,
    meta_campagne_exclusief: normaliseerExclusief(row.meta_campagne_exclusief, meta_campaign_ids),
    meta_campagne_uitgesloten: normaliseerUitgesloten(row.meta_campagne_uitgesloten, meta_campaign_ids),
    inheritance_source: source,
  };
}

/** Puur testbare waterfall (async resolver vult de argumenten). */
export function applyMetaInheritanceWaterfall(input: {
  orderBranch: string;
  customerId: string;
  sourceBatch: SourceBatchRow | null;
  branchDefault: {
    meta_campaign_ids: unknown;
    meta_campaign_paused_ids?: unknown;
    meta_campaign_sync_enabled: boolean | null;
    meta_campagne_exclusief?: unknown;
    meta_campagne_uitgesloten?: unknown;
  } | null;
  historical: MetaInheritRow[];
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
        return resolvedFromRow(sourceBatch, 'source_batch');
      }
    }
  }

  if (branchDefault) {
    const ids = normalizeCampaignIds(branchDefault.meta_campaign_ids);
    if (ids.length > 0) {
      return resolvedFromRow(branchDefault, 'branch_default');
    }
  }

  for (const row of historical) {
    if (!isPipelineBatchKind(row.batch_kind) && !isNicheResearchBatchKind(row.batch_kind)) continue;
    const ids = normalizeCampaignIds(row.meta_campaign_ids);
    if (ids.length > 0) {
      return resolvedFromRow(row, 'latest_batch');
    }
  }

  return {
    meta_campaign_ids: [],
    meta_campaign_paused_ids: [],
    meta_campaign_sync_enabled: true,
    meta_campagne_exclusief: {},
    meta_campagne_uitgesloten: [],
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
      .select('customer_id, branch, batch_kind, meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled, meta_campagne_exclusief, meta_campagne_uitgesloten')
      .eq('id', sourceBatchId)
      .maybeSingle();
    if (data) sourceBatch = data as SourceBatchRow;
  }

  let branchDefault: {
    meta_campaign_ids: unknown;
    meta_campaign_paused_ids?: unknown;
    meta_campaign_sync_enabled: boolean | null;
    meta_campagne_exclusief?: unknown;
    meta_campagne_uitgesloten?: unknown;
  } | null = null;
  const { data: defRow } = await supabase
    .from('customer_branch_meta_defaults')
    .select('meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled, meta_campagne_exclusief, meta_campagne_uitgesloten')
    .eq('customer_id', customerId)
    .eq('branch', branch)
    .maybeSingle();
  if (defRow) branchDefault = defRow;

  const { data: histRows } = await supabase
    .from('customer_batches')
    .select('batch_kind, meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled, meta_campagne_exclusief, meta_campagne_uitgesloten')
    .eq('customer_id', customerId)
    .eq('branch', branch)
    .order('created_at', { ascending: false })
    .limit(40);

  const { data: nicheHistRows } = await supabase
    .from('customer_batches')
    .select('batch_kind, meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled, meta_campagne_exclusief, meta_campagne_uitgesloten')
    .eq('customer_id', customerId)
    .eq('batch_kind', 'niche_research')
    .eq('lead_branch_slug', branch)
    .order('created_at', { ascending: false })
    .limit(10);

  const historical = [
    ...((histRows || []) as MetaInheritRow[]),
    ...((nicheHistRows || []) as MetaInheritRow[]),
  ];

  return applyMetaInheritanceWaterfall({
    orderBranch: branch,
    customerId,
    sourceBatch,
    branchDefault,
    historical,
  });
}

export async function upsertCustomerBranchMetaDefaults(
  supabase: SupabaseClient,
  input: {
    customerId: string;
    branch: string;
    meta_campaign_ids: string[];
    meta_campaign_paused_ids?: string[];
    meta_campaign_sync_enabled: boolean;
    meta_campagne_exclusief?: unknown;
    meta_campagne_uitgesloten?: unknown;
    updatedBy: string | null;
  },
): Promise<void> {
  const { customerId, branch, meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled, updatedBy } =
    input;
  const ids = normalizeCampaignIds(meta_campaign_ids);
  const paused = sanitizePausedMetaCampaignIds(ids, meta_campaign_paused_ids ?? []);

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
      meta_campaign_paused_ids: paused,
      meta_campaign_sync_enabled,
      meta_campagne_exclusief: normaliseerExclusief(input.meta_campagne_exclusief, ids),
      meta_campagne_uitgesloten: normaliseerUitgesloten(input.meta_campagne_uitgesloten, ids),
      updated_at: now,
      updated_by: updatedBy,
    },
    { onConflict: 'customer_id,branch' },
  );
  if (error) throw new Error(error.message);
}
