import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyCustomer } from '@/lib/portalAuth';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 });
  }

  const branch = request.nextUrl.searchParams.get('branch');
  if (!branch) {
    return NextResponse.json({ error: 'branch is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const [{ data: branchData }, { data: customPricing }] = await Promise.all([
    supabase
      .from('branches')
      .select('slug, name, pricing_tiers, min_batch_size, nationwide_discount')
      .eq('slug', branch)
      .single(),
    supabase
      .from('customer_pricing')
      .select('pricing_tiers, nationwide_discount, notes')
      .eq('customer_id', customer.id)
      .eq('branch_slug', branch)
      .maybeSingle(),
  ]);

  if (!branchData) {
    return NextResponse.json({ error: 'Branche niet gevonden' }, { status: 404 });
  }

  const hasCustomPricing = customPricing && customPricing.pricing_tiers && customPricing.pricing_tiers.length > 0;
  const branchTiers: { min_leads: number; price_per_lead: number }[] = branchData.pricing_tiers || [];
  const customTiers: { min_leads: number; price_per_lead: number }[] = hasCustomPricing ? customPricing.pricing_tiers : [];

  let tiers: { min_leads: number; price_per_lead: number }[];
  if (customTiers.length > 0) {
    const customMinLeads = new Set(customTiers.map(t => t.min_leads));
    const merged = [
      ...branchTiers.filter(t => !customMinLeads.has(t.min_leads)),
      ...customTiers,
    ];
    tiers = merged.sort((a, b) => a.min_leads - b.min_leads);
  } else {
    tiers = branchTiers;
  }

  const nationwideDiscount = hasCustomPricing && customPricing.nationwide_discount != null
    ? customPricing.nationwide_discount
    : (branchData.nationwide_discount || 0);
  const minBatchSize = branchData.min_batch_size || 10;

  return NextResponse.json({
    branch: branchData.slug,
    branch_name: branchData.name,
    tiers,
    min_batch_size: minBatchSize,
    nationwide_discount: Number(nationwideDiscount),
    is_custom: !!hasCustomPricing,
  });
}
