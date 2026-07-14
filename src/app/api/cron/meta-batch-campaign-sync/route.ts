import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { reconcileMetaCampaignsForCron } from '@/lib/metaBatchCampaignSync';
import { verifyCronAuth } from '@/lib/cronAuth';

/**
 * Elke 15 min: zet Meta-campagnes op ACTIVE/PAUSED volgens **actieve** batches
 * (voltooide batches met oude koppelingen worden genegeerd).
 */
export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const result = await reconcileMetaCampaignsForCron(supabase, 80);

  return NextResponse.json({
    ok: result.errors.length === 0,
    processed: result.processed,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
