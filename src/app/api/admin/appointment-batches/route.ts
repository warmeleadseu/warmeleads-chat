import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { createInvoice, sendNewBatchAdminEmail } from '@/lib/invoice';
import { initialAppointmentBatchStatus } from '@/lib/customerBatchStatus';
import { insertCelebrationEvent } from '@/lib/celebrationInsert';

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

  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    const ids = (myCustomers || []).map(c => c.id);
    if (ids.length === 0) return NextResponse.json([]);
    q = q.in('customer_id', ids);
  }

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
    batch_size: rawBatchSize,
    price_per_appointment: rawPpa,
    total_price: rawTotal,
    appointments_per_week,
    appointments_per_day,
    lead_filters,
    is_paid: rawIsPaid,
    notes,
    starts_at,
    account_manager_id: bodyAmId,
  } = body;

  const sendPaymentEmail = body.send_payment_email !== false;
  const batch_size = Number(rawBatchSize);
  const price_per_appointment = Number(rawPpa);
  const batchIsPaid = rawIsPaid === true;

  if (!customer_id || !branch || !Number.isFinite(batch_size) || batch_size < 1) {
    return NextResponse.json({ error: 'Klant, branche en geldige batch grootte zijn verplicht' }, { status: 400 });
  }
  if (!Number.isFinite(price_per_appointment) || price_per_appointment <= 0) {
    return NextResponse.json({ error: 'Prijs per afspraak is verplicht en moet groter dan 0 zijn' }, { status: 400 });
  }

  const supabase = createServerClient();

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id')
      .eq('account_manager_id', admin.id)
      .eq('id', customer_id)
      .single();
    if (!myCust) return NextResponse.json({ error: 'Geen toegang tot deze klant' }, { status: 403 });
  }

  const { data: branchRow, error: brErr } = await supabase
    .from('branches')
    .select(
      'slug, name, is_active, appointment_min_batch_size, appointment_pricing_tiers, appointment_nationwide_discount',
    )
    .eq('slug', branch)
    .maybeSingle();

  if (brErr || !branchRow?.is_active) {
    return NextResponse.json({ error: 'Onbekende of inactieve branche' }, { status: 400 });
  }

  const minBatch = Number(branchRow.appointment_min_batch_size) || 5;
  if (batch_size < minBatch) {
    return NextResponse.json(
      { error: `Minimum batchgrootte voor afspraken in deze branche is ${minBatch}.` },
      { status: 400 },
    );
  }

  const { data: custRow, error: custErr } = await supabase
    .from('customers')
    .select('name, account_manager_id, country, vat_id')
    .eq('id', customer_id)
    .single();
  if (custErr || !custRow) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }

  const sanitizedFilters = Array.isArray(lead_filters)
    ? lead_filters.filter(
        (f: { field?: string; operator?: string; value?: string; values?: string[] }) =>
          f.field &&
          f.operator &&
          ((f.values && f.values.length > 0) || (f.value !== undefined && f.value !== '')),
      )
    : [];

  const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;
  const total_price =
    rawTotal != null && Number.isFinite(Number(rawTotal))
      ? Number(rawTotal)
      : Math.round(batch_size * price_per_appointment * 100) / 100;

  const amId =
    typeof bodyAmId === 'string' && bodyAmId
      ? bodyAmId
      : (custRow.account_manager_id as string | null) || null;

  const { data, error } = await supabase
    .from('appointment_batches')
    .insert({
      customer_id,
      branch,
      batch_size,
      price_per_appointment,
      total_price,
      appointments_per_week: appointments_per_week ?? null,
      appointments_per_day: appointments_per_day ?? null,
      lead_filters: sanitizedFilters,
      is_paid: batchIsPaid,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      account_manager_id: amId,
      status: initialAppointmentBatchStatus(batchIsPaid),
      starts_at: startsAtValue,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[admin/appointment-batches POST]', error);
    return NextResponse.json({ error: error.message || 'Aanmaken mislukt' }, { status: 500 });
  }

  const brName = branchRow.name || branch;

  sendNewBatchAdminEmail({
    customer_name: custRow.name || 'Onbekend',
    branch_name: `${brName} (afspraken)`,
    batch_size,
    total_price,
    price_per_lead: price_per_appointment,
    is_paid: batchIsPaid,
    source: 'admin',
    is_appointments: true,
    billing_country: (custRow.country as string | null | undefined) ?? 'NL',
    billing_vat_id: custRow.vat_id,
  }).catch(() => {});

  if (price_per_appointment > 0 && total_price > 0) {
    try {
      await createInvoice({
        customer_id,
        appointment_batch_id: data.id,
        branch_name: `${brName} (afspraken)`,
        batch_size,
        price_per_lead: price_per_appointment,
        total_price,
        status: batchIsPaid ? 'paid' : 'open',
        invoice_product: 'appointments',
        ...(batchIsPaid ? { paid_at: new Date().toISOString() } : {}),
        ...(!batchIsPaid ? { email_context: 'new_batch_order' as const, send_payment_email: sendPaymentEmail } : {}),
      });
    } catch (e) {
      console.error('[admin/appointment-batches] invoice creation failed:', e);
    }
  }

  if (batchIsPaid) {
    insertCelebrationEvent(
      supabase,
      custRow.name || 'Onbekend',
      branch,
      Number(total_price || 0),
      customer_id,
      amId,
    ).catch(() => {});
  }

  return NextResponse.json(data, { status: 201 });
}
