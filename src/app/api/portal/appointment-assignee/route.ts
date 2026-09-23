import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { pickAppointmentAssignee } from '@/lib/appointmentAssignment';

/**
 * Wie zou de automatische toewijzer kiezen voor deze afspraak?
 *
 * Puur om het te laten zien voordat je boekt. Laat je de adviseur leeg, dan
 * koos het systeem stilzwijgend iemand (of niemand), en kwam je daar pas
 * achteraf achter.
 */
export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const q = request.nextUrl.searchParams;
  const branch = q.get('branch');
  const startsAt = q.get('starts_at');
  if (!branch || !startsAt) {
    return NextResponse.json({ error: 'branch en starts_at verplicht' }, { status: 400 });
  }
  if (Number.isNaN(new Date(startsAt).getTime())) {
    return NextResponse.json({ error: 'Ongeldige starts_at' }, { status: 400 });
  }

  const gekozen = await pickAppointmentAssignee(session.customer.id, {
    branch,
    postcode: q.get('postcode'),
    starts_at: startsAt,
  });

  if (!gekozen) {
    return NextResponse.json({ portal_user_id: null, naam: null });
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from('portal_users')
    .select('id, name')
    .eq('id', gekozen)
    .eq('customer_id', session.customer.id)
    .maybeSingle();

  return NextResponse.json({ portal_user_id: gekozen, naam: data?.name ?? null });
}
