import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const customerId = request.nextUrl.searchParams.get('customer_id');
  if (!customerId) {
    return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const [weekly, overrides] = await Promise.all([
    supabase
      .from('adviser_availability')
      .select('*')
      .eq('customer_id', customerId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase
      .from('availability_overrides')
      .select('*')
      .eq('customer_id', customerId)
      .order('date', { ascending: true }),
  ]);

  return NextResponse.json({
    availability: weekly.data || [],
    overrides: overrides.data || [],
  });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    const customerId = body.customer_id;
    const portalUserId: string | null = body.portal_user_id ?? null;
    if (!customerId) return NextResponse.json({ error: 'customer_id verplicht' }, { status: 400 });

    const supabase = createServerClient();

    const deleteQuery = supabase.from('adviser_availability').delete().eq('customer_id', customerId);
    const { error: delErr } = portalUserId
      ? await deleteQuery.eq('portal_user_id', portalUserId)
      : await deleteQuery.is('portal_user_id', null);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const rows = Array.isArray(body.rows) ? body.rows : [];
    const toInsert = rows
      .filter((r: { day_of_week?: number; start_time?: string; end_time?: string }) =>
        r && typeof r.day_of_week === 'number' && r.start_time && r.end_time)
      .map((r: { day_of_week: number; start_time: string; end_time: string; is_active?: boolean }) => ({
        customer_id: customerId,
        portal_user_id: portalUserId,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        is_active: r.is_active !== false,
      }));

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('adviser_availability').insert(toInsert);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
