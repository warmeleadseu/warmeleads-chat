import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { runOptimizerTick } from '@/lib/aiCampaignOptimizer';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  dry_run: z.boolean().default(true),
  experiment_id: z.string().uuid().optional(),
});

/**
 * Handmatig de optimizer triggeren vanuit de admin-UI (default dry-run).
 * Cron-versie zit op /api/cron/ai-campaign-optimizer.
 */
export async function POST(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;
  const parse = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parse.success) return NextResponse.json({ error: 'Ongeldige input', details: parse.error.issues }, { status: 400 });
  const { dry_run, experiment_id } = parse.data;
  const summary = await runOptimizerTick({ dryRun: dry_run, experimentId: experiment_id });
  return NextResponse.json({ ok: true, dry_run, ...summary });
}
