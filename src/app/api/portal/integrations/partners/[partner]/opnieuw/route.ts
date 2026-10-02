import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { partnerOpId } from '@/lib/integrations/partners/registry';
import { partnerOpnieuw } from '@/lib/integrations/partners/service';

/* Leveringen gaan gedoseerd (limiet van de partner); dat kost even. */
export const maxDuration = 60;

/** Mislukte leveringen opnieuw proberen, met een schone teller. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const geweigerd = requireIntegrationOwner(session);
  if (geweigerd) return geweigerd;
  const partner = partnerOpId((await ctx.params).partner);
  if (!partner) return NextResponse.json({ error: 'Onbekende partner' }, { status: 404 });

  const uitkomst = await partnerOpnieuw(createServerClient(), session.customer.id, partner, {
    soort: 'portaal',
    id: session.portalUser?.id ?? null,
    naam: session.portalUser?.name ?? session.customer.name,
  });
  return NextResponse.json(uitkomst);
}
