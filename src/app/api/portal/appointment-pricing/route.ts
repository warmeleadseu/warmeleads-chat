import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { mergeCustomTiers } from '@/lib/pricing';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_VIEW)) return forbidden();

  const { customer } = session;

  const branch = request.nextUrl.searchParams.get('branch');
  if (!branch) {
    return NextResponse.json({ error: 'branch is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const [{ data: branchData }, { data: customPricing }] = await Promise.all([
    supabase
      .from('branches')
      .select('slug, name, appointment_pricing_tiers, appointment_min_batch_size, appointment_nationwide_discount, default_appointment_duration, default_travel_buffer')
      .eq('slug', branch)
      .single(),
    supabase
      .from('customer_appointment_pricing')
      .select('pricing_tiers, nationwide_discount, notes')
      .eq('customer_id', customer.id)
      .eq('branch_slug', branch)
      .maybeSingle(),
  ]);

  if (!branchData) {
    return NextResponse.json({ error: 'Branche niet gevonden' }, { status: 404 });
  }

  const hasCustomPricing = customPricing && customPricing.pricing_tiers && customPricing.pricing_tiers.length > 0;
  // Re-use PricingTier shape: {min_leads, price_per_lead} but semantically they represent appointments
  const branchTiers: { min_leads: number; price_per_lead: number }[] = branchData.appointment_pricing_tiers || [];
  const customTiers: { min_leads: number; price_per_lead: number }[] = hasCustomPricing ? customPricing.pricing_tiers : [];

  const tiers = customTiers.length > 0
    ? mergeCustomTiers(branchTiers, customTiers)
    : branchTiers;

  const nationwideDiscount = hasCustomPricing && customPricing.nationwide_discount != null
    ? customPricing.nationwide_discount
    : (branchData.appointment_nationwide_discount || 0);
  const minBatchSize = branchData.appointment_min_batch_size || 5;

  return NextResponse.json({
    branch: branchData.slug,
    branch_name: branchData.name,
    tiers,
    min_batch_size: minBatchSize,
    nationwide_discount: Number(nationwideDiscount),
    is_custom: !!hasCustomPricing,
    default_duration: branchData.default_appointment_duration || 60,
    default_travel_buffer: branchData.default_travel_buffer || 30,
  });
}
