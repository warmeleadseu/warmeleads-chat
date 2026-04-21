import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { computeAvailableSlots } from '@/lib/appointmentSlots';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) return forbidden();

  const url = new URL(request.url);
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const portalUserIdParam = url.searchParams.get('portal_user_id');
  const durationParam = url.searchParams.get('duration');
  const bufferParam = url.searchParams.get('buffer');
  const branch = url.searchParams.get('branch') || undefined;
  const excludeId = url.searchParams.get('exclude_id') || undefined;

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'from en to verplicht' }, { status: 400 });
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 });
  }

  // Range cap (max 62 days)
  if ((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24) > 62) {
    return NextResponse.json({ error: 'Range te groot (max 62 dagen)' }, { status: 400 });
  }

  let duration = durationParam ? parseInt(durationParam) : 60;
  let buffer = bufferParam ? parseInt(bufferParam) : 15;

  if (branch) {
    const supabase = createServerClient();
    const { data: br } = await supabase
      .from('branches')
      .select('default_appointment_duration, default_travel_buffer')
      .eq('slug', branch)
      .maybeSingle();
    if (br) {
      if (!durationParam) duration = br.default_appointment_duration || duration;
      if (!bufferParam) buffer = br.default_travel_buffer ?? buffer;
    }
  }

  let portalUserId: string | undefined | null;
  if (portalUserIdParam === 'null') portalUserId = null;
  else if (portalUserIdParam) portalUserId = portalUserIdParam;
  else portalUserId = undefined; // union

  // Agent: only own slots
  if (session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    portalUserId = session.portalUser.id;
  }

  try {
    const slots = await computeAvailableSlots({
      customerId: session.customer.id,
      portalUserId,
      from,
      to,
      durationMinutes: duration,
      bufferMinutes: buffer,
      step: 30,
      excludeAppointmentId: excludeId,
    });
    return NextResponse.json({ slots, duration, buffer });
  } catch (err) {
    console.error('[portal/appointment-slots]', err);
    return NextResponse.json({ error: 'Slots berekenen mislukt' }, { status: 500 });
  }
}
