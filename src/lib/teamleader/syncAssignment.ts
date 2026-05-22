import { createServerClient } from '@/lib/supabase';
import { listCustomFieldDefinitions } from './customFieldDefinitions';
import {
  buildMappedCustomFields,
  collectSummaryExtras,
  getPortalFieldsForBranch,
  mergeMappings,
  suggestFieldMapping,
} from './fieldMappingLogic';
import { buildDealSummary, formatDealTitle } from './mapping';
import { findOrCreateContact } from './contacts';
import { createDeal } from './deals';
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

async function getBranchName(
  supabase: ReturnType<typeof createServerClient>,
  branchSlug: string | null | undefined,
): Promise<string> {
  if (!branchSlug) return 'Lead';
  const { data } = await supabase.from('branches').select('name').eq('slug', branchSlug).maybeSingle();
  return data?.name || branchSlug;
}

async function getBranchFields(
  supabase: ReturnType<typeof createServerClient>,
  branchSlug: string,
): Promise<Array<{ key: string; label: string }>> {
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('slug', branchSlug)
    .maybeSingle();
  if (!branch?.id) return [];
  const { data: fields } = await supabase
    .from('branch_fields')
    .select('key, label')
    .eq('branch_id', branch.id)
    .order('sort_order', { ascending: true });
  return (fields || []).map((f) => ({ key: f.key, label: f.label }));
}

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

    const branchSlug = lead.branch || '';
    const branchFields = await getBranchFields(supabase, branchSlug);
    const portalFields = getPortalFieldsForBranch(branchFields);
    let branchMapping = mergeMappings(integration.settings.field_mappings, branchSlug);

    const hasAnyMapping =
      Object.keys(branchMapping.contact).length > 0 ||
      Object.keys(branchMapping.deal).length > 0;

    const [tlContactDefs, tlDealDefs] = await Promise.all([
      listCustomFieldDefinitions(accessToken, 'contact'),
      listCustomFieldDefinitions(accessToken, 'deal'),
    ]);

    if (!hasAnyMapping && (tlContactDefs.length > 0 || tlDealDefs.length > 0)) {
      branchMapping = suggestFieldMapping(portalFields, tlContactDefs, tlDealDefs);
    }

    const contactCustom = buildMappedCustomFields(
      lead as Record<string, unknown>,
      branchMapping.contact,
      tlContactDefs,
      'contact',
    );
    const dealCustom = buildMappedCustomFields(
      lead as Record<string, unknown>,
      branchMapping.deal,
      tlDealDefs,
      'deal',
    );
    const summaryExtras = collectSummaryExtras(
      lead as Record<string, unknown>,
      portalFields,
      branchMapping,
    );

    const branchName = await getBranchName(supabase, lead.branch);
    const contactId = await findOrCreateContact(
      accessToken,
      {
        naam_klant: lead.naam_klant,
        email: lead.email,
        telefoonnummer: lead.telefoonnummer,
        postcode: lead.postcode,
        huisnummer: lead.huisnummer,
        plaatsnaam: lead.plaatsnaam,
      },
      contactCustom,
    );

    const title = formatDealTitle(integration.settings.deal_title_template, {
      branch_name: branchName,
      naam_klant: lead.naam_klant || 'Onbekend',
      branch: lead.branch || '',
    });
    const summary = buildDealSummary(
      lead as Record<string, unknown>,
      assignmentId,
      leadId,
      Object.keys(summaryExtras).length > 0 ? summaryExtras : undefined,
    );

    const dealId = await createDeal(accessToken, {
      contactId,
      title,
      summary,
      phaseId,
      customFields: dealCustom,
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
