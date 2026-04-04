import type { SupabaseClient } from '@supabase/supabase-js';
import { checkBatchMilestones } from './batchNotifications';

/**
 * Count actual lead_assignments for a batch and sync `leads_delivered`.
 * Automatically marks batch as completed or re-activates it based on count.
 * Triggers milestone notifications (80%, 100%) when thresholds are crossed.
 */
export async function syncBatchDelivered(
  supabase: SupabaseClient,
  batchId: string,
): Promise<number> {
  const { count } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId);

  const delivered = count || 0;

  const { data: batch } = await supabase
    .from('customer_batches')
    .select('batch_size, status')
    .eq('id', batchId)
    .single();

  if (!batch) return delivered;

  const updates: Record<string, unknown> = { leads_delivered: delivered };

  if (delivered >= batch.batch_size && batch.status === 'active') {
    updates.status = 'completed';
    updates.completed_at = new Date().toISOString();
  } else if (delivered < batch.batch_size && batch.status === 'completed') {
    updates.status = 'active';
    updates.completed_at = null;
  }

  await supabase
    .from('customer_batches')
    .update(updates)
    .eq('id', batchId);

  checkBatchMilestones(supabase, batchId, delivered, batch.batch_size).catch(() => {});

  return delivered;
}
