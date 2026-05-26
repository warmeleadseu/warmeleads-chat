import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { getTeamleaderConnectionState } from '@/lib/teamleader/integrationRepo';
import {
  getCustomerOAuthConfig,
  getEffectiveOAuthConfig,
  getGlobalOAuthConfig,
} from '@/lib/teamleader/credentials';
import { isTeamleaderSyncReady } from '@/lib/integrations/syncRouting';
import { hasSavedFieldMappings } from '@/lib/teamleader/fieldMappingLogic';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const customerId = session.customer.id;

  const [connection, customerCfg, globalCfg, effectiveCfg] = await Promise.all([
    getTeamleaderConnectionState(supabase, customerId),
    getCustomerOAuthConfig(supabase, customerId),
    getGlobalOAuthConfig(),
    getEffectiveOAuthConfig(supabase, customerId),
  ]);
  const integration = connection.integration;

  const { count: successCount } = await supabase
    .from('integration_sync_log')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .eq('status', 'success');

  const { data: lastFailed } = await supabase
    .from('integration_sync_log')
    .select('error_message, created_at')
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: recentLogs } = await supabase
    .from('integration_sync_log')
    .select(
      'id, lead_id, assignment_id, status, teamleader_contact_id, teamleader_deal_id, error_message, created_at',
    )
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .order('created_at', { ascending: false })
    .limit(20);

  const leadIds = [...new Set((recentLogs || []).map((r) => r.lead_id).filter(Boolean))];
  const leadMap = new Map<string, { naam_klant: string }>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, naam_klant')
      .in('id', leadIds);
    for (const l of leads || []) {
      leadMap.set(l.id, { naam_klant: l.naam_klant });
    }
  }

  const customerBranches = session.customer.branches ?? [];
  const fieldMappingConfigured = hasSavedFieldMappings(
    integration?.settings?.field_mappings ?? connection.row?.settings?.field_mappings,
    customerBranches,
  );

  const oauthSource: 'customer' | 'global' | null = customerCfg
    ? 'customer'
    : globalCfg
      ? 'global'
      : null;

  const syncReady =
    connection.tokensReadable && isTeamleaderSyncReady(integration);

  const lastError =
    lastFailed?.error_message &&
    connection.connected &&
    (!connection.tokensReadable ||
      !connection.row?.connected_at ||
      new Date(lastFailed.created_at).getTime() >=
        new Date(connection.row.connected_at).getTime())
      ? lastFailed.error_message
      : null;
  const lastErrorAt =
    lastError && lastFailed?.created_at ? lastFailed.created_at : null;

  return NextResponse.json({
    configured: !!(customerCfg || globalCfg),
    oauth_source: oauthSource,
    has_customer_oauth_app: !!customerCfg || Boolean(connection.row?.client_id_enc),
    has_global_oauth_app: !!globalCfg,
    redirect_uri: effectiveCfg?.redirectUri ?? null,
    connected: connection.connected,
    tokens_readable: connection.tokensReadable,
    sync_ready: syncReady,
    field_mapping_configured: fieldMappingConfigured,
    settings: integration?.settings ?? connection.row?.settings ?? null,
    connected_at: connection.row?.connected_at ?? null,
    success_count: successCount ?? 0,
    last_error: lastError,
    last_error_at: lastErrorAt,
    recent_syncs: (recentLogs || []).map((row) => {
      const lead = leadMap.get(row.lead_id);
      return {
        id: row.id,
        status: row.status,
        teamleader_deal_id: row.teamleader_deal_id,
        error_message: row.error_message,
        created_at: row.created_at,
        lead_name: lead?.naam_klant ?? null,
      };
    }),
  });
}
