import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { buildOAuthState, getAuthorizationUrl } from '@/lib/teamleader/oauth';
import { isTeamleaderConfigured } from '@/lib/teamleader/credentials';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  if (!(await isTeamleaderConfigured())) {
    return NextResponse.json(
      { error: 'Teamleader-integratie is nog niet geconfigureerd door Warme Leads' },
      { status: 503 },
    );
  }

  const state = buildOAuthState(session.customer.id);
  const url = await getAuthorizationUrl(state);
  return NextResponse.redirect(url);
}
