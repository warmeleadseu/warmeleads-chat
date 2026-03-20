import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { data: batches, error } = await supabase
    .from('customer_batches')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Kon batches niet ophalen' }, { status: 500 });
  }

  const allBatches = batches || [];

  const branchSlugs = [...new Set(allBatches.map(b => b.branch).filter(Boolean))];
  const { data: branchRows } = branchSlugs.length > 0
    ? await supabase.from('branches').select('slug, name').in('slug', branchSlugs)
    : { data: [] };

  const branchMap: Record<string, string> = {};
  (branchRows || []).forEach(b => { branchMap[b.slug] = b.name; });

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const activeBatches = allBatches.filter(b => b.status === 'active');
  const completedBatches = allBatches.filter(b => b.status === 'completed');

  const activeBatchIds = activeBatches.map(b => b.id);

  let weekAssignments: { batch_id: string; created_at: string }[] = [];
  if (activeBatchIds.length > 0) {
    const { data } = await supabase
      .from('lead_assignments')
      .select('batch_id, created_at')
      .in('batch_id', activeBatchIds)
      .gte('created_at', sevenDaysAgo.toISOString());
    weekAssignments = data || [];
  }

  const active = activeBatches.map(batch => {
    const batchAssignments = weekAssignments.filter(a => a.batch_id === batch.id);
    const leads_per_day = batchAssignments.length / 7;

    const thisWeekAssignments = batchAssignments.filter(
      a => new Date(a.created_at) >= monday
    );

    let estimated_completion: string | null = null;
    if (leads_per_day > 0) {
      const remaining = (batch.batch_size || 0) - (batch.leads_delivered || 0);
      const daysLeft = remaining / leads_per_day;
      const completionDate = new Date(now);
      completionDate.setDate(completionDate.getDate() + daysLeft);
      estimated_completion = completionDate.toISOString();
    }

    return {
      ...batch,
      branch_name: branchMap[batch.branch] || batch.branch,
      leads_per_day: Math.round(leads_per_day * 10) / 10,
      estimated_completion,
      this_week_count: thisWeekAssignments.length,
    };
  });

  const completed = completedBatches.map(batch => {
    const created = new Date(batch.created_at);
    const completedAt = batch.completed_at ? new Date(batch.completed_at) : now;
    const duration_days = Math.round(
      (completedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      ...batch,
      branch_name: branchMap[batch.branch] || batch.branch,
      duration_days,
    };
  });

  return NextResponse.json({ active, completed });
}
