import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  getGoogleOAuthConfig,
  getGoogleServiceAccountEmail,
  isGoogleSheetsApiKeyConfigured,
  isGoogleSheetsIntegrationServerReady,
} from '@/lib/googleSheets/config';
import { ensureLatestSheetInSettings } from '@/lib/googleSheets/activeSheet';
import { resolveGoogleSheetsAccessToken } from '@/lib/googleSheets/access';
import { isGoogleServiceAccountConfigured } from '@/lib/googleSheets/serviceAccount';
import { getGoogleSheetsIntegrationPublic } from '@/lib/googleSheets/integrationRepo';
import { hasSavedSheetMappings } from '@/lib/googleSheets/fieldMappingLogic';
import { isGoogleSheetsSyncReady } from '@/lib/integrations/syncRouting';
import { GOOGLE_SHEETS_PROVIDER } from '@/lib/googleSheets/types';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const customerId = session.customer.id;

  let integration = await getGoogleSheetsIntegrationPublic(supabase, customerId);

  if (integration?.connected_at && integration.settings.spreadsheet_id) {
    try {
      const accessToken = await resolveGoogleSheetsAccessToken(supabase, customerId);
      await ensureLatestSheetInSettings(supabase, customerId, integration, accessToken);
      integration = (await getGoogleSheetsIntegrationPublic(supabase, customerId)) ?? integration;
    } catch {
      /* status tonen ook als refresh van tabblad faalt */
    }
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('branches')
    .eq('id', customerId)
    .single();

  const branches = (customer?.branches as string[] | null) ?? [];
  const oauthConfigured = !!getGoogleOAuthConfig();
  const apiKeyConfigured = isGoogleSheetsApiKeyConfigured();
  const serverReady = isGoogleSheetsIntegrationServerReady();

  const { count: successCount } = await supabase
    .from('integration_sync_log')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER)
    .eq('status', 'success');

  const { data: lastFailed } = await supabase
    .from('integration_sync_log')
    .select('error_message, created_at')
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER)
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recentLogs } = await supabase
    .from('integration_sync_log')
    .select('id, lead_id, assignment_id, status, error_message, teamleader_deal_id, created_at')
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER)
    .order('created_at', { ascending: false })
    .limit(20);

  const leadIds = [...new Set((recentLogs || []).map((r) => r.lead_id).filter(Boolean))];
  const leadMap = new Map<string, string>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from('leads').select('id, naam_klant').in('id', leadIds);
    for (const l of leads || []) leadMap.set(l.id, l.naam_klant);
  }

  const settings = integration?.settings ?? null;
  const spreadsheetConfigured = Boolean(
    settings?.spreadsheet_id && settings?.sheet_name,
  );
  const fieldMappingConfigured = hasSavedSheetMappings(settings?.field_mappings, branches);
  const syncReady = isGoogleSheetsSyncReady(integration, branches);

  return NextResponse.json({
    oauth_configured: oauthConfigured,
    api_key_configured: apiKeyConfigured,
    service_account_configured: isGoogleServiceAccountConfigured(),
    service_account_email: getGoogleServiceAccountEmail(),
    server_ready: serverReady,
    connection_mode: integration?.connection_mode ?? null,
    connected: !!integration?.connected_at,
    spreadsheet_configured: spreadsheetConfigured,
    field_mapping_configured: fieldMappingConfigured,
    sync_ready: syncReady,
    settings,
    connected_at: integration?.connected_at ?? null,
    success_count: successCount ?? 0,
    last_error: lastFailed?.error_message ?? null,
    last_error_at: lastFailed?.created_at ?? null,
    recent_syncs: (recentLogs || []).map((row) => ({
      id: row.id,
      status: row.status,
      sheet_range: row.teamleader_deal_id,
      error_message: row.error_message,
      created_at: row.created_at,
      lead_name: leadMap.get(row.lead_id) ?? null,
    })),
  });
}
