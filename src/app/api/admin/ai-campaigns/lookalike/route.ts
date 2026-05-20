/**
 * Lookalike-endpoint voor de Studio.
 *
 *  GET  /api/admin/ai-campaigns/lookalike?branch=...&country=NL
 *    → tellen + huidige audience-pack lezen (geen Meta-call).
 *
 *  POST /api/admin/ai-campaigns/lookalike
 *    body: { branch, country?, force? }
 *    → ensure-build van het pakket. Default reuse-on-fresh; met force=true
 *      forceren we een rebuild zodat een verse seed/LAL aangemaakt wordt.
 *
 * Strategize roept dit zelf óók aan, maar admins kunnen via deze route
 * tussendoor handmatig een audience refreshen/bouwen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import {
  countBranchLeads,
  getBranchAudiencePack,
  ensureBranchAudiencePack,
  buildBranchAudiencePack,
} from '@/lib/metaCustomAudiences';

export const runtime = 'nodejs';
export const maxDuration = 180;

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

  const body = (await request.json().catch(() => null)) as {
    branch?: string;
    country?: string;
    force?: boolean;
  } | null;
  if (!body?.branch) return NextResponse.json({ error: 'branch is verplicht' }, { status: 400 });
  const country = body.country || 'NL';

  const result = body.force
    ? await buildBranchAudiencePack(body.branch, country, 0.01, { force: true })
    : await ensureBranchAudiencePack(body.branch, country, 0.01);

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      branch: body.branch,
      country,
      lookalike_id: result.lookalikeAudienceId ?? null,
      exclusion_id: result.exclusionAudienceId ?? null,
      seed_lead_count: result.seedSize ?? 0,
      freshly_built: result.freshlyBuilt ?? false,
      reused_existing: result.reusedExisting ?? false,
      status: result.status ?? 'ready',
    });
  }

  // Mappings naar nette HTTP statussen
  const status =
    result.reason === 'lookalike_disabled' ? 409 :
    result.reason === 'no_meta_credentials' ? 503 :
    result.reason === 'insufficient_seed' ? 422 :
    502;

  return NextResponse.json(
    {
      ok: false,
      error:
        result.reason === 'insufficient_seed'
          ? `Te weinig leads voor lookalike (${result.seedSize ?? 0} < 100)`
          : result.reason === 'lookalike_disabled'
            ? 'Lookalike-pipeline is uitgeschakeld via AI_LOOKALIKE_ENABLED=false'
            : result.reason === 'no_meta_credentials'
              ? 'Geen Meta-credentials geconfigureerd'
              : `Audience build faalde: ${result.reason ?? 'onbekende fout'}`,
      reason: result.reason,
      seed_lead_count: result.seedSize ?? 0,
      status: result.status ?? 'failed',
    },
    { status },
  );
}
