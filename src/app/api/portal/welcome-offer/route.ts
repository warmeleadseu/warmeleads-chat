import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const { customer } = session;

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

  let pendingClaim = false;
  if (notUsed && notExpired) {
    const { count } = await supabase
      .from('batch_orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id)
      .eq('welcome_discount_applied', true)
      .in('status', ['pending', 'open']);
    pendingClaim = (count ?? 0) > 0;
  }

  return NextResponse.json({
    active: notUsed && notExpired && !pendingClaim,
    expires_at: data.welcome_offer_expires_at,
    used: data.welcome_offer_used,
    pending_claim: pendingClaim,
  });
}
