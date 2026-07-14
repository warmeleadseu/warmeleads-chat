import { NextRequest, NextResponse } from 'next/server';
import { runOptimizerTick } from '@/lib/aiCampaignOptimizer';
import { verifyCronAuth } from '@/lib/cronAuth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const dryRun = request.nextUrl.searchParams.get('dry') === '1';
  const t0 = Date.now();
  const summary = await runOptimizerTick({ dryRun });
  const ms = Date.now() - t0;
  console.info('[cron/ai-campaign-optimizer]', { ms, summary });
  return NextResponse.json({ ok: true, dryRun, computeMs: ms, ...summary, timestamp: new Date().toISOString() });
}
