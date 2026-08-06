import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

interface AvailabilityRow {
  id?: string;
  portal_user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) return forbidden();

  const supabase = createServerClient();

  const targetUserId = request.nextUrl.searchParams.get('portal_user_id');

  let query = supabase
    .from('adviser_availability')
    .select('*')
    .eq('customer_id', session.customer.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (targetUserId) {
    query = query.eq('portal_user_id', targetUserId);
  } else if (session.portalUser && session.portalUser.role === 'agent') {
    // Agent zonder expliciete id: eigen rijen + bedrijfsniveau (zelfde inheritance als slots)
    query = query.or(`portal_user_id.eq.${session.portalUser.id},portal_user_id.is.null`);
  } else {
    // Owner/beheerder zonder id: alleen bedrijfsniveau (voorkomt mix met agent-rijen in de editor)
    query = query.is('portal_user_id', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 });

  return NextResponse.json({ availability: data || [] });
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.AVAILABILITY_MANAGE)) return forbidden();

  try {
    const body = await request.json();
    const rows: AvailabilityRow[] = Array.isArray(body.rows) ? body.rows : [];
    const portalUserId: string | null = body.portal_user_id ?? null;

    if (session.portalUser && session.portalUser.role === 'agent' && portalUserId !== session.portalUser.id) {
      return forbidden('Je kunt alleen je eigen beschikbaarheid beheren');
    }

    const supabase = createServerClient();

    // Replace-all strategy: delete existing rows for this (customer, portal_user_id) and insert new ones
    const deleteQuery = supabase
      .from('adviser_availability')
      .delete()
      .eq('customer_id', session.customer.id);
    const { error: delErr } = portalUserId
      ? await deleteQuery.eq('portal_user_id', portalUserId)
      : await deleteQuery.is('portal_user_id', null);

    if (delErr) {
      return NextResponse.json({ error: 'Opslaan mislukt', details: delErr.message }, { status: 500 });
    }

    const toInsert = rows
      .filter(r => r && typeof r.day_of_week === 'number' && r.start_time && r.end_time)
      .map(r => ({
        customer_id: session.customer.id,
        portal_user_id: portalUserId,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        is_active: r.is_active !== false,
      }));

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('adviser_availability').insert(toInsert);
      if (insErr) {
        return NextResponse.json({ error: 'Opslaan mislukt', details: insErr.message }, { status: 500 });
      }
    }

    let freshQuery = supabase
      .from('adviser_availability')
      .select('*')
      .eq('customer_id', session.customer.id)
      .order('day_of_week', { ascending: true });
    freshQuery = portalUserId
      ? freshQuery.eq('portal_user_id', portalUserId)
      : freshQuery.is('portal_user_id', null);
    const { data: fresh } = await freshQuery;

    return NextResponse.json({ success: true, availability: fresh || [] });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
