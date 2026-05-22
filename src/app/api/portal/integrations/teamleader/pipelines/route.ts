import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidAccessToken,
  getTeamleaderIntegration,
} from '@/lib/teamleader/integrationRepo';
import { listDealPipelines } from '@/lib/teamleader/deals';

const CACHE_MS = 15 * 60 * 1000;
const pipelineCache = new Map<string, { at: number; pipelines: Awaited<ReturnType<typeof listDealPipelines>> }>();

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const integration = await getTeamleaderIntegration(supabase, session.customer.id);
  if (!integration) {
    return NextResponse.json({ error: 'Teamleader niet gekoppeld' }, { status: 400 });
  }

  const cacheKey = session.customer.id;
  const cached = pipelineCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ pipelines: cached.pipelines });
  }

  const accessToken = await ensureValidAccessToken(supabase, integration);
  const pipelines = await listDealPipelines(accessToken);
  pipelineCache.set(cacheKey, { at: Date.now(), pipelines });
  return NextResponse.json({ pipelines });
}
