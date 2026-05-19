import { NextRequest, NextResponse } from 'next/server';
import { runOptimizerTick } from '@/lib/aiCampaignOptimizer';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dry') === '1';
  const t0 = Date.now();
  const summary = await runOptimizerTick({ dryRun });
  const ms = Date.now() - t0;
  console.info('[cron/ai-campaign-optimizer]', { ms, summary });
  return NextResponse.json({ ok: true, dryRun, computeMs: ms, ...summary, timestamp: new Date().toISOString() });
}
