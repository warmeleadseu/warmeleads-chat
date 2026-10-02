import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { partnerOpId } from '@/lib/integrations/partners/registry';
import { partnerTest } from '@/lib/integrations/partners/service';

/** Testlevering met nepgegevens; met een nieuw adres (nog niet opgeslagen) of het opgeslagen adres. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ partner: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const geweigerd = requireIntegrationOwner(session);
  if (geweigerd) return geweigerd;
  const partner = partnerOpId((await ctx.params).partner);
  if (!partner) return NextResponse.json({ error: 'Onbekende partner' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  const uitkomst = await partnerTest(
    createServerClient(),
    session.customer.id,
    partner,
    typeof body.url === 'string' && body.url.trim() ? body.url : undefined,
    { soort: 'portaal', id: session.portalUser?.id ?? null, naam: session.portalUser?.name ?? session.customer.name },
  );
  return NextResponse.json(uitkomst);
}
