import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { reconcileMetaCampaignsForCron } from '@/lib/metaBatchCampaignSync';

/**
 * Elke 15 min: zet Meta-campagnes op ACTIVE/PAUSED volgens batch-state
 * (betaald, actief, vol, pauze, sync-vlag) én `starts_at` (geen ads vóór startmoment).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const result = await reconcileMetaCampaignsForCron(supabase, 80);

  return NextResponse.json({
    ok: result.errors.length === 0,
    processed: result.processed,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
