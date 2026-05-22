import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  AVAILABLE_CRM_IDS,
  CRM_PROVIDERS,
  getCrmProvider,
  isCrmProviderAvailable,
} from '@/lib/integrations/crmProviders';
import { getTeamleaderIntegration } from '@/lib/teamleader/integrationRepo';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const customerId = session.customer.id;

  const [{ data: customer }, integration] = await Promise.all([
    supabase.from('customers').select('preferred_crm_provider').eq('id', customerId).single(),
    getTeamleaderIntegration(supabase, customerId),
  ]);

  const teamleaderConnected = !!integration?.connected_at;
  let preferred = (customer?.preferred_crm_provider as string | null) ?? null;

  if (teamleaderConnected && preferred !== 'teamleader') {
    preferred = 'teamleader';
  }

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
        configured: !!integration || teamleaderConnected,
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

  if (!AVAILABLE_CRM_IDS.includes(providerId as (typeof AVAILABLE_CRM_IDS)[number])) {
    return NextResponse.json({ error: 'CRM niet ondersteund' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('customers')
    .update({
      preferred_crm_provider: providerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.customer.id);

  if (error) {
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }

  return NextResponse.json({ preferred_crm_provider: providerId });
}
