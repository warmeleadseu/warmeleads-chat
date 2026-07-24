import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { validateSlot } from '@/lib/appointmentSlots';
import { pickAppointmentAssignee } from '@/lib/appointmentAssignment';
import { sendAppointmentCreatedEmail } from '@/lib/appointmentEmails';
import { maybeSendLeadThuisbatterijConfirmation } from '@/lib/leadThuisbatterijAppointmentEmails';
import { sendAppointmentPush } from '@/lib/pushNotification';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  const branch = url.searchParams.get('branch');
  const batchId = url.searchParams.get('batch_id');
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam) || 100, 500) : 100;

  const supabase = createServerClient();
  let q = supabase
    .from('appointments')
    .select('*, customers!inner(id, name), portal_users(id, name)')
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (customerId) q = q.eq('customer_id', customerId);
  if (from) q = q.gte('starts_at', from);
  if (to) q = q.lte('starts_at', to);
  if (status) q = q.eq('status', status);
  if (branch) q = q.eq('branch', branch);
  if (batchId) q = q.eq('batch_id', batchId);

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
    portal_user_id,
    starts_at,
    duration_minutes,
    travel_buffer_minutes,
    contact_name,
    contact_phone,
    contact_email,
    street,
    house_number,
    postcode,
    city,
    notes,
    lead_id,
    lead_assignment_id,
    batch_id,
  } = body;

  if (!customer_id || !branch || !starts_at || !contact_name) {
    return NextResponse.json({ error: 'customer_id, branch, starts_at en contact_name zijn verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: branchRow } = await supabase
    .from('branches')
    .select('slug, default_appointment_duration, default_travel_buffer, is_active')
    .eq('slug', branch)
    .maybeSingle();
  if (!branchRow || !branchRow.is_active) {
    return NextResponse.json({ error: 'Onbekende branche' }, { status: 400 });
  }

  const duration = Number.isFinite(duration_minutes) ? duration_minutes : branchRow.default_appointment_duration || 60;
  const buffer = Number.isFinite(travel_buffer_minutes) ? travel_buffer_minutes : branchRow.default_travel_buffer ?? 0;

  const startsAtDate = new Date(starts_at);
  if (isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: 'Ongeldige starts_at' }, { status: 400 });
  }

  // Auto-pick assignee if not specified
  let resolvedPortalUserId: string | null = portal_user_id ?? null;
  if (resolvedPortalUserId === null && body.auto_assign !== false) {
    resolvedPortalUserId = await pickAppointmentAssignee(customer_id, {
      branch,
      postcode,
      starts_at: startsAtDate.toISOString(),
    });
  }

  const validation = await validateSlot({
    customerId: customer_id,
    portalUserId: resolvedPortalUserId,
    startsAt: startsAtDate,
    durationMinutes: duration,
    bufferMinutes: buffer,
  });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason || 'Slot niet beschikbaar' }, { status: 409 });
  }

  let resolvedBatchId: string | null = batch_id ?? null;
  if (!resolvedBatchId) {
    const { data: b } = await supabase
      .from('appointment_batches')
      .select('id')
      .eq('customer_id', customer_id)
      .eq('branch', branch)
      .eq('is_paid', true)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (b) resolvedBatchId = b.id;
  }

  const insert = {
    customer_id,
    portal_user_id: resolvedPortalUserId,
    branch,
    batch_id: resolvedBatchId,
    lead_id: lead_id || null,
    lead_assignment_id: lead_assignment_id || null,
    contact_name: contact_name.trim(),
    contact_phone: contact_phone || null,
    contact_email: contact_email || null,
    street: street || null,
    house_number: house_number || null,
    postcode: postcode || null,
    city: city || null,
    starts_at: startsAtDate.toISOString(),
    duration_minutes: duration,
    travel_buffer_minutes: buffer,
    notes: notes || null,
    source: 'admin_booked',
    created_by_admin_id: admin.id,
  };

  const { data, error } = await supabase
    .from('appointments')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    console.error('[admin/appointments POST]', error);
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 });
  }

  (async () => {
    try {
      const [custRes, branchRes, assigneeRes] = await Promise.all([
        supabase.from('customers').select('name, email, contact_person').eq('id', customer_id).maybeSingle(),
        supabase.from('branches').select('name').eq('slug', branch).maybeSingle(),
        resolvedPortalUserId
          ? supabase.from('portal_users').select('name, email').eq('id', resolvedPortalUserId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const cust = custRes.data as { name?: string; email?: string; contact_person?: string } | null;
      const branchName = (branchRes.data as { name?: string } | null)?.name;
      const assignee = (assigneeRes.data as { name?: string; email?: string } | null) || null;
      if (cust?.email) {
        await sendAppointmentCreatedEmail(
          { name: cust.name || '', email: cust.email, contact_person: cust.contact_person },
          { ...data, branchName, portal_user_name: assignee?.name || null },
          assignee?.email ? { name: assignee.name || '', email: assignee.email } : undefined,
        );
      }
      await maybeSendLeadThuisbatterijConfirmation(data);
      const whenLabel = new Date(data.starts_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendAppointmentPush(customer_id, 'created', {
        contactName: data.contact_name,
        whenLabel,
        appointmentId: data.id,
      });
    } catch (e) {
      console.error('[admin/appointments post-notify]', e);
    }
  })().catch(() => {});

  return NextResponse.json(data);
}
