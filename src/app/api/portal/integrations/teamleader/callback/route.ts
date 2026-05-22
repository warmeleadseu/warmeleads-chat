import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { exchangeCodeForTokens, parseOAuthState } from '@/lib/teamleader/oauth';
import { saveTeamleaderTokens } from '@/lib/teamleader/integrationRepo';

function portalAccountUrl(request: NextRequest, query: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || request.nextUrl.origin;
  return `${base}/portal/account?${query}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get('error');
  if (error) {
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=error'));
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=error'));
  }

  const customerId = parseOAuthState(state);
  if (!customerId) {
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=error'));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const supabase = createServerClient();
    await saveTeamleaderTokens(supabase, customerId, tokens);
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=connected'));
  } catch {
    return NextResponse.redirect(portalAccountUrl(request, 'teamleader=error'));
  }
}
