import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { leadMatchesAnyProvinceTarget } from '@/lib/provinceTargetMatch';

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
