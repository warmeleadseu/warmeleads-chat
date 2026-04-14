import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();
  const { data } = await supabase
    .from('customers')
    .select('welcome_offer_used, welcome_offer_expires_at')
    .eq('id', customer.id)
    .single();

  if (!data) {
    return NextResponse.json({ active: false, expires_at: null });
  }

  const notUsed = data.welcome_offer_used === false;
  const notExpired = data.welcome_offer_expires_at
    ? new Date(data.welcome_offer_expires_at) > new Date()
    : false;

  return NextResponse.json({
    active: notUsed && notExpired,
    expires_at: data.welcome_offer_expires_at,
    used: data.welcome_offer_used,
  });
}
