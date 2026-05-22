import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { getTeamleaderOAuthConfig } from '@/lib/teamleader/credentials';

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSuperAdmin(request);
  if (authError) return authError;

  const config = await getTeamleaderOAuthConfig();
  return NextResponse.json({
    configured: !!config,
    redirect_uri: config?.redirectUri ?? null,
    has_client_id: !!config?.clientId,
    has_client_secret: !!config?.clientSecret,
  });
}
