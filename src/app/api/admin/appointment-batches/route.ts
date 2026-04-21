import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');
  const status = url.searchParams.get('status');
  const branch = url.searchParams.get('branch');

  const supabase = createServerClient();
  let q = supabase
    .from('appointment_batches')
    .select('*, customers(id, name)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (customerId) q = q.eq('customer_id', customerId);
  if (status) q = q.eq('status', status);
  if (branch) q = q.eq('branch', branch);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const body = await request.json();
  const {
    customer_id,
    branch,
    batch_size,
    price_per_appointment,
    total_price,
    appointments_per_week,
    appointments_per_day,
    lead_filters,
    is_paid,
    notes,
    account_manager_id,
  } = body;

  if (!customer_id || !branch || !batch_size || !price_per_appointment) {
    return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('appointment_batches')
    .insert({
      customer_id,
      branch,
      batch_size,
      price_per_appointment,
      total_price: total_price ?? (batch_size * price_per_appointment),
      appointments_per_week: appointments_per_week ?? null,
      appointments_per_day: appointments_per_day ?? null,
      lead_filters: lead_filters ?? [],
      is_paid: is_paid ?? false,
      notes: notes ?? null,
      account_manager_id: account_manager_id ?? null,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 });
  return NextResponse.json(data);
}
