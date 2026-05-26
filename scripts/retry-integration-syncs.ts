/**
 * Herstel mislukte of ontbrekende CRM/Sheets-syncs voor één klant.
 *
 *   set -a && source .env.vercel.integration && set +a
 *   npx tsx scripts/retry-integration-syncs.ts --customer-name="Mediabink" --provider=google_sheets
 *   npx tsx scripts/retry-integration-syncs.ts --customer-name="Next Gen home" --provider=teamleader
 *   npx tsx scripts/retry-integration-syncs.ts --customer-name="Mediabink" --since=2026-05-26
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { syncAssignmentToGoogleSheets } from '../src/lib/googleSheets/syncAssignment';
import { GOOGLE_SHEETS_PROVIDER } from '../src/lib/googleSheets/types';
import { syncAssignmentToTeamleader } from '../src/lib/teamleader/syncAssignment';
import { TEAMLEADER_PROVIDER } from '../src/lib/teamleader/types';
import { resolveIntegrationSyncTargets } from '../src/lib/integrations/syncRouting';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.integration'), override: true });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const DRY_RUN = process.argv.includes('--dry-run');
const customerArg = process.argv.find((a) => a.startsWith('--customer-name='));
const providerArg = process.argv.find((a) => a.startsWith('--provider='));
const sinceArg = process.argv.find((a) => a.startsWith('--since='));

const customerNamePattern = customerArg?.split('=').slice(1).join('=').trim() || '';
const providerFilter = providerArg?.split('=')[1]?.trim() || 'both';
const sinceIso = sinceArg ? `${sinceArg.split('=')[1].trim()}T00:00:00Z` : null;

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt');
  return createClient(url, key);
}

async function resolveCustomerId(sb: ReturnType<typeof supabase>): Promise<string> {
  if (!customerNamePattern) throw new Error('Geef --customer-name=... mee');
  const { data: rows, error } = await sb
    .from('customers')
    .select('id, name, branches')
    .ilike('name', `%${customerNamePattern}%`);
  if (error) throw new Error(error.message);
  if (!rows?.length) throw new Error(`Geen klant voor "${customerNamePattern}"`);
  if (rows.length > 1) {
    console.warn('Meerdere matches, neem eerste:', rows.map((r) => r.name).join(', '));
  }
  return rows[0].id as string;
}

async function main() {
  const sb = supabase();
  const customerId = await resolveCustomerId(sb);

  const { data: customer } = await sb
    .from('customers')
    .select('name, branches')
    .eq('id', customerId)
    .single();
  const branches = (customer?.branches as string[] | null) ?? [];
  const targets = await resolveIntegrationSyncTargets(sb, customerId, branches);

  console.log(`Klant: ${customer?.name}${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log('Sync targets:', targets);

  let assignQuery = sb
    .from('lead_assignments')
    .select('id, lead_id, assigned_at')
    .eq('customer_id', customerId)
    .neq('source', 'demo')
    .order('assigned_at', { ascending: true });
  if (sinceIso) assignQuery = assignQuery.gte('assigned_at', sinceIso);

  const { data: assignments, error: assignErr } = await assignQuery;
  if (assignErr) throw new Error(assignErr.message);
  const list = assignments || [];
  console.log(`${list.length} toewijzing(en) in scope.`);

  const providers: string[] = [];
  if (providerFilter === 'both') {
    if (targets.google_sheets) providers.push(GOOGLE_SHEETS_PROVIDER);
    if (targets.teamleader) providers.push(TEAMLEADER_PROVIDER);
  } else if (providerFilter === 'google_sheets') {
    providers.push(GOOGLE_SHEETS_PROVIDER);
  } else if (providerFilter === 'teamleader') {
    providers.push(TEAMLEADER_PROVIDER);
  } else {
    throw new Error('provider moet both, google_sheets of teamleader zijn');
  }

  if (providers.length === 0) {
    console.log('Geen actieve integratie om te syncen.');
    return;
  }

  const assignmentIds = list.map((a) => a.id);
  const { data: logs } = assignmentIds.length
    ? await sb
        .from('integration_sync_log')
        .select('assignment_id, provider, status')
        .eq('customer_id', customerId)
        .in('assignment_id', assignmentIds)
        .in('provider', providers)
    : { data: [] };

  const successKeys = new Set(
    (logs || []).filter((l) => l.status === 'success').map((l) => `${l.assignment_id}:${l.provider}`),
  );

  type Job = { assignmentId: string; leadId: string; provider: string; reason: string };
  const jobs: Job[] = [];

  for (const a of list) {
    for (const provider of providers) {
      const key = `${a.id}:${provider}`;
      if (successKeys.has(key)) continue;
      const log = (logs || []).find((l) => l.assignment_id === a.id && l.provider === provider);
      jobs.push({
        assignmentId: a.id,
        leadId: a.lead_id,
        provider,
        reason: log?.status === 'failed' ? 'failed' : 'missing',
      });
    }
  }

  console.log(`Te syncen: ${jobs.length} (${jobs.filter((j) => j.reason === 'failed').length} failed, ${jobs.filter((j) => j.reason === 'missing').length} missing)`);

  if (DRY_RUN || jobs.length === 0) return;

  let synced = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      if (job.provider === GOOGLE_SHEETS_PROVIDER) {
        await syncAssignmentToGoogleSheets({
          customerId,
          leadId: job.leadId,
          assignmentId: job.assignmentId,
          options: { forceResend: job.reason === 'failed' },
        });
      } else {
        await syncAssignmentToTeamleader({
          customerId,
          leadId: job.leadId,
          assignmentId: job.assignmentId,
          options: { forceResend: job.reason === 'failed' },
        });
      }

      const { data: log } = await sb
        .from('integration_sync_log')
        .select('status, error_message')
        .eq('assignment_id', job.assignmentId)
        .eq('provider', job.provider)
        .maybeSingle();

      if (log?.status !== 'success') {
        throw new Error(log?.error_message || 'Sync niet geslaagd (geen success in log)');
      }

      synced++;
      if (synced % 5 === 0) console.log(`… ${synced}/${jobs.length}`);
    } catch (err) {
      failed++;
      console.error(`FAIL ${job.leadId} (${job.provider}):`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Klaar: ${synced} gelukt, ${failed} mislukt, ${jobs.length} totaal.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
