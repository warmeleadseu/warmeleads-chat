import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

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
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { data: targets, error } = await supabase
    .from('customer_targets')
    .select('id, lat, lng, radius_km, label, target_type, provinces')
    .eq('customer_id', customer.id)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: 'Kon doelgebieden niet ophalen' }, { status: 500 });
  }

  const hasRadiusTargets = (targets || []).some(t => (t.target_type || 'radius') === 'radius');
  const hasProvinceTargets = (targets || []).some(t => t.target_type === 'province');

  const { data: assignments } = await supabase
    .from('lead_assignments')
    .select(`lead_id, leads!inner(lat, lng${hasProvinceTargets ? ', provincie' : ''})`)
    .eq('customer_id', customer.id);

  interface LeadGeo { lead_id: string; lat: number | null; lng: number | null; provincie?: string }
  const leadsGeo: LeadGeo[] = [];
  for (const row of (assignments || []) as unknown as { lead_id: string; leads: { lat: number | null; lng: number | null; provincie?: string } }[]) {
    const lead = row.leads;
    if (lead) {
      leadsGeo.push({ lead_id: row.lead_id, lat: lead.lat, lng: lead.lng, provincie: lead.provincie });
    }
  }

  const enriched = (targets || []).map(target => {
    let count = 0;
    if (target.target_type === 'province') {
      const provs: string[] = Array.isArray(target.provinces) ? target.provinces : [];
      for (const lead of leadsGeo) {
        if (lead.provincie && provs.includes(lead.provincie)) count++;
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

  return NextResponse.json({ targets: enriched });
}
