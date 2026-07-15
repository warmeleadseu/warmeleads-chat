import type { SupabaseClient } from '@supabase/supabase-js';
import { checkBatchMilestones } from './batchNotifications';
import { isPipelineBatchKind } from './batchKind';
import { isCappedDeliveryModel } from './batchDeliveryModel';
import { reconcileBatchMetaCampaigns } from './metaBatchCampaignSync';

/**
 * Count actual lead_assignments for a batch, add external offset,
 * and sync `leads_delivered`. Automatically marks batch as completed
 * or re-activates it based on count.
 */
export async function syncBatchDelivered(
  supabase: SupabaseClient,
  batchId: string,
): Promise<number> {
  const { count: rowCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId);

  let assignmentCount = rowCount || 0;
  const { data: distinctCount, error: rpcErr } = await supabase.rpc('count_distinct_leads_for_batch', {
    p_batch_id: batchId,
  });
  if (!rpcErr && typeof distinctCount === 'number') {
    assignmentCount = distinctCount;
  }

  const { data: batch } = await supabase
    .from('customer_batches')
    .select('batch_size, status, leads_delivered_external, batch_kind, delivery_model, is_paid')
    .eq('id', batchId)
    .single();

  if (!batch) return assignmentCount;

  const external = batch.leads_delivered_external || 0;
  const delivered = assignmentCount + external;

  const updates: Record<string, unknown> = { leads_delivered: delivered };
  const capped = isCappedDeliveryModel(
    (batch as { delivery_model?: string }).delivery_model,
    (batch as { batch_kind?: string }).batch_kind,
  );

  if (
    capped &&
    delivered >= batch.batch_size &&
    (batch.status === 'active' || batch.status === 'paused')
  ) {
    updates.status = 'completed';
    updates.completed_at = new Date().toISOString();

    // Insert celebration event for live dashboard
    try {
      const { data: batchFull } = await supabase
        .from('customer_batches')
        .select('branch, customer_id, batch_size, customers(name)')
        .eq('id', batchId)
        .single();
      if (batchFull) {
        const custName = (batchFull.customers as any)?.name || 'Onbekend';
        await supabase.from('celebration_events').insert({
          event_type: 'batch_complete',
          payload: {
            customer: custName,
            branch: batchFull.branch,
            batchSize: batchFull.batch_size,
            batchId,
          },
        });
      }
    } catch { /* non-critical */ }
  } else if (capped && delivered < batch.batch_size && batch.status === 'completed') {
    updates.status = batch.is_paid ? 'active' : 'pending_payment';
    updates.completed_at = null;
  }

  await supabase
    .from('customer_batches')
    .update(updates)
    .eq('id', batchId);

  reconcileBatchMetaCampaigns(supabase, batchId, 'batch_sync').catch(() => {});

  if (isPipelineBatchKind((batch as { batch_kind?: string }).batch_kind)) {
    checkBatchMilestones(supabase, batchId, delivered, batch.batch_size).catch(() => {});
  }

  return delivered;
}
