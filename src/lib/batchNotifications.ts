import { SupabaseClient } from '@supabase/supabase-js';
import { sendBatchMilestoneEmail } from './email';
import { sendBatchMilestonePush } from './pushNotification';

/**
 * Check a batch after sync and send milestone notifications if needed.
 * Called from batchSync after leads_delivered is updated.
 */
export async function checkBatchMilestones(
  supabase: SupabaseClient,
  batchId: string,
  delivered: number,
  batchSize: number,
): Promise<void> {
  const pct = batchSize > 0 ? (delivered / batchSize) * 100 : 0;

  const { data: batch } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, notified_80pct, notified_completed')
    .eq('id', batchId)
    .single();

  if (!batch) return;

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, contact_person')
    .eq('id', batch.customer_id)
    .single();

  if (!customer) return;

  const { data: branchRow } = await supabase
    .from('branches')
    .select('name')
    .eq('slug', batch.branch)
    .single();

  const branchName = branchRow?.name || batch.branch;

  const batchInfo = {
    id: batch.id,
    branch: batch.branch,
    branch_name: branchName,
    batch_size: batch.batch_size,
    leads_delivered: delivered,
  };

  if (pct >= 80 && pct < 100 && !batch.notified_80pct) {
    await supabase.from('customer_batches').update({ notified_80pct: true }).eq('id', batchId);
    sendBatchMilestoneEmail(customer, batchInfo, '80pct').catch(() => {});
    sendBatchMilestonePush(customer.id, batchId, branchName, '80pct').catch(() => {});
  }

  if (pct >= 100 && !batch.notified_completed) {
    await supabase.from('customer_batches').update({ notified_completed: true }).eq('id', batchId);
    sendBatchMilestoneEmail(customer, batchInfo, 'completed').catch(() => {});
    sendBatchMilestonePush(customer.id, batchId, branchName, 'completed').catch(() => {});
  }
}
