import { createServerClient } from '@/lib/supabase';
import { syncLeadRecordToTeamleader } from './syncLeadRecord';
import {
  ensureValidAccessToken,
  getTeamleaderIntegration,
  resolvePhaseIdForPipeline,
} from './integrationRepo';
import { TEAMLEADER_PROVIDER } from './types';

export type SyncAssignmentArgs = {
  customerId: string;
  leadId: string;
  assignmentId: string;
};

export async function syncAssignmentToTeamleader(args: SyncAssignmentArgs): Promise<void> {
  const supabase = createServerClient();
  const { customerId, leadId, assignmentId } = args;

  const integration = await getTeamleaderIntegration(supabase, customerId);
  if (!integration?.connected_at) return;
  if (integration.settings.enabled === false) return;
  const pipelineId = integration.settings.pipeline_id;
  if (!pipelineId) return;

  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('id, customer_id, lead_id')
    .eq('id', assignmentId)
    .maybeSingle();
  if (!assignment || assignment.customer_id !== customerId || assignment.lead_id !== leadId) {
    return;
  }

  const { data: existingLog } = await supabase
    .from('integration_sync_log')
    .select('id, status, attempts')
    .eq('assignment_id', assignmentId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .maybeSingle();
  if (existingLog?.status === 'success') return;

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (!lead || lead.bron === 'demo') return;

  const logPayload = {
    customer_id: customerId,
    lead_id: leadId,
    assignment_id: assignmentId,
    provider: TEAMLEADER_PROVIDER,
    status: 'pending' as const,
    attempts: (existingLog?.attempts ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };

  if (existingLog?.id) {
    await supabase.from('integration_sync_log').update(logPayload).eq('id', existingLog.id);
  } else {
    const { error: insErr } = await supabase.from('integration_sync_log').insert({
      ...logPayload,
      attempts: 1,
    });
    if (insErr?.code === '23505') return;
  }

  try {
    const accessToken = await ensureValidAccessToken(supabase, integration);
    const phaseId =
      integration.settings.phase_id ||
      (await resolvePhaseIdForPipeline(supabase, integration, accessToken, pipelineId));
    if (!phaseId) {
      throw new Error('Geen deal-fase gevonden voor de gekozen pipeline');
    }

    const { contactId, dealId } = await syncLeadRecordToTeamleader({
      supabase,
      accessToken,
      pipelineId,
      phaseId,
      settings: integration.settings,
      lead,
      assignmentId,
      leadId,
    });

    await supabase
      .from('integration_sync_log')
      .update({
        status: 'success',
        teamleader_contact_id: contactId,
        teamleader_deal_id: dealId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('assignment_id', assignmentId)
      .eq('provider', TEAMLEADER_PROVIDER);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync mislukt';
    await supabase
      .from('integration_sync_log')
      .update({
        status: 'failed',
        error_message: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('assignment_id', assignmentId)
      .eq('provider', TEAMLEADER_PROVIDER);
    throw err;
  }
}
