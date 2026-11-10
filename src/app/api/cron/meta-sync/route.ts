import { NextRequest, NextResponse } from 'next/server';
import { syncMetaAdSpend } from '@/lib/meta';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { alarmeerSuperadmins, escHtml } from '@/lib/superadminAlarm';

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

  /* Mislukte sync niet stil laten: zonder uitgaven kloppen de kosten per
     lead, de winst per batch en de CPL niet. Hooguit één mail per dag. */
  if (result.errors.length > 0) {
    const fouten = result.errors.slice(0, 5).map(f => `<li>${escHtml(String(f)).slice(0, 300)}</li>`).join('');
    await alarmeerSuperadmins(
      createServerClient(),
      'meta_sync_fout',
      'De Meta-uitgaven konden niet (volledig) worden opgehaald',
      `<p style="font-size:14px;color:#334155;line-height:1.6">De sync van ${escHtml(dateFrom)} t/m ${escHtml(dateTo)} gaf ${result.errors.length} ${result.errors.length === 1 ? 'fout' : 'fouten'}. Zolang dit zo blijft, kloppen de advertentiekosten, de kosten per lead en de winst niet.</p>
       <ul style="font-size:13px;color:#475569">${fouten}</ul>
       <p style="font-size:14px;color:#334155;line-height:1.6">Meestal is het Meta-token verlopen; vernieuw het onder Koppelingen. De sync draait zes keer per dag opnieuw.</p>`,
      { fouten: result.errors.slice(0, 5) },
    ).catch(e => console.error('[cron/meta-sync] alarm mislukt', e));
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
    timestamp: new Date().toISOString(),
  });
}
