import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { buildAuthorizationUrl, buildOAuthState } from '@/lib/teamleader/oauth';
import { getEffectiveOAuthConfig } from '@/lib/teamleader/credentials';

function portalAccountUrl(request: NextRequest, query: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || request.nextUrl.origin;
  return `${base}/portal/account?${query}`;
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const config = await getEffectiveOAuthConfig(supabase, session.customer.id);
  if (!config) {
    return NextResponse.redirect(
      portalAccountUrl(request, 'teamleader=error&reason=no_oauth_config'),
    );
  }

  const state = buildOAuthState(session.customer.id);
  const url = buildAuthorizationUrl(config, state);
  return NextResponse.redirect(url);
}
