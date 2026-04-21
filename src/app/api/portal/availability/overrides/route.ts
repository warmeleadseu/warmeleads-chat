import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) return forbidden();

  const supabase = createServerClient();
  const targetUserId = request.nextUrl.searchParams.get('portal_user_id');
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  let query = supabase
    .from('availability_overrides')
    .select('*')
    .eq('customer_id', session.customer.id)
    .order('date', { ascending: true });

  if (targetUserId) query = query.eq('portal_user_id', targetUserId);
  else if (session.portalUser && session.portalUser.role === 'agent') {
    query = query.eq('portal_user_id', session.portalUser.id);
  }

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 });

  return NextResponse.json({ overrides: data || [] });
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.AVAILABILITY_MANAGE)) return forbidden();

  try {
    const body = await request.json();
    if (!body.date || !body.type) {
      return NextResponse.json({ error: 'date en type zijn verplicht' }, { status: 400 });
    }
    if (!['blocked', 'extra'].includes(body.type)) {
      return NextResponse.json({ error: 'type moet blocked of extra zijn' }, { status: 400 });
    }
    if (body.type === 'extra' && (!body.start_time || !body.end_time)) {
      return NextResponse.json({ error: 'start_time en end_time verplicht bij type=extra' }, { status: 400 });
    }

    const portalUserId: string | null = body.portal_user_id ?? null;
    if (session.portalUser && session.portalUser.role === 'agent' && portalUserId !== session.portalUser.id) {
      return forbidden('Je kunt alleen je eigen overrides beheren');
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('availability_overrides')
      .insert({
        customer_id: session.customer.id,
        portal_user_id: portalUserId,
        date: body.date,
        start_time: body.start_time || null,
        end_time: body.end_time || null,
        type: body.type,
        reason: body.reason || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Opslaan mislukt', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, override: data });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.AVAILABILITY_MANAGE)) return forbidden();

  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id is verplicht' }, { status: 400 });

    const supabase = createServerClient();

    // Ownership check
    const { data: existing } = await supabase
      .from('availability_overrides')
      .select('customer_id, portal_user_id')
      .eq('id', body.id)
      .single();

    if (!existing || existing.customer_id !== session.customer.id) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    }
    if (session.portalUser && session.portalUser.role === 'agent' && existing.portal_user_id !== session.portalUser.id) {
      return forbidden();
    }

    const { error } = await supabase.from('availability_overrides').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
