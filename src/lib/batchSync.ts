import type { SupabaseClient } from '@supabase/supabase-js';
import { checkBatchMilestones } from './batchNotifications';
import { isPipelineBatchKind } from './batchKind';
import { isCappedDeliveryModel } from './batchDeliveryModel';
import { reconcileBatchMetaCampaigns } from './metaBatchCampaignSync';
import { countDistinctLeadsForBatch } from './batchDelivered';

/**
 * Count actual lead_assignments for a batch, add external offset,
 * and sync `leads_delivered`. Automatically marks batch as completed
 * or re-activates it based on count.
 */
export async function syncBatchDelivered(
  supabase: SupabaseClient,
  batchId: string,
): Promise<number> {
  /* Dezelfde bron als de capaciteitscheck in `distributeLead`: unieke leads.
     Twee verschillende tellingen (hier distinct, daar rijen) hielden een volle
     batch negentien dagen "open" en legden de verdeling in zes provincies stil. */
  const assignmentCount = await countDistinctLeadsForBatch(supabase, batchId);

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
