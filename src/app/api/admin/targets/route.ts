import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { distributeUnassignedLeads } from '@/lib/distribution';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const customerId = request.nextUrl.searchParams.get('customer_id');

  let query = supabase.from('customer_targets').select('*').order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();

  const { customer_id, label, target_type, lat, lng, radius_km, provinces } = body;
  if (!customer_id || !label) {
    return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
  }

  const type = target_type || 'radius';

  if (type === 'province') {
    if (!Array.isArray(provinces) || provinces.length === 0) {
      return NextResponse.json({ error: 'Selecteer minimaal 1 provincie' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('customer_targets')
      .insert({ customer_id, label, target_type: 'province', provinces, lat: null, lng: null, radius_km: 0 })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try { distributeUnassignedLeads(); } catch { /* non-blocking */ }
    return NextResponse.json(data, { status: 201 });
  }

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'Lat/lng is verplicht voor radius-targets' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('customer_targets')
    .insert({ customer_id, label, target_type: 'radius', lat, lng, radius_km: radius_km || 25 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try { distributeUnassignedLeads(); } catch { /* non-blocking */ }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { data, error } = await supabase
    .from('customer_targets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { error } = await supabase.from('customer_targets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
