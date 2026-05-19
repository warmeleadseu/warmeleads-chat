/**
 * Lichtgewicht endpoint voor de Studio: telt valid leads per branche+land
 * en geeft eventueel bestaande lookalike audience-IDs terug zodat de UI
 * een waarschuwing kan tonen als er te weinig seed-leads zijn.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { countBranchLeads, getBranchAudiencePack } from '@/lib/metaCustomAudiences';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const branch = request.nextUrl.searchParams.get('branch');
  const country = request.nextUrl.searchParams.get('country') || 'NL';
  if (!branch) return NextResponse.json({ error: 'branch is verplicht' }, { status: 400 });

  const [count, pack] = await Promise.all([
    countBranchLeads(branch, country),
    getBranchAudiencePack(branch, country, 0.01),
  ]);

  return NextResponse.json({
    branch,
    country,
    lead_count: count,
    audience: pack,
  });
}

export async function POST(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const body = (await request.json().catch(() => null)) as { branch?: string; country?: string } | null;
  if (!body?.branch) return NextResponse.json({ error: 'branch is verplicht' }, { status: 400 });
  const country = body.country || 'NL';

  const { buildBranchAudiencePack } = await import('@/lib/metaCustomAudiences');
  const result = await buildBranchAudiencePack(body.branch, country, 0.01);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
