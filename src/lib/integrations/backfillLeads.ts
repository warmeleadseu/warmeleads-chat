import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveIntegrationSyncTargets } from '@/lib/integrations/syncRouting';
import { syncAssignmentToGoogleSheets } from '@/lib/googleSheets/syncAssignment';
import { GOOGLE_SHEETS_PROVIDER } from '@/lib/googleSheets/types';
import { getCrmProvider } from '@/lib/integrations/crmProviders';
import { syncAssignmentToTeamleader } from '@/lib/teamleader/syncAssignment';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';

export const MAX_BACKFILL_LEADS = 50;

export async function fetchAssignedLeadIdsForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const { data } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .eq('customer_id', customerId)
      .neq('source', 'demo')
      .order('assigned_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (!data?.length) break;
    for (const row of data) {
      if (row.lead_id) ids.push(row.lead_id);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return [...new Set(ids)];
}

function mergeBackfillSummaries(
  parts: BackfillLeadsSummary[],
): BackfillLeadsSummary {
  if (parts.length === 0) {
    return {
      provider: null,
      provider_name: null,
      requested: 0,
      synced: 0,
      skipped: 0,
      failed: 0,
      results: [],
    };
  }
  const first = parts[0];
  return {
    provider: first.provider,
    provider_name: first.provider_name,
    requested: parts.reduce((s, p) => s + p.requested, 0),
    synced: parts.reduce((s, p) => s + p.synced, 0),
    skipped: parts.reduce((s, p) => s + p.skipped, 0),
    failed: parts.reduce((s, p) => s + p.failed, 0),
    results: parts.flatMap((p) => p.results),
  };
}

export async function backfillAllAssignedLeadsToIntegration(args: {
  supabase: SupabaseClient;
  customerId: string;
  customerBranches?: string[];
  forceResend?: boolean;
}): Promise<BackfillLeadsSummary> {
  const leadIds = await fetchAssignedLeadIdsForCustomer(args.supabase, args.customerId);
  if (leadIds.length === 0) {
    return {
      provider: null,
      provider_name: null,
      requested: 0,
      synced: 0,
      skipped: 0,
      failed: 0,
      results: [],
    };
  }

  const parts: BackfillLeadsSummary[] = [];
  for (let i = 0; i < leadIds.length; i += MAX_BACKFILL_LEADS) {
    const chunk = leadIds.slice(i, i + MAX_BACKFILL_LEADS);
    parts.push(
      await backfillLeadsToIntegration({
        supabase: args.supabase,
        customerId: args.customerId,
        leadIds: chunk,
        customerBranches: args.customerBranches,
        forceResend: args.forceResend,
      }),
    );
  }
  return mergeBackfillSummaries(parts);
}

export type BackfillLeadStatus = 'synced' | 'skipped' | 'failed';

export type BackfillLeadResult = {
  lead_id: string;
  assignment_id?: string;
  status: BackfillLeadStatus;
  reason?: string;
  error?: string;
};

export type BackfillLeadsSummary = {
  provider: string | null;
  provider_name: string | null;
  requested: number;
  synced: number;
  skipped: number;
  failed: number;
  results: BackfillLeadResult[];
};

async function resolveAssignmentId(
  supabase: SupabaseClient,
  customerId: string,
  leadId: string,
): Promise<string | null> {
  const { data: rows } = await supabase
    .from('lead_assignments')
    .select('id, source, assigned_at')
    .eq('customer_id', customerId)
    .eq('lead_id', leadId)
    .neq('source', 'demo')
    .order('assigned_at', { ascending: false })
    .limit(1);

  if (rows?.[0]?.id) return rows[0].id;

  const { data: lead } = await supabase
    .from('leads')
    .select('id, customer_id, bron')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead || lead.customer_id !== customerId || lead.bron === 'demo') return null;

  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from('lead_assignments')
    .insert({
      customer_id: customerId,
      lead_id: leadId,
      source: 'integration_backfill',
      assigned_at: now,
      status: 'nieuw',
    })
    .select('id')
    .single();

  if (error || !created?.id) return null;
  return created.id;
}

async function getExistingSyncStatus(
  supabase: SupabaseClient,
  assignmentId: string,
  provider: string,
): Promise<'success' | 'failed' | 'pending' | null> {
  const { data } = await supabase
    .from('integration_sync_log')
    .select('status')
    .eq('assignment_id', assignmentId)
    .eq('provider', provider)
    .maybeSingle();
  if (!data?.status) return null;
  return data.status as 'success' | 'failed' | 'pending';
}

export async function backfillLeadsToIntegration(args: {
  supabase: SupabaseClient;
  customerId: string;
  leadIds: string[];
  customerBranches?: string[];
  forceResend?: boolean;
}): Promise<BackfillLeadsSummary> {
  const uniqueLeadIds = [...new Set(args.leadIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_BACKFILL_LEADS,
  );

  const branches = args.customerBranches ?? [];
  const targets = await resolveIntegrationSyncTargets(args.supabase, args.customerId, branches);

  let provider: string | null = null;
  if (targets.google_sheets) provider = GOOGLE_SHEETS_PROVIDER;
  else if (targets.teamleader) provider = TEAMLEADER_PROVIDER;

  const providerMeta = provider ? getCrmProvider(provider) : null;

  const results: BackfillLeadResult[] = [];

  if (!provider) {
    return {
      provider: null,
      provider_name: null,
      requested: uniqueLeadIds.length,
      synced: 0,
      skipped: uniqueLeadIds.length,
      failed: 0,
      results: uniqueLeadIds.map((lead_id) => ({
        lead_id,
        status: 'skipped',
        reason: 'integration_not_ready',
      })),
    };
  }

  for (const leadId of uniqueLeadIds) {
    const assignmentId = await resolveAssignmentId(args.supabase, args.customerId, leadId);
    if (!assignmentId) {
      results.push({ lead_id: leadId, status: 'skipped', reason: 'no_assignment' });
      continue;
    }

    const priorStatus = await getExistingSyncStatus(args.supabase, assignmentId, provider);
    if (priorStatus === 'success' && !args.forceResend) {
      results.push({
        lead_id: leadId,
        assignment_id: assignmentId,
        status: 'skipped',
        reason: 'already_synced',
      });
      continue;
    }

    try {
      const syncArgs = {
        customerId: args.customerId,
        leadId,
        assignmentId,
        options: { forceResend: args.forceResend === true },
      };
      if (provider === GOOGLE_SHEETS_PROVIDER) {
        await syncAssignmentToGoogleSheets(syncArgs);
      } else {
        await syncAssignmentToTeamleader(syncArgs);
      }
      results.push({ lead_id: leadId, assignment_id: assignmentId, status: 'synced' });
    } catch (err) {
      results.push({
        lead_id: leadId,
        assignment_id: assignmentId,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Sync mislukt',
      });
    }
  }

  return {
    provider,
    provider_name: providerMeta?.name ?? null,
    requested: uniqueLeadIds.length,
    synced: results.filter((r) => r.status === 'synced').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  };
}
