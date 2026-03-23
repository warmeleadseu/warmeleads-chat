import { NextRequest, NextResponse } from 'next/server';
import { syncMetaAdSpend } from '@/lib/meta';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    errors: result.errors,
    timestamp: new Date().toISOString(),
  });
}
