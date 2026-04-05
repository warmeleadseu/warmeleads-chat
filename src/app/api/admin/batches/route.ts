import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { distributeUnassignedLeads } from '@/lib/distribution';
import { checkBatchMilestones } from '@/lib/batchNotifications';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const customerId = request.nextUrl.searchParams.get('customer_id');

  let query = supabase
    .from('customer_batches')
    .select('*, customers(name)')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();

  const { customer_id, branch, batch_size, price_per_lead, leads_per_week, notes, lead_filters } = body;
  if (!customer_id || !branch || !batch_size) {
    return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
  }

  const total_price = price_per_lead ? price_per_lead * batch_size : null;
  const sanitizedFilters = Array.isArray(lead_filters) ? lead_filters.filter(
    (f: { field?: string; operator?: string; value?: string; values?: string[] }) =>
      f.field && f.operator && ((f.values && f.values.length > 0) || (f.value !== undefined && f.value !== ''))
  ) : [];

  const { data, error } = await supabase
    .from('customer_batches')
    .insert({ customer_id, branch, batch_size, price_per_lead, total_price, leads_per_week: leads_per_week || null, notes, lead_filters: sanitizedFilters })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-distribute recent leads to the new batch (non-blocking)
  try { distributeUnassignedLeads(); } catch { /* non-blocking */ }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  if (updates.lead_filters && Array.isArray(updates.lead_filters)) {
    updates.lead_filters = updates.lead_filters.filter(
      (f: { field?: string; operator?: string; values?: string[]; value?: string }) =>
        f.field && f.operator && ((f.values && f.values.length > 0) || (f.value !== undefined && f.value !== ''))
    );
  }

  const { data: existing } = await supabase
    .from('customer_batches')
    .select('price_per_lead, batch_size, leads_delivered, status')
    .eq('id', id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });

  // Recalculate total_price when batch_size or price_per_lead changes
  if (updates.batch_size || updates.price_per_lead) {
    const ppl = updates.price_per_lead ?? existing.price_per_lead;
    const bs = updates.batch_size ?? existing.batch_size;
    if (ppl) updates.total_price = ppl * bs;
  }

  // Validate leads_delivered
  if (updates.leads_delivered !== undefined) {
    const delivered = Number(updates.leads_delivered);
    if (isNaN(delivered) || delivered < 0) {
      return NextResponse.json({ error: 'Geleverde leads moet 0 of hoger zijn' }, { status: 400 });
    }
    updates.leads_delivered = delivered;

    const batchSize = updates.batch_size ?? existing.batch_size;

    // Auto-update status based on leads_delivered vs batch_size
    if (!updates.status) {
      if (delivered >= batchSize && existing.status !== 'completed') {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      } else if (delivered < batchSize && existing.status === 'completed') {
        updates.status = 'active';
        updates.completed_at = null;
      }
    }
  }

  const { data, error } = await supabase
    .from('customer_batches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger milestone notifications when leads_delivered changes
  if (updates.leads_delivered !== undefined && updates.leads_delivered !== existing.leads_delivered) {
    const batchSize = updates.batch_size ?? existing.batch_size;
    checkBatchMilestones(supabase, id, updates.leads_delivered, batchSize).catch(() => {});
  }

  // When a batch is (re)activated, trigger distribution
  if (updates.status === 'active') {
    try { distributeUnassignedLeads(); } catch { /* non-blocking */ }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { error } = await supabase.from('customer_batches').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
