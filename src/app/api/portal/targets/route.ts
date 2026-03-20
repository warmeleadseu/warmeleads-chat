import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { data: targets, error } = await supabase
    .from('customer_targets')
    .select('id, lat, lng, radius_km, label')
    .eq('customer_id', customer.id)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: 'Kon doelgebieden niet ophalen' }, { status: 500 });
  }

  const { data: assignments } = await supabase
    .from('lead_assignments')
    .select('id')
    .eq('customer_id', customer.id);

  const leadsCount = (assignments || []).length;

  const enriched = (targets || []).map(target => ({
    ...target,
    leads_count: leadsCount,
  }));

  return NextResponse.json({ targets: enriched });
}
