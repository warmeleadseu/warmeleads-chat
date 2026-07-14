import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyCronAuth } from '@/lib/cronAuth';

/**
 * Ververst batch_delivery_daily (tellingen per batch per kalenderdag Amsterdam).
 * Gepland via Vercel Cron; zelfde auth als andere crons.
 */
export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const { error } = await supabase.rpc('refresh_batch_delivery_daily', { p_days: 14 });
  if (error) {
    console.error('[cron/delivery-health-sync]', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
