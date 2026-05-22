import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  ensureValidAccessToken,
  getTeamleaderIntegration,
  resolvePhaseIdForPipeline,
  updateTeamleaderSettings,
} from '@/lib/teamleader/integrationRepo';

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json()) as {
    pipeline_id?: string | null;
    pipeline_name?: string | null;
    deal_title_template?: string | null;
    enabled?: boolean;
  };

  const supabase = createServerClient();
  const integration = await getTeamleaderIntegration(supabase, session.customer.id);
  if (!integration) {
    return NextResponse.json({ error: 'Teamleader niet gekoppeld' }, { status: 400 });
  }

  const patch: Parameters<typeof updateTeamleaderSettings>[2] = {};
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
  if (body.deal_title_template !== undefined) {
    patch.deal_title_template = body.deal_title_template?.trim() || null;
  }
  if (body.pipeline_id !== undefined) {
    patch.pipeline_id = body.pipeline_id;
    patch.pipeline_name = body.pipeline_name ?? null;
    patch.phase_id = null;
  }

  let settings = await updateTeamleaderSettings(supabase, session.customer.id, patch);

  if (body.pipeline_id) {
    const accessToken = await ensureValidAccessToken(supabase, integration);
    const phaseId = await resolvePhaseIdForPipeline(
      supabase,
      { ...integration, settings },
      accessToken,
      body.pipeline_id,
    );
    if (!phaseId) {
      return NextResponse.json(
        { error: 'Geen fase gevonden voor deze pipeline' },
        { status: 400 },
      );
    }
    settings = (await getTeamleaderIntegration(supabase, session.customer.id))!.settings;
  }

  return NextResponse.json({ settings });
}
