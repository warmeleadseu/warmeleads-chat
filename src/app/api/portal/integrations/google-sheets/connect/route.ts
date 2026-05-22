import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { buildGoogleAuthorizationUrl, buildGoogleOAuthState } from '@/lib/googleSheets/oauth';
import { getGoogleOAuthConfig } from '@/lib/googleSheets/config';

function portalAccountUrl(request: NextRequest, query: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || request.nextUrl.origin;
  const q = query.includes('tab=') ? query : `tab=integraties&${query}`;
  return `${base}/portal/account?${q}`;
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const config = getGoogleOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      portalAccountUrl(request, 'sheets=error&sheets_reason=no_oauth_config'),
    );
  }

  const state = buildGoogleOAuthState(session.customer.id);
  const url = buildGoogleAuthorizationUrl(config, state);
  return NextResponse.redirect(url);
}
