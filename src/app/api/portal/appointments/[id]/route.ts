import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { validateSlot } from '@/lib/appointmentSlots';
import { sendAppointmentCancelledEmail } from '@/lib/appointmentEmails';
import { sendAppointmentPush } from '@/lib/pushNotification';

async function loadAppointment(id: string, customerId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) return forbidden();
  const { id } = await params;
  const appt = await loadAppointment(id, session.customer.id);
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  if (session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    if (appt.portal_user_id !== session.portalUser.id) {
      return forbidden('Geen toegang');
    }
  }
  return NextResponse.json(appt);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const { id } = await params;
  const appt = await loadAppointment(id, session.customer.id);
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  if (session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    if (appt.portal_user_id !== session.portalUser.id) {
      return forbidden('Geen toegang');
    }
  }

  const body = await request.json();
  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};

  const allowed = [
    'contact_name', 'contact_phone', 'contact_email', 'street', 'house_number',
    'postcode', 'city', 'notes',
  ];
  for (const k of allowed) if (k in body) updates[k] = body[k];

  // Reschedule?
  if (body.starts_at || body.duration_minutes || body.travel_buffer_minutes != null) {
    const startsAt = new Date(body.starts_at || appt.starts_at);
    const duration = body.duration_minutes ?? appt.duration_minutes;
    const buffer = body.travel_buffer_minutes ?? appt.travel_buffer_minutes;
    if (isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'Ongeldige starts_at' }, { status: 400 });
    }
    const validation = await validateSlot({
      customerId: session.customer.id,
      portalUserId: appt.portal_user_id,
      startsAt,
      durationMinutes: duration,
      bufferMinutes: buffer,
      excludeAppointmentId: appt.id,
    });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason || 'Slot niet beschikbaar' }, { status: 409 });
    }
    updates.starts_at = startsAt.toISOString();
    updates.duration_minutes = duration;
    updates.travel_buffer_minutes = buffer;
    if (appt.status !== 'rescheduled' && body.starts_at && body.starts_at !== appt.starts_at) {
      updates.status = 'scheduled';
    }
  }

  // Reassignment — only for non-agents
  if (body.portal_user_id !== undefined && (!session.portalUser || session.portalUser.role !== 'agent')) {
    updates.portal_user_id = body.portal_user_id || null;
  }

  // Status change
  if (body.status) {
    if (!['scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled'].includes(body.status)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === 'completed') updates.completed_at = new Date().toISOString();
    if (body.status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      if (body.cancelled_reason) updates.cancelled_reason = body.cancelled_reason;
    }
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[portal/appointments PATCH]', error);
    return NextResponse.json({ error: 'Bewerken mislukt' }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const { id } = await params;
  const appt = await loadAppointment(id, session.customer.id);
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  if (session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    if (appt.portal_user_id !== session.portalUser.id) return forbidden('Geen toegang');
  }

  const supabase = createServerClient();
  // Soft-cancel instead of hard delete (keeps history)
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_reason: 'Geannuleerd via portaal',
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Annuleren mislukt' }, { status: 500 });

  (async () => {
    try {
      const [branchRes, assigneeRes] = await Promise.all([
        supabase.from('branches').select('name').eq('slug', appt.branch).maybeSingle(),
        appt.portal_user_id
          ? supabase.from('portal_users').select('name, email').eq('id', appt.portal_user_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const branchName = (branchRes.data as { name?: string } | null)?.name;
      const assignee = (assigneeRes.data as { name?: string; email?: string } | null) || null;
      await sendAppointmentCancelledEmail(
        {
          name: session.customer.name,
          email: session.customer.email,
          contact_person: session.customer.contact_person,
        },
        { ...appt, branchName, portal_user_name: assignee?.name || null },
        'Geannuleerd via portaal',
      );
      const whenLabel = new Date(appt.starts_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendAppointmentPush(session.customer.id, 'cancelled', {
        contactName: appt.contact_name,
        whenLabel,
        appointmentId: appt.id,
      });
    } catch (e) {
      console.error('[portal/appointments DELETE notify]', e);
    }
  })().catch(() => {});

  return NextResponse.json({ success: true });
}
