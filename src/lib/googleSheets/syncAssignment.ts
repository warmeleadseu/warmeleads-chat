import { createServerClient } from '@/lib/supabase';
import {
  appendRowToSheet,
  quoteSheetName,
  scanSheetHeaders,
} from './spreadsheet';
import {
  buildSheetRowValues,
  getPortalFieldsForBranch,
  mergeSheetMappings,
  remapLegacyColumnIndices,
  sheetColumnCount,
  suggestSheetColumnMapping,
} from './fieldMappingLogic';
import { ensureLatestSheetInSettings } from './activeSheet';
import { resolveGoogleSheetsAccessToken } from './access';
import { assertGoogleSheetsServerReady } from './config';
import { getGoogleSheetsIntegrationPublic } from './integrationRepo';
import { GOOGLE_SHEETS_PROVIDER } from './types';

export type SyncAssignmentArgs = {
  customerId: string;
  leadId: string;
  assignmentId: string;
  options?: { forceResend?: boolean };
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

  const integration = await getGoogleSheetsIntegrationPublic(supabase, customerId);
  if (!integration?.connected_at) return;
  if (integration.settings.enabled === false) return;
  const spreadsheetId = integration.settings.spreadsheet_id;
  if (!spreadsheetId) return;

  await assertGoogleSheetsServerReady();

  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('id, customer_id, lead_id, status, notities')
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
  if (existingLog?.status === 'success' && !args.options?.forceResend) return;

  if (existingLog?.status === 'success' && args.options?.forceResend) {
    await supabase
      .from('integration_sync_log')
      .update({
        status: 'pending',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingLog.id);
  }

  const { data: leadRow } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (!leadRow || leadRow.bron === 'demo') return;

  const lead = {
    ...leadRow,
    status: assignment?.status ?? leadRow.status ?? 'nieuw',
    notities: assignment?.notities ?? leadRow.notities ?? '',
  };

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
    const accessToken = await resolveGoogleSheetsAccessToken(supabase, customerId);
    const { sheetName } = await ensureLatestSheetInSettings(
      supabase,
      customerId,
      integration,
      accessToken,
    );
    const quotedSheet = quoteSheetName(sheetName);
    const headerRowPref = integration.settings.header_row ?? null;

    const branchSlug = lead.branch || '';
    const branchFields = await getBranchFields(supabase, branchSlug);
    const portalFields = getPortalFieldsForBranch(branchFields);

    const { columns, headerRow } = await scanSheetHeaders(
      accessToken,
      spreadsheetId,
      quotedSheet,
      { headerRow: headerRowPref },
    );
    let columnMapping = remapLegacyColumnIndices(
      mergeSheetMappings(integration.settings.field_mappings, branchSlug),
      columns,
    );

    if (Object.keys(columnMapping).length === 0 && columns.length > 0) {
      columnMapping = suggestSheetColumnMapping(portalFields, columns);
    }

    const columnCount = sheetColumnCount(columns) || 20;
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
