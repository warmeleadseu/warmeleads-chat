import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidAccessToken,
  getTeamleaderIntegration,
} from '@/lib/teamleader/integrationRepo';
import { listDealPipelines } from '@/lib/teamleader/deals';
import {
  getCachedPipelines,
  setCachedPipelines,
} from '@/lib/teamleader/pipelineCache';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const integration = await getTeamleaderIntegration(supabase, session.customer.id);
  if (!integration) {
    return NextResponse.json(
      { error: 'Teamleader nog niet gekoppeld', pipelines: [] },
      { status: 400 },
    );
  }

  const force = request.nextUrl.searchParams.get('refresh') === '1';
  if (!force) {
    const cached = getCachedPipelines(session.customer.id);
    if (cached) return NextResponse.json({ pipelines: cached, cached: true });
  }

  try {
    const accessToken = await ensureValidAccessToken(supabase, integration);
    const pipelines = await listDealPipelines(accessToken);
    setCachedPipelines(session.customer.id, pipelines);
    return NextResponse.json({ pipelines, cached: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Kon pipelines niet ophalen';
    return NextResponse.json({ error: message, pipelines: [] }, { status: 502 });
  }
}
