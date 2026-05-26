import type { createServerClient } from '@/lib/supabase';
import { listGroupedCustomFieldDefinitions } from './customFieldDefinitions';
import {
  buildMappedCustomFields,
  collectSummaryExtras,
  getPortalFieldsForBranch,
  mergeMappings,
  suggestDefaultFieldMapping,
  suggestFieldMapping,
} from './fieldMappingLogic';
import { buildContactRemarks, buildDealSummary, formatDealTitle } from './mapping';
import { findOrCreateContact } from './contacts';
import { createDeal } from './deals';
import type { TeamleaderIntegrationSettings } from './types';

export type TeamleaderLeadRecord = Record<string, unknown> & {
  id?: string;
  naam_klant?: string;
  email?: string | null;
  telefoonnummer?: string | null;
  postcode?: string | null;
  huisnummer?: string | null;
  plaatsnaam?: string | null;
  provincie?: string | null;
  notities?: string | null;
  branch?: string | null;
  bron?: string | null;
  custom_fields?: Record<string, unknown> | null;
  wervingsdatum?: string | null;
};

export type SyncLeadRecordResult = {
  contactId: string;
  dealId: string;
  branchSlug: string;
  branchName: string;
};

type Supabase = ReturnType<typeof createServerClient>;

async function getBranchName(supabase: Supabase, branchSlug: string | null | undefined): Promise<string> {
  if (!branchSlug) return 'Lead';
  const { data } = await supabase.from('branches').select('name').eq('slug', branchSlug).maybeSingle();
  return data?.name || branchSlug;
}

async function getBranchFields(
  supabase: Supabase,
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

export async function syncLeadRecordToTeamleader(args: {
  supabase: Supabase;
  accessToken: string;
  pipelineId: string;
  phaseId: string;
  settings: TeamleaderIntegrationSettings;
  lead: TeamleaderLeadRecord;
  assignmentId: string;
  leadId: string;
  dealTitlePrefix?: string;
  summaryPreamble?: string;
}): Promise<SyncLeadRecordResult> {
  const {
    supabase,
    accessToken,
    phaseId,
    settings,
    lead,
    assignmentId,
    leadId,
    dealTitlePrefix = '',
    summaryPreamble = '',
  } = args;

  const branchSlug = lead.branch || '';
  const branchFields = await getBranchFields(supabase, branchSlug);
  const portalFields = getPortalFieldsForBranch(branchFields);
  let branchMapping = mergeMappings(settings.field_mappings, branchSlug);

  const hasAnyMapping =
    Object.keys(branchMapping.contact).length > 0 || Object.keys(branchMapping.deal).length > 0;

  const { contact: tlContactDefs, deal: tlDealDefs } =
    await listGroupedCustomFieldDefinitions(accessToken);

  if (!hasAnyMapping) {
    branchMapping =
      tlContactDefs.length > 0 || tlDealDefs.length > 0
        ? suggestFieldMapping(portalFields, tlContactDefs, tlDealDefs)
        : suggestDefaultFieldMapping(portalFields);
  }

  const leadRecord = lead as Record<string, unknown>;
  const contactCustom = buildMappedCustomFields(leadRecord, branchMapping.contact, tlContactDefs, 'contact');
  const dealCustom = buildMappedCustomFields(leadRecord, branchMapping.deal, tlDealDefs, 'deal');
  const summaryExtras = collectSummaryExtras(leadRecord, portalFields, branchMapping);

  const branchName = await getBranchName(supabase, lead.branch);
  const remarks = buildContactRemarks(leadRecord, summaryExtras);

  const contactId = await findOrCreateContact(
    accessToken,
    {
      naam_klant: lead.naam_klant || 'Onbekend',
      email: lead.email,
      telefoonnummer: lead.telefoonnummer,
      postcode: lead.postcode,
      huisnummer: lead.huisnummer,
      plaatsnaam: lead.plaatsnaam,
      remarks,
    },
    contactCustom,
  );

  let title = formatDealTitle(settings.deal_title_template, {
    branch_name: branchName,
    naam_klant: lead.naam_klant || 'Onbekend',
    branch: lead.branch || '',
  });
  if (dealTitlePrefix) title = `${dealTitlePrefix}${title}`;

  let summary = buildDealSummary(
    leadRecord,
    assignmentId,
    leadId,
    Object.keys(summaryExtras).length > 0 ? summaryExtras : undefined,
  );
  if (summaryPreamble) summary = `${summaryPreamble}${summary}`;

  const dealId = await createDeal(accessToken, {
    contactId,
    title,
    summary,
    phaseId,
    customFields: dealCustom,
  });

  return { contactId, dealId, branchSlug, branchName };
}
