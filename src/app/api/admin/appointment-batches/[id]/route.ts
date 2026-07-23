import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { markInvoicePaidByAppointmentBatch } from '@/lib/invoice';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const supabase = createServerClient();

  const { data: existing, error: exErr } = await supabase
    .from('appointment_batches')
    .select('id, customer_id, is_paid, status')
    .eq('id', id)
    .single();

  if (exErr || !existing) {
    return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
  }

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id').or(amCustomerAccessOrFilter(admin.id))
      .eq('id', existing.customer_id)
      .single();
    if (!myCust) return NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 });
  }

  const allowed = [
    'status',
    'is_paid',
    'batch_size',
    'price_per_appointment',
    'total_price',
    'appointments_per_week',
    'appointments_per_day',
    'notes',
    'account_manager_id',
    'starts_at',
  ];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) updates[k] = body[k];

  if (body.is_paid === true && existing.is_paid === false) {
    updates.status = 'active';
  }

  const { data, error } = await supabase
    .from('appointment_batches')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Bewerken mislukt' }, { status: 500 });

  if (body.is_paid === true && existing.is_paid === false) {
    markInvoicePaidByAppointmentBatch(id, 'admin-manual').catch(e =>
      console.error('[admin/appointment-batches] markInvoicePaidByAppointmentBatch failed:', e),
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  const supabase = createServerClient();

  const { data: existing, error: exErr } = await supabase
    .from('appointment_batches')
    .select('id, customer_id')
    .eq('id', id)
    .single();

  if (exErr || !existing) {
    return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
  }

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id').or(amCustomerAccessOrFilter(admin.id))
      .eq('id', existing.customer_id)
      .single();
    if (!myCust) return NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 });
  }

  const { error } = await supabase.from('appointment_batches').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message || 'Verwijderen mislukt' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
