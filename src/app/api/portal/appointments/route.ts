import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { validateSlot } from '@/lib/appointmentSlots';
import { pickAppointmentAssignee } from '@/lib/appointmentAssignment';
import { sendAppointmentCreatedEmail } from '@/lib/appointmentEmails';
import { sendAppointmentPush } from '@/lib/pushNotification';

/** Max bereik in dagen (zelfde stijl als appointment-slots). */
const MAX_RANGE_DAYS = 62;
/** Maximaal aantal rijen per fetch (Postgrest cap). */
const MAX_ROWS = 2000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) return forbidden();

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status'); // scheduled|completed|cancelled|no_show|rescheduled
  const portalUserIdParam = url.searchParams.get('portal_user_id');

  // Valideer range. Zonder from/to defaulten we naar [now-31d, now+31d] om volume te begrenzen.
  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  if (from) {
    fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) return NextResponse.json({ error: 'Ongeldige from' }, { status: 400 });
  }
  if (to) {
    toDate = new Date(to);
    if (isNaN(toDate.getTime())) return NextResponse.json({ error: 'Ongeldige to' }, { status: 400 });
  }
  if (!fromDate && !toDate) {
    const now = Date.now();
    fromDate = new Date(now - 31 * MS_PER_DAY);
    toDate = new Date(now + 31 * MS_PER_DAY);
  } else if (fromDate && !toDate) {
    toDate = new Date(fromDate.getTime() + MAX_RANGE_DAYS * MS_PER_DAY);
  } else if (!fromDate && toDate) {
    fromDate = new Date(toDate.getTime() - MAX_RANGE_DAYS * MS_PER_DAY);
  }

  if (fromDate && toDate) {
    const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / MS_PER_DAY);
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Bereik te groot. Maximaal ${MAX_RANGE_DAYS} dagen per request.` },
        { status: 400 },
      );
    }
    if (rangeDays < 0) {
      return NextResponse.json({ error: 'from moet vóór to liggen' }, { status: 400 });
    }
  }

  const supabase = createServerClient();
  let q = supabase
    .from('appointments')
    .select('*')
    .eq('customer_id', session.customer.id)
    .order('starts_at', { ascending: true })
    .limit(MAX_ROWS + 1);

  if (fromDate) q = q.gte('starts_at', fromDate.toISOString());
  if (toDate) q = q.lte('starts_at', toDate.toISOString());
  if (status) q = q.eq('status', status);

  if (session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    q = q.eq('portal_user_id', session.portalUser.id);
  } else if (portalUserIdParam) {
    if (portalUserIdParam === 'null') q = q.is('portal_user_id', null);
    else q = q.eq('portal_user_id', portalUserIdParam);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 });
  }

  const rows = data || [];
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `Te veel afspraken in dit bereik (>${MAX_ROWS}). Beperk de range of filter op portal_user_id/status.`,
        max_rows: MAX_ROWS,
      },
      { status: 413 },
    );
  }
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const body = await request.json();
  const {
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

  if (!branch || !starts_at || !contact_name) {
    return NextResponse.json({ error: 'branch, starts_at en contact_name zijn verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Determine defaults from branch
  const { data: branchRow } = await supabase
    .from('branches')
    .select('slug, default_appointment_duration, default_travel_buffer, is_active')
    .eq('slug', branch)
    .maybeSingle();

  if (!branchRow || !branchRow.is_active) {
    return NextResponse.json({ error: 'Onbekende branche' }, { status: 400 });
  }

  // Check branch is part of customer's branches
  if (!(session.customer.branches || []).includes(branch)) {
    return NextResponse.json({ error: 'Geen toegang tot deze branche' }, { status: 403 });
  }

  const duration = Number.isFinite(duration_minutes) ? duration_minutes : branchRow.default_appointment_duration || 60;
  const buffer = Number.isFinite(travel_buffer_minutes) ? travel_buffer_minutes : branchRow.default_travel_buffer ?? 0;

  const startsAtDate = new Date(starts_at);
  if (isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: 'Ongeldige starts_at' }, { status: 400 });
  }

  // Agent: assign to self by default
  let effectivePortalUserId: string | null = portal_user_id ?? null;
  if (session.portalUser && session.portalUser.role === 'agent') {
    effectivePortalUserId = session.portalUser.id;
  } else if (effectivePortalUserId === null && body.auto_assign !== false) {
    effectivePortalUserId = await pickAppointmentAssignee(session.customer.id, {
      branch,
      postcode,
      starts_at: startsAtDate.toISOString(),
    });
  }

  // Validate slot availability
  const validation = await validateSlot({
    customerId: session.customer.id,
    portalUserId: effectivePortalUserId,
    startsAt: startsAtDate,
    durationMinutes: duration,
    bufferMinutes: buffer,
  });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason || 'Slot niet beschikbaar' }, { status: 409 });
  }

  // Determine source
  let source = 'portal_owner_booked';
  if (session.portalUser) {
    source = session.portalUser.role === 'agent' ? 'agent_booked' : 'portal_owner_booked';
  }

  // If no batch_id, auto-pick oldest active paid batch for this branch (optional)
  let resolvedBatchId: string | null = batch_id ?? null;
  if (!resolvedBatchId) {
    const { data: b } = await supabase
      .from('appointment_batches')
      .select('id')
      .eq('customer_id', session.customer.id)
      .eq('branch', branch)
      .eq('is_paid', true)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (b) resolvedBatchId = b.id;
  }

  const insert = {
    customer_id: session.customer.id,
    portal_user_id: effectivePortalUserId,
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
    source,
    created_by_portal_user_id: session.portalUser?.id || null,
  };

  const { data, error } = await supabase
    .from('appointments')
    .insert(insert)
    .select('*')
    .single();

  if (error) {
    console.error('[portal/appointments POST]', error);
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 });
  }

  // Fire-and-forget notifications
  (async () => {
    try {
      const [branchRes, assigneeRes] = await Promise.all([
        supabase.from('branches').select('name').eq('slug', branch).maybeSingle(),
        effectivePortalUserId
          ? supabase.from('portal_users').select('name, email').eq('id', effectivePortalUserId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const branchName = branchRes.data?.name;
      const assignee = (assigneeRes.data as { name?: string; email?: string } | null) || null;
      await sendAppointmentCreatedEmail(
        {
          name: session.customer.name,
          email: session.customer.email,
          contact_person: session.customer.contact_person,
        },
        { ...data, branchName, portal_user_name: assignee?.name || null },
        assignee?.email ? { name: assignee.name || '', email: assignee.email } : undefined,
      );
      const whenLabel = new Date(data.starts_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendAppointmentPush(session.customer.id, 'created', {
        contactName: data.contact_name,
        whenLabel,
        appointmentId: data.id,
      });
    } catch (e) {
      console.error('[portal/appointments post-notify]', e);
    }
  })().catch(() => {});

  return NextResponse.json(data);
}
