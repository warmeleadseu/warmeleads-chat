import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { computeAvailableSlots } from '@/lib/appointmentSlots';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const portalUserIdParam = url.searchParams.get('portal_user_id');
  const durationParam = url.searchParams.get('duration');
  const bufferParam = url.searchParams.get('buffer');
  const branch = url.searchParams.get('branch') || undefined;
  const excludeId = url.searchParams.get('exclude_id') || undefined;

  if (!customerId || !fromStr || !toStr) {
    return NextResponse.json({ error: 'customer_id, from en to verplicht' }, { status: 400 });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 });
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
  else portalUserId = undefined;

  try {
    const slots = await computeAvailableSlots({
      customerId,
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
    console.error('[admin/appointment-slots]', err);
    return NextResponse.json({ error: 'Slots berekenen mislukt' }, { status: 500 });
  }
}
