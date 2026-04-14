import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { distributeUnassignedLeads } from '@/lib/distribution';
import { resolveCity } from '@/lib/pdok';

const KNOWN_PRESETS = ['Heel Nederland', 'Heel België'];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function verifyAndResolveCoords(
  label: string,
  clientLat: number,
  clientLng: number
): Promise<{ lat: number; lng: number; resolvedLabel: string }> {
  if (KNOWN_PRESETS.includes(label)) {
    return { lat: clientLat, lng: clientLng, resolvedLabel: label };
  }

  const resolved = await resolveCity(label);
  if (!resolved) {
    return { lat: clientLat, lng: clientLng, resolvedLabel: label };
  }

  const drift = haversineKm(clientLat, clientLng, resolved.lat, resolved.lng);
  if (drift > 5) {
    return { lat: resolved.lat, lng: resolved.lng, resolvedLabel: resolved.naam };
  }

  return { lat: clientLat, lng: clientLng, resolvedLabel: label };
}

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

  const verified = await verifyAndResolveCoords(label, lat, lng);

  const { data, error } = await supabase
    .from('customer_targets')
    .insert({
      customer_id,
      label: verified.resolvedLabel,
      target_type: 'radius',
      lat: verified.lat,
      lng: verified.lng,
      radius_km: radius_km || 25,
    })
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

  if ('label' in updates && 'lat' in updates && 'lng' in updates) {
    const verified = await verifyAndResolveCoords(updates.label, updates.lat, updates.lng);
    updates.label = verified.resolvedLabel;
    updates.lat = verified.lat;
    updates.lng = verified.lng;
  } else if ('label' in updates && !('lat' in updates)) {
    const { data: existing } = await supabase
      .from('customer_targets')
      .select('target_type, lat, lng')
      .eq('id', id)
      .single();
    if (existing && (existing.target_type || 'radius') === 'radius' && existing.lat != null) {
      const verified = await verifyAndResolveCoords(updates.label, existing.lat, existing.lng);
      updates.label = verified.resolvedLabel;
      updates.lat = verified.lat;
      updates.lng = verified.lng;
    }
  }

  const { data, error } = await supabase
    .from('customer_targets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const geoFieldChanged = 'lat' in updates || 'lng' in updates || 'radius_km' in updates || 'provinces' in updates || 'is_active' in updates;
  if (geoFieldChanged) {
    try { distributeUnassignedLeads(); } catch { /* non-blocking */ }
  }

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
