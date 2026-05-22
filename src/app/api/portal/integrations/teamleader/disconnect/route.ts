import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  disconnectTeamleader,
  fullyRemoveTeamleader,
} from '@/lib/teamleader/integrationRepo';
import { invalidatePipelineCache } from '@/lib/teamleader/pipelineCache';

/**
 * Default ontkoppelt alleen de OAuth-tokens (klant kan opnieuw verbinden
 * zonder client_id/secret opnieuw te plakken). Met `?purge=1` wordt de
 * volledige rij — inclusief de eigen OAuth-app credentials — verwijderd.
 */
export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const purge = request.nextUrl.searchParams.get('purge') === '1';
  const supabase = createServerClient();
  if (purge) {
    await fullyRemoveTeamleader(supabase, session.customer.id);
  } else {
    await disconnectTeamleader(supabase, session.customer.id);
  }
  invalidatePipelineCache(session.customer.id);
  return NextResponse.json({ ok: true, purged: purge });
}
