import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { distributeUnassignedLeads } from '@/lib/distribution';

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

  const { customer_id, branch, batch_size, price_per_lead, leads_per_week, notes } = body;
  if (!customer_id || !branch || !batch_size) {
    return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
  }

  const total_price = price_per_lead ? price_per_lead * batch_size : null;

  const { data, error } = await supabase
    .from('customer_batches')
    .insert({ customer_id, branch, batch_size, price_per_lead, total_price, leads_per_week: leads_per_week || null, notes })
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

  // Recalculate total_price when batch_size or price_per_lead changes
  if (updates.batch_size || updates.price_per_lead) {
    if (!updates.price_per_lead || !updates.batch_size) {
      const { data: existing } = await supabase.from('customer_batches').select('price_per_lead, batch_size').eq('id', id).single();
      if (existing) {
        const ppl = updates.price_per_lead ?? existing.price_per_lead;
        const bs = updates.batch_size ?? existing.batch_size;
        if (ppl) updates.total_price = ppl * bs;
      }
    } else {
      updates.total_price = updates.price_per_lead * updates.batch_size;
    }
  }

  const { data, error } = await supabase
    .from('customer_batches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
