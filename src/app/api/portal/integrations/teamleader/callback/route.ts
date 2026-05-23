import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensurePreferredCrmProvider } from '@/lib/integrations/crmPreferences';
import { exchangeCodeForTokens, parseOAuthState } from '@/lib/teamleader/oauth';
import { saveTeamleaderTokens } from '@/lib/teamleader/integrationRepo';
import { getEffectiveOAuthConfig } from '@/lib/teamleader/credentials';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';

function portalAccountUrl(request: NextRequest, query: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || request.nextUrl.origin;
  const q = query.includes('tab=') ? query : `tab=integraties&${query}`;
  return `${base}/portal/account?${q}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get('error');
  if (error) {
    return NextResponse.redirect(
      portalAccountUrl(request, `teamleader=error&reason=${encodeURIComponent(error)}`),
    );
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=error&reason=missing_code'));
  }

  const customerId = parseOAuthState(state);
  if (!customerId) {
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=error&reason=invalid_state'));
  }

  try {
    const supabase = createServerClient();
    const config = await getEffectiveOAuthConfig(supabase, customerId);
    if (!config) {
      return NextResponse.redirect(
        portalAccountUrl(request, 'teamleader=error&reason=no_oauth_config'),
      );
    }
    const tokens = await exchangeCodeForTokens(config, code);
    await saveTeamleaderTokens(supabase, customerId, tokens);
    await ensurePreferredCrmProvider(supabase, customerId, TEAMLEADER_PROVIDER);
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=connected'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    return NextResponse.redirect(
      portalAccountUrl(request, `teamleader=error&reason=${encodeURIComponent(reason)}`),
    );
  }
}
