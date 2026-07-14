import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  resolveIntegrationSyncTargets,
  shouldRetryIntegrationSync,
} from '@/lib/integrations/syncRouting';
import { syncAssignmentToGoogleSheets } from '@/lib/googleSheets/syncAssignment';
import { GOOGLE_SHEETS_PROVIDER } from '@/lib/googleSheets/types';
import { syncAssignmentToTeamleader } from '@/lib/teamleader/syncAssignment';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';
import { getTeamleaderConnectionState } from '@/lib/teamleader/integrationRepo';
import { syncAssignmentToOutboundWebhook } from '@/lib/integrations/outboundWebhook/syncAssignment';
import { verifyCronAuth } from '@/lib/cronAuth';
import {
  OUTBOUND_WEBHOOK_PROVIDER,
  type OutboundWebhookSettings,
} from '@/lib/integrations/outboundWebhook/types';
import {
  getOutboundWebhookConfig,
  isBranchAllowed,
  isOutboundWebhookSyncReady,
} from '@/lib/integrations/outboundWebhook/integrationRepo';

const MAX_ATTEMPTS = 8;
const MISSING_LOOKBACK_HOURS = 72;
const MISSING_BATCH_LIMIT = 30;

/** Minuten wachten vóór retry (attempt 1 = direct, daarna backoff). */
function retryWaitMinutes(attempts: number): number {
  if (attempts <= 1) return 0;
  if (attempts === 2) return 5;
  if (attempts === 3) return 15;
  if (attempts === 4) return 60;
  if (attempts === 5) return 240;
  return 24 * 60;
}

type SyncJob = {
  customer_id: string;
  lead_id: string;
  assignment_id: string;
  provider: string;
  attempts: number;
  created_at: string;
};

async function runSyncJob(
  supabase: ReturnType<typeof createServerClient>,
  row: SyncJob,
): Promise<boolean> {
  const { data: customer } = await supabase
    .from('customers')
    .select('branches')
    .eq('id', row.customer_id)
    .maybeSingle();
  const branches = (customer?.branches as string[] | null) ?? [];

  const mayRetry = await shouldRetryIntegrationSync(
    supabase,
    row.customer_id,
    row.provider,
    branches,
  );
  if (!mayRetry) return false;

  if (row.provider === TEAMLEADER_PROVIDER) {
    const conn = await getTeamleaderConnectionState(supabase, row.customer_id);
    if (conn.connected && !conn.tokensReadable) return false;
  }

  if (row.provider === GOOGLE_SHEETS_PROVIDER) {
    await syncAssignmentToGoogleSheets({
      customerId: row.customer_id,
      leadId: row.lead_id,
      assignmentId: row.assignment_id,
    });
  } else if (row.provider === TEAMLEADER_PROVIDER) {
    await syncAssignmentToTeamleader({
      customerId: row.customer_id,
      leadId: row.lead_id,
      assignmentId: row.assignment_id,
    });
  } else if (row.provider === OUTBOUND_WEBHOOK_PROVIDER) {
    await syncAssignmentToOutboundWebhook({
      customerId: row.customer_id,
      leadId: row.lead_id,
      assignmentId: row.assignment_id,
    });
  } else {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();
  const jobs: SyncJob[] = [];
  const seen = new Set<string>();

  const { data: failed } = await supabase
    .from('integration_sync_log')
    .select('customer_id, lead_id, assignment_id, attempts, created_at, provider')
    .in('provider', [TEAMLEADER_PROVIDER, GOOGLE_SHEETS_PROVIDER, OUTBOUND_WEBHOOK_PROVIDER])
    .eq('status', 'failed')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(60);

  for (const row of failed || []) {
    const key = `${row.assignment_id}:${row.provider}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jobs.push(row as SyncJob);
  }

  const cutoff = new Date(Date.now() - MISSING_LOOKBACK_HOURS * 3_600_000).toISOString();
  const { data: recentAssignments } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, customer_id, assigned_at, customers(branches), leads(branch, bron)')
    .gte('assigned_at', cutoff)
    .neq('source', 'demo')
    .order('assigned_at', { ascending: true })
    .limit(200);

  for (const a of recentAssignments || []) {
    if (jobs.length >= 60 + MISSING_BATCH_LIMIT) break;
    const branches = ((a as { customers?: { branches?: string[] } }).customers?.branches ??
      []) as string[];
    const lead = (a as { leads?: { branch?: string | null; bron?: string | null } }).leads;
    const targets = await resolveIntegrationSyncTargets(supabase, a.customer_id, branches);
    const providers: string[] = [];
    if (targets.google_sheets) providers.push(GOOGLE_SHEETS_PROVIDER);
    if (targets.teamleader) providers.push(TEAMLEADER_PROVIDER);

    const webhookConfig = await getOutboundWebhookConfig(supabase, a.customer_id);
    if (
      isOutboundWebhookSyncReady(webhookConfig) &&
      lead?.bron !== 'demo' &&
      isBranchAllowed(webhookConfig.settings as OutboundWebhookSettings, lead?.branch ?? null)
    ) {
      providers.push(OUTBOUND_WEBHOOK_PROVIDER);
    }

    for (const provider of providers) {
      const key = `${a.id}:${provider}`;
      if (seen.has(key)) continue;

      const { data: log } = await supabase
        .from('integration_sync_log')
        .select('status')
        .eq('assignment_id', a.id)
        .eq('provider', provider)
        .maybeSingle();
      if (log?.status === 'success') continue;

      seen.add(key);
      jobs.push({
        customer_id: a.customer_id,
        lead_id: a.lead_id,
        assignment_id: a.id,
        provider,
        attempts: 0,
        created_at: a.assigned_at,
      });
      if (jobs.filter((j) => j.attempts === 0).length >= MISSING_BATCH_LIMIT) break;
    }
  }

  let retried = 0;
  let succeeded = 0;

  for (const row of jobs) {
    if (row.attempts > 0) {
      const minutesSince = (Date.now() - new Date(row.created_at).getTime()) / 60_000;
      const minWaitMinutes = retryWaitMinutes(row.attempts);
      if (minutesSince < minWaitMinutes) continue;
    }

    try {
      const ok = await runSyncJob(supabase, row);
      if (ok) succeeded++;
    } catch {
      /* logged in sync log */
    }
    retried++;
  }

  return NextResponse.json({ retried, succeeded, queued: jobs.length });
}
