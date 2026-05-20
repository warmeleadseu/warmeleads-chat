import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { loadWelcomeOfferStatus } from '@/lib/welcomeOffer';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const supabase = createServerClient();
  const status = await loadWelcomeOfferStatus(supabase, session.customer.id);

  return NextResponse.json({
    active: status.active,
    expires_at: status.expires_at,
    used: status.used,
    pending_claim: status.pending_claim,
  });
}
