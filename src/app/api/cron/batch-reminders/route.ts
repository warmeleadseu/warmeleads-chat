import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendBatchMilestoneEmail } from '@/lib/email';
import { sendBatchMilestonePush } from '@/lib/pushNotification';
import { verifyCronAuth } from '@/lib/cronAuth';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: batches } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, completed_at')
    .eq('status', 'completed')
    .eq('batch_kind', 'leads')
    .eq('notified_completed', true)
    .eq('notified_reminder', false)
    .lte('completed_at', threeDaysAgo.toISOString());

  if (!batches || batches.length === 0) {
    return NextResponse.json({ message: 'No reminders needed', count: 0 });
  }

  const customerIds = [...new Set(batches.map(b => b.customer_id))];
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, contact_person')
    .in('id', customerIds);

  const customerMap = new Map((customers || []).map(c => [c.id, c]));

  const { data: branchSlugs } = await supabase
    .from('branches')
    .select('slug, name');
  const branchMap = new Map((branchSlugs || []).map(b => [b.slug, b.name]));

  let sent = 0;
  for (const batch of batches) {
    const customer = customerMap.get(batch.customer_id);
    if (!customer) continue;

    const { count: activeCount, error: activeErr } = await supabase
      .from('customer_batches')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', batch.customer_id)
      .eq('branch', batch.branch)
      .eq('batch_kind', 'leads')
      .eq('status', 'active')
      .neq('is_paid', false);

    if (activeErr) continue;

    if ((activeCount || 0) > 0) {
      await supabase.from('customer_batches').update({ notified_reminder: true }).eq('id', batch.id);
      continue;
    }

    const branchName = branchMap.get(batch.branch) || batch.branch;

    sendBatchMilestoneEmail(customer, { ...batch, branch_name: branchName }, 'reminder').catch(() => {});
    sendBatchMilestonePush(customer.id, batch.id, branchName, 'reminder').catch(() => {});

    await supabase.from('customer_batches').update({ notified_reminder: true }).eq('id', batch.id);
    sent++;
  }

  return NextResponse.json({ message: `Sent ${sent} reminders`, count: sent });
}
