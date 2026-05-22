import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { buildAuthorizationUrl, buildOAuthState } from '@/lib/teamleader/oauth';
import { getEffectiveOAuthConfig } from '@/lib/teamleader/credentials';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const config = await getEffectiveOAuthConfig(supabase, session.customer.id);
  if (!config) {
    return NextResponse.json(
      {
        error:
          'Voer eerst je Teamleader Client ID en Client Secret in (eigen integratie) of vraag Warme Leads om de centrale koppeling te activeren.',
      },
      { status: 503 },
    );
  }

  const state = buildOAuthState(session.customer.id);
  const url = buildAuthorizationUrl(config, state);
  return NextResponse.redirect(url);
}
