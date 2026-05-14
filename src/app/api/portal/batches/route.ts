import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_VIEW)) return forbidden();

  const { customer } = session;

  const supabase = createServerClient();

  /** Cap voor customer_batches. Een klant heeft realistisch nooit duizenden batches; veilig. */
  const BATCHES_CAP = 500;
  const { data: batches, error } = await supabase
    .from('customer_batches')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(BATCHES_CAP + 1);

  if (error) {
    return NextResponse.json({ error: 'Kon batches niet ophalen' }, { status: 500 });
  }

  const fetched = batches || [];
  const batchesPartial = fetched.length > BATCHES_CAP;
  const allBatches = batchesPartial ? fetched.slice(0, BATCHES_CAP) : fetched;

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
  const pendingPaymentBatches = allBatches.filter(b => b.status === 'pending_payment');
  const completedBatches = allBatches.filter(b => b.status === 'completed');

  const activeBatchIds = activeBatches.map(b => b.id);

  /** Cap voor week-assignments scan. Voldoende voor avg-berekening; voorkomt onbegrensde lees. */
  const WEEK_ASSIGN_CAP = 25_000;
  let weekAssignments: { batch_id: string; created_at: string }[] = [];
  let assignmentsPartial = false;
  if (activeBatchIds.length > 0) {
    const PAGE_SIZE = 1000;
    for (let offset = 0; offset < WEEK_ASSIGN_CAP; offset += PAGE_SIZE) {
      const take = Math.min(PAGE_SIZE, WEEK_ASSIGN_CAP - offset);
      const { data } = await supabase
        .from('lead_assignments')
        .select('batch_id, created_at')
        .in('batch_id', activeBatchIds)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + take - 1);
      if (!data?.length) break;
      weekAssignments.push(...data);
      if (data.length < take) break;
      if (offset + take >= WEEK_ASSIGN_CAP) assignmentsPartial = true;
    }
  }

  const active = activeBatches.map(batch => {
    const batchAssignments = weekAssignments.filter(a => a.batch_id === batch.id);
    const avg_leads_per_day = batchAssignments.length / 7;

    const thisWeekAssignments = batchAssignments.filter(
      a => new Date(a.created_at) >= monday
    );

    let estimated_completion: string | null = null;
    if (avg_leads_per_day > 0) {
      const remaining = (batch.batch_size || 0) - (batch.leads_delivered || 0);
      const daysLeft = remaining / avg_leads_per_day;
      const completionDate = new Date(now);
      completionDate.setDate(completionDate.getDate() + daysLeft);
      estimated_completion = completionDate.toISOString();
    }

    return {
      ...batch,
      branch_name: branchMap[batch.branch] || batch.branch,
      avg_leads_per_day: Math.round(avg_leads_per_day * 10) / 10,
      estimated_completion,
      this_week_count: thisWeekAssignments.length,
    };
  });

  const completed = completedBatches.map(batch => {
    const created = new Date(batch.created_at);
    const completedAt = batch.completed_at ? new Date(batch.completed_at) : now;
    const duration_days = Math.max(1, Math.round(
      (completedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    ));

    return {
      ...batch,
      branch_name: branchMap[batch.branch] || batch.branch,
      duration_days,
    };
  });

  const partial = batchesPartial || assignmentsPartial;
  if (partial) {
    console.info('[portal/batches]', {
      customerId: customer.id,
      batches: allBatches.length,
      batchesPartial,
      weekAssignments: weekAssignments.length,
      assignmentsPartial,
    });
  }

  const pending = pendingPaymentBatches.map(batch => ({
    ...batch,
    branch_name: branchMap[batch.branch] || batch.branch,
    avg_leads_per_day: 0,
    estimated_completion: null as string | null,
    this_week_count: 0,
  }));

  return NextResponse.json({
    active,
    pending_payment: pending,
    completed,
    partial,
    batchesPartial,
    assignmentsPartial,
    maxBatches: BATCHES_CAP,
    maxWeekAssignments: WEEK_ASSIGN_CAP,
  });
}
