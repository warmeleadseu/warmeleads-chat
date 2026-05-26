import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  AVAILABLE_CRM_IDS,
  CRM_PROVIDERS,
  getCrmProvider,
  isCrmProviderAvailable,
  type CrmProviderId,
} from '@/lib/integrations/crmProviders';
import {
  getPreferredCrmProvider,
  resolveEffectiveCrmProvider,
  setPreferredCrmProvider,
} from '@/lib/integrations/crmPreferences';
import {
  isGoogleSheetsSyncReady,
  isTeamleaderSyncReady,
} from '@/lib/integrations/syncRouting';
import { getGoogleSheetsIntegrationPublic } from '@/lib/googleSheets/integrationRepo';
import { getTeamleaderIntegration } from '@/lib/teamleader/integrationRepo';
import { getCustomerOAuthConfig, getGlobalOAuthConfig } from '@/lib/teamleader/credentials';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const customerId = session.customer.id;
  const branches = session.customer.branches ?? [];

  const [
    preferredStored,
    teamleaderIntegration,
    sheetsIntegration,
    customerCfg,
    globalCfg,
  ] = await Promise.all([
    getPreferredCrmProvider(supabase, customerId),
    getTeamleaderIntegration(supabase, customerId),
    getGoogleSheetsIntegrationPublic(supabase, customerId),
    getCustomerOAuthConfig(supabase, customerId),
    getGlobalOAuthConfig(),
  ]);

  const teamleaderConnected = !!teamleaderIntegration?.connected_at;
  const sheetsConnected = !!sheetsIntegration?.connected_at;
  const teamleaderSyncReady = isTeamleaderSyncReady(teamleaderIntegration);
  const sheetsSyncReady = isGoogleSheetsSyncReady(sheetsIntegration, branches);

  const preferred = resolveEffectiveCrmProvider(
    preferredStored,
    teamleaderConnected,
    sheetsConnected,
  );

  return NextResponse.json({
    preferred_crm_provider: preferred,
    providers: CRM_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      description: p.description,
      status: p.status,
    })),
    connections: {
      teamleader: {
        connected: teamleaderConnected,
        configured: !!(customerCfg || globalCfg),
        sync_ready: teamleaderSyncReady,
      },
      google_sheets: {
        connected: sheetsConnected,
        configured: sheetsConnected,
        sync_ready: sheetsSyncReady,
      },
    },
  });
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json()) as { preferred_crm_provider?: string };
  const providerId = body.preferred_crm_provider?.trim();

  if (!providerId || !getCrmProvider(providerId)) {
    return NextResponse.json({ error: 'Kies een geldig CRM-systeem' }, { status: 400 });
  }

  if (!isCrmProviderAvailable(providerId)) {
    return NextResponse.json(
      { error: `${getCrmProvider(providerId)?.name ?? 'Dit CRM'} is nog niet beschikbaar` },
      { status: 400 },
    );
  }

  if (!AVAILABLE_CRM_IDS.includes(providerId as CrmProviderId)) {
    return NextResponse.json({ error: 'CRM niet ondersteund' }, { status: 400 });
  }

  const supabase = createServerClient();

  try {
    await setPreferredCrmProvider(supabase, session.customer.id, providerId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Opslaan mislukt';
    console.error('[integrations/preferences] save failed:', message);
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }

  return NextResponse.json({ preferred_crm_provider: providerId });
}
