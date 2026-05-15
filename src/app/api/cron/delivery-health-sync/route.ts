import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * Ververst batch_delivery_daily (tellingen per batch per kalenderdag Amsterdam).
 * Gepland via Vercel Cron; zelfde auth als andere crons.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.rpc('refresh_batch_delivery_daily', { p_days: 14 });
  if (error) {
    console.error('[cron/delivery-health-sync]', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
