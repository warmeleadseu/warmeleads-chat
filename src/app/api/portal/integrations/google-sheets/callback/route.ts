import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { exchangeGoogleCodeForTokens, parseGoogleOAuthState } from '@/lib/googleSheets/oauth';
import { saveGoogleSheetsTokens } from '@/lib/googleSheets/integrationRepo';
import { getGoogleOAuthConfig } from '@/lib/googleSheets/config';

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
      portalAccountUrl(request, `sheets=error&sheets_reason=${encodeURIComponent(error)}`),
    );
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(portalAccountUrl(request, 'sheets=error&sheets_reason=missing_code'));
  }

  const customerId = parseGoogleOAuthState(state);
  if (!customerId) {
    return NextResponse.redirect(portalAccountUrl(request, 'sheets=error&reason=invalid_state'));
  }

  try {
    const config = getGoogleOAuthConfig();
    if (!config) {
      return NextResponse.redirect(
        portalAccountUrl(request, 'sheets=error&sheets_reason=no_oauth_config'),
      );
    }
    const supabase = createServerClient();
    const tokens = await exchangeGoogleCodeForTokens(config, code);
    if (!tokens.refreshToken) {
      return NextResponse.redirect(
        portalAccountUrl(request, 'sheets=error&sheets_reason=missing_refresh_token'),
      );
    }
    await saveGoogleSheetsTokens(supabase, customerId, tokens);
    return NextResponse.redirect(portalAccountUrl(request, 'sheets=connected'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    return NextResponse.redirect(
      portalAccountUrl(request, `sheets=error&sheets_reason=${encodeURIComponent(reason)}`),
    );
  }
}
