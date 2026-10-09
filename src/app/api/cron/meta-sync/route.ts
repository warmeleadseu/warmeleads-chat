import { NextRequest, NextResponse } from 'next/server';
import { syncMetaAdSpend } from '@/lib/meta';
import { verifyCronAuth } from '@/lib/cronAuth';

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

  return NextResponse.json({
    ok: result.errors.length === 0,
    dateFrom,
    dateTo,
    adRowsSynced: result.synced,
    leadsUpdated: result.leadsUpdated,
    truncated: result.truncated ?? false,
    computeMs: result.computeMs,
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
