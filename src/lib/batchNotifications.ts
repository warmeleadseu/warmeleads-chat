import { SupabaseClient } from '@supabase/supabase-js';
import { sendBatchMilestoneEmail, sendHerbestelSignaalEmail } from './email';
import { sendBatchMilestonePush } from './pushNotification';
import { accountmanagerOntvanger } from './accountmanagerOntvanger';

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
    .select('id, customer_id, branch, batch_size, leads_delivered, notified_80pct, notified_completed, account_manager_id, created_at')
    .eq('id', batchId)
    .single();

  if (!batch) return;

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, phone, account_manager_id, intern, demo_mode')
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
    /* Seintje voor de accountmanager, als er nog geen vervolg klaarstaat. */
    void seinAccountmanager(supabase, { batch, customer, branchName, delivered }).catch(() => {});
  }

  if (pct >= 100 && !batch.notified_completed) {
    await supabase.from('customer_batches').update({ notified_completed: true }).eq('id', batchId);
    sendBatchMilestoneEmail(customer, batchInfo, 'completed').catch(() => {});
    sendBatchMilestonePush(customer.id, batchId, branchName, 'completed').catch(() => {});
  }
}

/** Heeft de klant na deze batch al een nieuwe in dezelfde branche (lopend of besteld)? */
export async function heeftVervolg(
  supabase: SupabaseClient,
  batch: { id: string; customer_id: string; branch: string; created_at: string },
): Promise<boolean> {
  const { data } = await supabase
    .from('customer_batches')
    .select('id')
    .eq('customer_id', batch.customer_id)
    .eq('branch', batch.branch)
    .in('status', ['active', 'paused', 'pending_payment'])
    .gt('created_at', batch.created_at)
    .neq('id', batch.id)
    .limit(1);
  return (data ?? []).length > 0;
}

async function seinAccountmanager(
  supabase: SupabaseClient,
  ctx: {
    batch: { id: string; customer_id: string; branch: string; batch_size: number; account_manager_id: string | null; created_at: string };
    customer: { id: string; name: string; email: string | null; contact_person: string | null; phone: string | null; account_manager_id: string | null; intern: boolean | null; demo_mode: boolean | null };
    branchName: string;
    delivered: number;
  },
): Promise<void> {
  const { batch, customer } = ctx;
  if (customer.intern || customer.demo_mode) return;
  if (await heeftVervolg(supabase, batch)) return;
  const naar = await accountmanagerOntvanger(supabase, { batchAm: batch.account_manager_id, klantAm: customer.account_manager_id });
  await sendHerbestelSignaalEmail(naar, {
    soort: 'bijna_op', klant: customer.name, contactpersoon: customer.contact_person, telefoon: customer.phone,
    klantEmail: customer.email, branche: ctx.branchName, geleverd: ctx.delivered, grootte: batch.batch_size,
    batchId: batch.id, customerId: customer.id,
  });
}
