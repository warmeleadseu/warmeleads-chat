import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';

/** Integration health summary for portal dashboard. */
export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.INTEGRATIONS_VIEW)) return forbidden();

  const supabase = createServerClient();
  const customerId = session.customer.id;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentFailures } = await supabase
    .from('integration_sync_log')
    .select('integration, status, error_message, created_at')
    .eq('customer_id', customerId)
    .eq('status', 'failed')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);

  const { count: pendingCount } = await supabase
    .from('integration_sync_log')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'pending');

  const byIntegration: Record<string, { failed: number; last_error: string | null }> = {};
  for (const row of recentFailures || []) {
    const key = row.integration || 'unknown';
    if (!byIntegration[key]) byIntegration[key] = { failed: 0, last_error: null };
    byIntegration[key].failed++;
    if (!byIntegration[key].last_error && row.error_message) {
      byIntegration[key].last_error = row.error_message;
    }
  }

  return NextResponse.json({
    healthy: (recentFailures?.length || 0) === 0,
    pending_count: pendingCount || 0,
    failures_last_7d: recentFailures?.length || 0,
    by_integration: byIntegration,
  });
}
