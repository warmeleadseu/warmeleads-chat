import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.TEAM_MANAGE)) return forbidden();

  const { customer } = session;
  const supabase = createServerClient();

  const { data: members } = await supabase
    .from('portal_users')
    .select('id, name, role, is_active')
    .eq('customer_id', customer.id)
    .order('name');

  if (!members || members.length === 0) {
    return NextResponse.json({ stats: [] });
  }

  const userIds = members.map(m => m.id);

  // Get all assignments for these users
  const { data: assignments } = await supabase
    .from('lead_assignments')
    .select('portal_user_id, status, assigned_at')
    .eq('customer_id', customer.id)
    .in('portal_user_id', userIds);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const stats = members.map(member => {
    const memberAssignments = (assignments || []).filter(a => a.portal_user_id === member.id);
    const total = memberAssignments.length;
    const thisWeek = memberAssignments.filter(a => new Date(a.assigned_at) >= weekAgo).length;

    const statusCounts: Record<string, number> = {};
    memberAssignments.forEach(a => {
      const s = a.status || 'nieuw';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const sold = statusCounts['verkocht'] || 0;
    const conversionRate = total > 0 ? Math.round((sold / total) * 10000) / 100 : 0;

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      is_active: member.is_active,
      total_leads: total,
      leads_this_week: thisWeek,
      conversion_rate: conversionRate,
      status_breakdown: statusCounts,
    };
  });

  return NextResponse.json({ stats });
}
