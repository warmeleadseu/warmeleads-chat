import { createServerClient } from '@/lib/supabase';
import {
  appendRowToSheet,
  fetchSheetHeaderColumns,
  quoteSheetName,
} from './spreadsheet';
import {
  buildSheetRowValues,
  getPortalFieldsForBranch,
  mergeSheetMappings,
  suggestSheetColumnMapping,
} from './fieldMappingLogic';
import {
  ensureValidGoogleAccessToken,
  getGoogleSheetsIntegration,
} from './integrationRepo';
import { GOOGLE_SHEETS_PROVIDER } from './types';

export type SyncAssignmentArgs = {
  customerId: string;
  leadId: string;
  assignmentId: string;
};

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

export async function syncAssignmentToGoogleSheets(args: SyncAssignmentArgs): Promise<void> {
  const supabase = createServerClient();
  const { customerId, leadId, assignmentId } = args;

  const integration = await getGoogleSheetsIntegration(supabase, customerId);
  if (!integration?.connected_at) return;
  if (integration.settings.enabled === false) return;

  const spreadsheetId = integration.settings.spreadsheet_id;
  const sheetName = integration.settings.sheet_name;
  if (!spreadsheetId || !sheetName) return;

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
    .eq('provider', GOOGLE_SHEETS_PROVIDER)
    .maybeSingle();
  if (existingLog?.status === 'success') return;

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (!lead || lead.bron === 'demo') return;

  const logPayload = {
    customer_id: customerId,
    lead_id: leadId,
    assignment_id: assignmentId,
    provider: GOOGLE_SHEETS_PROVIDER,
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
    const accessToken = await ensureValidGoogleAccessToken(supabase, integration);
    const quotedSheet = quoteSheetName(sheetName);

    const branchSlug = lead.branch || '';
    const branchFields = await getBranchFields(supabase, branchSlug);
    const portalFields = getPortalFieldsForBranch(branchFields);

    const columns = await fetchSheetHeaderColumns(accessToken, spreadsheetId, quotedSheet);
    let columnMapping = mergeSheetMappings(integration.settings.field_mappings, branchSlug);

    if (Object.keys(columnMapping).length === 0 && columns.length > 0) {
      columnMapping = suggestSheetColumnMapping(portalFields, columns);
    }

    const columnCount = columns.length > 0 ? columns.length : 20;
    const rowValues = buildSheetRowValues(
      lead as Record<string, unknown>,
      columnMapping,
      columnCount,
    );

    if (rowValues.every((v) => !v.trim())) {
      throw new Error('Geen velden om naar de spreadsheet te schrijven (controleer veldkoppeling)');
    }

    const updatedRange = await appendRowToSheet(
      accessToken,
      spreadsheetId,
      quotedSheet,
      rowValues,
    );

    await supabase
      .from('integration_sync_log')
      .update({
        status: 'success',
        teamleader_contact_id: spreadsheetId,
        teamleader_deal_id: updatedRange.slice(0, 500),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('assignment_id', assignmentId)
      .eq('provider', GOOGLE_SHEETS_PROVIDER);
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
      .eq('provider', GOOGLE_SHEETS_PROVIDER);
    throw err;
  }
}
