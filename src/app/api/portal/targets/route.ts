import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { leadMatchesAnyProvinceTarget } from '@/lib/provinceTargetMatch';
import { z } from 'zod';

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

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  // Doelgebieden + lead-aantallen per regio zijn bedrijfsbrede data: agents
  // zonder statistiek-recht mogen dit niet inzien.
  if (!hasPermission(session, PERMISSIONS.STATISTICS_VIEW)) return forbidden();

  const { customer } = session;

  const supabase = createServerClient();

  const { data: targets, error } = await supabase
    .from('customer_targets')
    .select('id, lat, lng, radius_km, label, target_type, provinces')
    .eq('customer_id', customer.id)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: 'Kon doelgebieden niet ophalen' }, { status: 500 });
  }

  const hasProvinceTargets = (targets || []).some(t => t.target_type === 'province');

  /** Hardcap voor assignments-join (zelfde stijl als portal/stats). */
  const PORTAL_TARGETS_MAX_ROWS = 25_000;
  const PAGE_SIZE = 1000;

  interface LeadGeo {
    lead_id: string;
    lat: number | null;
    lng: number | null;
    provincie?: string;
    land?: string;
    postcode?: string;
  }
  const leadsGeo: LeadGeo[] = [];
  let partial = false;
  for (let offset = 0; offset < PORTAL_TARGETS_MAX_ROWS; offset += PAGE_SIZE) {
    const take = Math.min(PAGE_SIZE, PORTAL_TARGETS_MAX_ROWS - offset);
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select(`lead_id, leads!inner(lat, lng${hasProvinceTargets ? ', provincie, land, postcode' : ''})`)
      .eq('customer_id', customer.id)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + take - 1);

    if (!assignments?.length) break;
    for (const row of assignments as unknown as {
      lead_id: string;
      leads: { lat: number | null; lng: number | null; provincie?: string; land?: string; postcode?: string };
    }[]) {
      const lead = row.leads;
      if (lead) {
        leadsGeo.push({
          lead_id: row.lead_id,
          lat: lead.lat,
          lng: lead.lng,
          provincie: lead.provincie,
          land: lead.land,
          postcode: lead.postcode,
        });
      }
    }
    if (assignments.length < take) break;
    if (offset + take >= PORTAL_TARGETS_MAX_ROWS) partial = true;
  }

  const enriched = (targets || []).map(target => {
    let count = 0;
    if (target.target_type === 'province') {
      const provs: string[] = Array.isArray(target.provinces) ? target.provinces : [];
      for (const lead of leadsGeo) {
        if (leadMatchesAnyProvinceTarget(lead, provs)) count++;
      }
    } else if (target.lat != null && target.lng != null) {
      for (const lead of leadsGeo) {
        if (lead.lat != null && lead.lng != null) {
          const dist = haversineKm(target.lat, target.lng, lead.lat, lead.lng);
          if (dist <= target.radius_km) count++;
        }
      }
    }
    return { ...target, leads_count: count };
  });

  if (partial) {
    console.info('[portal/targets]', {
      customerId: customer.id,
      leadsGeoCount: leadsGeo.length,
      cap: PORTAL_TARGETS_MAX_ROWS,
      partial,
    });
  }

  return NextResponse.json({
    targets: enriched,
    partial,
    maxAssignmentsScanned: PORTAL_TARGETS_MAX_ROWS,
  });
}

const targetWriteSchema = z.object({
  label: z.string().min(1),
  target_type: z.enum(['radius', 'province']).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radius_km: z.number().min(1).max(500).optional(),
  provinces: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

/** Self-service: klant mag eigen radius-targets beheren (max 5 actief). */
export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.STATISTICS_VIEW)) return forbidden();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }
  const parsed = targetWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige target-gegevens' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { count } = await supabase
    .from('customer_targets')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', session.customer.id)
    .eq('is_active', true);
  if ((count || 0) >= 5) {
    return NextResponse.json({ error: 'Maximaal 5 actieve doelgebieden' }, { status: 400 });
  }

  const d = parsed.data;
  const type = d.target_type || 'radius';
  if (type === 'province') {
    return NextResponse.json({ error: 'Provincie-targets via admin' }, { status: 400 });
  }
  if (d.lat == null || d.lng == null) {
    return NextResponse.json({ error: 'Lat/lng is verplicht' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('customer_targets')
    .insert({
      customer_id: session.customer.id,
      label: d.label.trim(),
      target_type: 'radius',
      lat: d.lat,
      lng: d.lng,
      radius_km: d.radius_km || 25,
      country: session.customer.country || 'NL',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.STATISTICS_VIEW)) return forbidden();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }
  const schema = targetWriteSchema.extend({ id: z.string().uuid() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige target-gegevens' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('customer_targets')
    .select('id, customer_id')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (!existing || existing.customer_id !== session.customer.id) {
    return NextResponse.json({ error: 'Target niet gevonden' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.label) updates.label = parsed.data.label.trim();
  if (parsed.data.radius_km != null) updates.radius_km = parsed.data.radius_km;
  if (parsed.data.lat != null) updates.lat = parsed.data.lat;
  if (parsed.data.lng != null) updates.lng = parsed.data.lng;
  if (parsed.data.is_active != null) updates.is_active = parsed.data.is_active;

  const { data, error } = await supabase
    .from('customer_targets')
    .update(updates)
    .eq('id', parsed.data.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.STATISTICS_VIEW)) return forbidden();

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('customer_targets')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle();
  if (!existing || existing.customer_id !== session.customer.id) {
    return NextResponse.json({ error: 'Target niet gevonden' }, { status: 404 });
  }

  const { error } = await supabase
    .from('customer_targets')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
