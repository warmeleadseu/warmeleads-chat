import { NextRequest, NextResponse } from 'next/server';
import { syncMetaAdSpend } from '@/lib/meta';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const now = new Date();
  const dateTo = now.toISOString().split('T')[0];

  // Sync last 7 days to catch late attribution and spend corrections
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const dateFrom = from.toISOString().split('T')[0];

  const result = await syncMetaAdSpend(dateFrom, dateTo);

  /* Kosten per lead bijwerken voor de winst per batch. Meta corrigeert
     uitgaven achteraf nog; daarom de laatste 30 dagen opnieuw. */
  let leadKostenBijgewerkt: number | null = null;
  let leadKostenFout: string | null = null;
  {
    const vanaf = new Date(now);
    vanaf.setDate(vanaf.getDate() - 30);
    const { data, error } = await createServerClient().rpc('herbereken_lead_kosten', { p_vanaf: vanaf.toISOString().slice(0, 10) });
    if (error) {
      leadKostenFout = error.message;
      console.error('[cron/meta-sync] lead_kosten herberekenen mislukt:', error.message);
    } else leadKostenBijgewerkt = Number(data) || 0;
  }

  return NextResponse.json({
    ok: result.errors.length === 0,
    dateFrom,
    dateTo,
    adRowsSynced: result.synced,
    leadsUpdated: result.leadsUpdated,
    truncated: result.truncated ?? false,
    computeMs: result.computeMs,
    errors: result.errors,
    leadKostenBijgewerkt,
    leadKostenFout,
    timestamp: new Date().toISOString(),
  });
}
