import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { validateSlot } from '@/lib/appointmentSlots';
import { sendAppointmentCancelledEmail } from '@/lib/appointmentEmails';
import { sendAppointmentPush } from '@/lib/pushNotification';
import { bereidAfboekingVoor, isAppointmentStatus } from '@/lib/appointmentOutcome';
import { syncAfsprakenBatch } from '@/lib/appointmentBatchSync';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('appointments')
    .select('*, customers(id, name), portal_users(id, name)')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = await request.json();
  const supabase = createServerClient();

  const { data: appt } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle();
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  const passthrough = [
    'contact_name', 'contact_phone', 'contact_email', 'street', 'house_number',
    'postcode', 'city', 'notes', 'portal_user_id', 'batch_id',
  ];
  for (const k of passthrough) if (k in body) updates[k] = body[k];

  if (body.starts_at || body.duration_minutes || body.travel_buffer_minutes != null) {
    const startsAt = new Date(body.starts_at || appt.starts_at);
    const duration = body.duration_minutes ?? appt.duration_minutes;
    const buffer = body.travel_buffer_minutes ?? appt.travel_buffer_minutes;
    if (isNaN(startsAt.getTime())) return NextResponse.json({ error: 'Ongeldige starts_at' }, { status: 400 });
    const validation = await validateSlot({
      customerId: appt.customer_id,
      portalUserId: body.portal_user_id ?? appt.portal_user_id,
      startsAt,
      durationMinutes: duration,
      bufferMinutes: buffer,
      excludeAppointmentId: appt.id,
    });
    if (!validation.valid) return NextResponse.json({ error: validation.reason || 'Slot niet beschikbaar' }, { status: 409 });
    updates.starts_at = startsAt.toISOString();
    updates.duration_minutes = duration;
    updates.travel_buffer_minutes = buffer;
  }

  /* Zelfde afboekregels als in het portaal, uit appointmentOutcome. De admin
     mag wel elke overgang maken: vanuit hier worden fouten van klanten
     rechtgezet, en dan moet ook een verzette afspraak nog te corrigeren zijn. */
  if (body.status) {
    const nieuweStatus: unknown = body.status;
    if (!isAppointmentStatus(nieuweStatus)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
    }
    const afboeking = bereidAfboekingVoor({
      status: nieuweStatus,
      outcome: body.outcome,
      outcome_reason: body.outcome_reason,
      deal_value: body.deal_value,
      cancelled_by: body.cancelled_by,
    });
    if (!afboeking.ok) return NextResponse.json({ error: afboeking.fout }, { status: 400 });
    Object.assign(updates, afboeking.velden);
    if (body.cancelled_reason !== undefined) updates.cancelled_reason = body.cancelled_reason || null;
    if (body.outcome_notes !== undefined) updates.outcome_notes = body.outcome_notes || null;
  } else if (body.outcome_notes !== undefined) {
    updates.outcome_notes = body.outcome_notes || null;
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Bewerken mislukt' }, { status: 500 });

  if (updates.status) await syncAfsprakenBatch(supabase, appt.batch_id);

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { id } = await params;
  const supabase = createServerClient();
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle();
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_reason: 'Geannuleerd door admin' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: 'Annuleren mislukt' }, { status: 500 });

  (async () => {
    try {
      const [custRes, branchRes, assigneeRes] = await Promise.all([
        supabase.from('customers').select('name, email, contact_person').eq('id', appt.customer_id).maybeSingle(),
        supabase.from('branches').select('name').eq('slug', appt.branch).maybeSingle(),
        appt.portal_user_id
          ? supabase.from('portal_users').select('name, email').eq('id', appt.portal_user_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const cust = custRes.data as { name?: string; email?: string; contact_person?: string } | null;
      if (!cust?.email) return;
      const branchName = (branchRes.data as { name?: string } | null)?.name;
      const assignee = (assigneeRes.data as { name?: string; email?: string } | null) || null;
      await sendAppointmentCancelledEmail(
        { name: cust.name || '', email: cust.email, contact_person: cust.contact_person },
        { ...appt, branchName, portal_user_name: assignee?.name || null },
        'Geannuleerd door admin',
      );
      const whenLabel = new Date(appt.starts_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendAppointmentPush(appt.customer_id, 'cancelled', {
        contactName: appt.contact_name,
        whenLabel,
        appointmentId: appt.id,
      });
    } catch (e) {
      console.error('[admin/appointments DELETE notify]', e);
    }
  })().catch(() => {});

  return NextResponse.json({ success: true });
}
