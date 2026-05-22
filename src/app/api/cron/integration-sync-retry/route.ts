import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { syncAssignmentToGoogleSheets } from '@/lib/googleSheets/syncAssignment';
import { GOOGLE_SHEETS_PROVIDER } from '@/lib/googleSheets/types';
import { syncAssignmentToTeamleader } from '@/lib/teamleader/syncAssignment';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';

const MAX_ATTEMPTS = 5;

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: failed } = await supabase
    .from('integration_sync_log')
    .select('customer_id, lead_id, assignment_id, attempts, created_at, provider')
    .in('provider', [TEAMLEADER_PROVIDER, GOOGLE_SHEETS_PROVIDER])
    .eq('status', 'failed')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(40);

  if (!failed?.length) {
    return NextResponse.json({ retried: 0 });
  }

  let retried = 0;
  let succeeded = 0;

  for (const row of failed) {
    const hoursSince = (Date.now() - new Date(row.created_at).getTime()) / 3_600_000;
    const minWaitHours = Math.min(24, Math.pow(2, Math.max(0, row.attempts - 1)));
    if (hoursSince < minWaitHours) continue;

    try {
      if (row.provider === GOOGLE_SHEETS_PROVIDER) {
        await syncAssignmentToGoogleSheets({
          customerId: row.customer_id,
          leadId: row.lead_id,
          assignmentId: row.assignment_id,
        });
      } else {
        await syncAssignmentToTeamleader({
          customerId: row.customer_id,
          leadId: row.lead_id,
          assignmentId: row.assignment_id,
        });
      }
      succeeded++;
    } catch {
      /* logged in sync log */
    }
    retried++;
  }

  return NextResponse.json({ retried, succeeded });
}
