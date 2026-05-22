import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { getTeamleaderIntegration } from '@/lib/teamleader/integrationRepo';
import {
  getCallbackRedirectUri,
  getCustomerOAuthConfig,
  getGlobalOAuthConfig,
} from '@/lib/teamleader/credentials';
import { TEAMLEADER_PROVIDER } from '@/lib/teamleader/types';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const customerId = session.customer.id;

  const [integration, customerCfg, globalCfg] = await Promise.all([
    getTeamleaderIntegration(supabase, customerId),
    getCustomerOAuthConfig(supabase, customerId),
    getGlobalOAuthConfig(),
  ]);

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

  const oauthSource: 'customer' | 'global' | null = customerCfg
    ? 'customer'
    : globalCfg
      ? 'global'
      : null;

  return NextResponse.json({
    configured: !!(customerCfg || globalCfg),
    oauth_source: oauthSource,
    has_customer_oauth_app: !!customerCfg,
    has_global_oauth_app: !!globalCfg,
    redirect_uri: getCallbackRedirectUri(),
    connected: !!integration?.connected_at,
    settings: integration?.settings ?? null,
    connected_at: integration?.connected_at ?? null,
    success_count: successCount ?? 0,
    last_error: lastFailed?.error_message ?? null,
    last_error_at: lastFailed?.created_at ?? null,
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
