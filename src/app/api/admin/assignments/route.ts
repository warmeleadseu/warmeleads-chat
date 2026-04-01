import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { syncBatchDelivered } from '@/lib/batchSync';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const leadId = request.nextUrl.searchParams.get('lead_id');
  const customerId = request.nextUrl.searchParams.get('customer_id');
  const batchId = request.nextUrl.searchParams.get('batch_id');

  let query = supabase
    .from('lead_assignments')
    .select('*, customers(name), leads(naam_klant, email, branch, postcode, plaatsnaam)')
    .order('assigned_at', { ascending: false });

  if (leadId) query = query.eq('lead_id', leadId);
  if (customerId) query = query.eq('customer_id', customerId);
  if (batchId) query = query.eq('batch_id', batchId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('batch_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('lead_assignments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assignment?.batch_id) {
    await syncBatchDelivered(supabase, assignment.batch_id);
  }

  return NextResponse.json({ ok: true });
}
