import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { partnerOntkoppelen, partnerOpslaan, partnerStatus } from '@/lib/integrations/partners/service';
import { adminPartnerContext } from '../../toegang';

/* Bij koppelen met nasturen worden leads gedoseerd afgeleverd; dat kost even. */
export const maxDuration = 60;

type Ctx = { params: Promise<{ customerId: string; partner: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const c = await adminPartnerContext(request, ctx.params);
  if ('fout' in c) return c.fout;
  return NextResponse.json(await partnerStatus(createServerClient(), c.customerId, c.partner, c.branches), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const c = await adminPartnerContext(request, ctx.params);
  if ('fout' in c) return c.fout;
  const body = (await request.json().catch(() => ({}))) as {
    url?: unknown; enabled?: unknown; branches?: unknown; nasturen_dagen?: unknown;
  };
  const supabase = createServerClient();
  const uitkomst = await partnerOpslaan(
    supabase,
    c.customerId,
    c.partner,
    {
      url: typeof body.url === 'string' && body.url.trim() ? body.url : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      branches: Array.isArray(body.branches) ? (body.branches as string[]) : undefined,
      nasturen_dagen: typeof body.nasturen_dagen === 'number' ? body.nasturen_dagen : undefined,
    },
    c.branches,
    c.actor,
  );
  if (!uitkomst.ok) return NextResponse.json({ error: uitkomst.fout }, { status: 400 });
  return NextResponse.json({
    ...(await partnerStatus(supabase, c.customerId, c.partner, c.branches)),
    nagestuurd: uitkomst.nagestuurd,
  });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const c = await adminPartnerContext(request, ctx.params);
  if ('fout' in c) return c.fout;
  await partnerOntkoppelen(createServerClient(), c.customerId, c.partner, c.actor);
  return NextResponse.json({ ok: true });
}
