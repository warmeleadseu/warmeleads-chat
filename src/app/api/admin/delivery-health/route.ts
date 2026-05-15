import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { isPipelineBatchKind } from '@/lib/batchKind';
import { beoordeelBatchLevering, fifoHeadBatchIdsVoorLevering, mergeEarliestPaidAtByBatchId } from '@/lib/deliveryHealth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const refresh = request.nextUrl.searchParams.get('refresh') === '1';

  if (refresh) {
    const { error: rpcErr } = await supabase.rpc('refresh_batch_delivery_daily', { p_days: 14 });
    if (rpcErr) {
      return NextResponse.json(
        { error: 'Statistiek verversen mislukt. Controleer of migratie 103 is toegepast.', details: rpcErr.message },
        { status: 500 },
      );
    }
  }

  const { data: dayArr, error: dayErr } = await supabase.rpc('last_n_completed_amsterdam_days', { n: 3 });
  if (dayErr) {
    return NextResponse.json(
      { error: 'Kon kalenderdagen niet ophalen.', details: dayErr.message },
      { status: 500 },
    );
  }

  let rawDays: unknown = dayArr;
  if (rawDays && typeof rawDays === 'object' && !Array.isArray(rawDays)) {
    const o = rawDays as Record<string, unknown>;
    rawDays = o.last_n_completed_amsterdam_days ?? null;
  }
  const dagenYmd = (Array.isArray(rawDays) ? rawDays : [])
    .map(x => String(x).slice(0, 10))
    .filter(Boolean);

  let batchQuery = supabase
    .from('customer_batches')
    .select(
      'id, customer_id, branch, batch_size, leads_delivered, leads_per_day, created_at, starts_at, status, is_paid, batch_kind, customers!inner(name, is_active)',
    )
    .eq('status', 'active')
    .eq('customers.is_active', true)
    .neq('is_paid', false);

  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    const ids = (myCustomers || []).map(c => c.id);
    if (ids.length === 0) {
      return NextResponse.json({
        items: [],
        summary: { goed: 0, let_op: 0, actie: 0, totaal: 0 },
        dagen: dagenYmd,
      });
    }
    batchQuery = batchQuery.in('customer_id', ids);
  }

  const { data: batches, error: bErr } = await batchQuery;
  if (bErr) {
    return NextResponse.json({ error: bErr.message }, { status: 500 });
  }

  const pipeline = (batches || []).filter(
    b =>
      isPipelineBatchKind((b as { batch_kind?: string }).batch_kind) &&
      Number((b as { leads_per_day?: number | null }).leads_per_day) > 0,
  ) as Array<{
    id: string;
    customer_id: string;
    branch: string;
    batch_size: number;
    leads_delivered: number | null;
    leads_per_day: number | null;
    created_at: string;
    starts_at?: string | null;
    customers?: { name?: string | null } | null;
  }>;

  const fifo = fifoHeadBatchIdsVoorLevering(pipeline);
  const heads = pipeline.filter(b => fifo.has(b.id));

  const { data: branchRows } = await supabase.from('branches').select('slug, name');
  const branchLabel = new Map<string, string>();
  for (const r of branchRows || []) {
    if (r.slug) branchLabel.set(r.slug, r.name || r.slug);
  }

  const headIds = heads.map(b => b.id);

  let paidAtByBatch = new Map<string, string>();
  if (headIds.length > 0) {
    const [{ data: invPaid }, { data: ordPaid }] = await Promise.all([
      supabase
        .from('invoices')
        .select('batch_id, paid_at')
        .in('batch_id', headIds)
        .not('paid_at', 'is', null)
        .neq('status', 'credit_note'),
      supabase
        .from('batch_orders')
        .select('batch_id, paid_at')
        .in('batch_id', headIds)
        .eq('status', 'paid')
        .not('paid_at', 'is', null),
    ]);
    paidAtByBatch = mergeEarliestPaidAtByBatchId([...(invPaid || []), ...(ordPaid || [])]);
  }

  const countsByBatch = new Map<string, Map<string, number>>();
  for (const id of headIds) countsByBatch.set(id, new Map());

  if (headIds.length > 0 && dagenYmd.length > 0) {
    const oldest = dagenYmd[0];
    const { data: daily } = await supabase
      .from('batch_delivery_daily')
      .select('batch_id, day_date, delivered_count')
      .in('batch_id', headIds)
      .gte('day_date', oldest);

    for (const row of daily || []) {
      const bid = row.batch_id as string;
      const d = String(row.day_date).slice(0, 10);
      const m = countsByBatch.get(bid);
      if (m) m.set(d, Number(row.delivered_count) || 0);
    }
  }

  const items = heads.map(batch => {
    const m = countsByBatch.get(batch.id) || new Map();
    const paidAt = paidAtByBatch.get(batch.id) ?? null;
    return beoordeelBatchLevering({
      batch: { ...batch, paid_at: paidAt },
      customerName: batch.customers?.name || 'Onbekend',
      branchLabel: branchLabel.get(batch.branch) || batch.branch,
      dagenYmd,
      countsByDay: m,
    });
  });

  items.sort((a, b) => {
    const order = { actie: 0, let_op: 1, goed: 2 };
    const d = order[a.badge] - order[b.badge];
    if (d !== 0) return d;
    return a.customer_name.localeCompare(b.customer_name);
  });

  let goed = 0;
  let let_op = 0;
  let actie = 0;
  for (const it of items) {
    if (it.badge === 'goed') goed++;
    else if (it.badge === 'let_op') let_op++;
    else actie++;
  }

  return NextResponse.json({
    items,
    summary: { goed, let_op, actie, totaal: items.length },
    dagen: dagenYmd,
  });
}
