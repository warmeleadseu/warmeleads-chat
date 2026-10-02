import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { partnerOpId } from '@/lib/integrations/partners/registry';
import { partnerOntkoppelen, partnerOpslaan, partnerStatus, type Actor } from '@/lib/integrations/partners/service';
import type { PortalSession } from '@/lib/portalPermissions';

/**
 * Partnerkoppeling (bijvoorbeeld Snelraak) vanuit het klantportaal. Alleen de
 * accounteigenaar, net als bij de andere koppelingen. Het afleveradres gaat
 * nooit terug naar de browser; alleen een hint met de laatste vier tekens.
 */

type Ctx = { params: Promise<{ partner: string }> };

function actorVan(session: PortalSession): Actor {
  return { soort: 'portaal', id: session.portalUser?.id ?? null, naam: session.portalUser?.name ?? session.customer.name };
}

async function context(request: NextRequest, ctx: Ctx) {
  const session = await verifyCustomer(request);
  if (!session) return { fout: portalUnauthorized() } as const;
  const geweigerd = requireIntegrationOwner(session);
  if (geweigerd) return { fout: geweigerd } as const;
  const partner = partnerOpId((await ctx.params).partner);
  if (!partner) return { fout: NextResponse.json({ error: 'Onbekende partner' }, { status: 404 }) } as const;
  return { session, partner } as const;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const c = await context(request, ctx);
  if ('fout' in c) return c.fout;
  const status = await partnerStatus(createServerClient(), c.session.customer.id, c.partner, c.session.customer.branches ?? []);
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const c = await context(request, ctx);
  if ('fout' in c) return c.fout;
  const body = (await request.json().catch(() => ({}))) as { url?: unknown; enabled?: unknown; branches?: unknown };

  const supabase = createServerClient();
  const uitkomst = await partnerOpslaan(
    supabase,
    c.session.customer.id,
    c.partner,
    {
      url: typeof body.url === 'string' && body.url.trim() ? body.url : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      branches: Array.isArray(body.branches) ? (body.branches as string[]) : undefined,
    },
    c.session.customer.branches ?? [],
    actorVan(c.session),
  );
  if (!uitkomst.ok) return NextResponse.json({ error: uitkomst.fout }, { status: 400 });
  return NextResponse.json(
    await partnerStatus(supabase, c.session.customer.id, c.partner, c.session.customer.branches ?? []),
  );
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const c = await context(request, ctx);
  if ('fout' in c) return c.fout;
  await partnerOntkoppelen(createServerClient(), c.session.customer.id, c.partner, actorVan(c.session));
  return NextResponse.json({ ok: true });
}
