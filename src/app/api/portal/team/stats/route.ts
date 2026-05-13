import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

/** Cap op assignments-scan (voor status_breakdown). Gelijk aan portal/stats. */
const PORTAL_TEAM_STATS_MAX_ROWS = 25_000;
const PAGE_SIZE = 1000;

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
    return NextResponse.json({ stats: [], partial: false });
  }

  const userIds = members.map(m => m.id);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  // Per-member exact counts (klein vast aantal teamleden → kleine vaste hoeveelheid head-queries).
  const [totalCountResults, weekCountResults] = await Promise.all([
    Promise.all(
      userIds.map(async uid => {
        const { count } = await supabase
          .from('lead_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer.id)
          .eq('portal_user_id', uid);
        return { uid, count: count ?? 0 };
      }),
    ),
    Promise.all(
      userIds.map(async uid => {
        const { count } = await supabase
          .from('lead_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer.id)
          .eq('portal_user_id', uid)
          .gte('assigned_at', weekAgoIso);
        return { uid, count: count ?? 0 };
      }),
    ),
  ]);

  const totalByMember: Record<string, number> = {};
  totalCountResults.forEach(r => (totalByMember[r.uid] = r.count));
  const weekByMember: Record<string, number> = {};
  weekCountResults.forEach(r => (weekByMember[r.uid] = r.count));

  // status_breakdown vraagt status per assignment. Gecappete scan met partial-flag.
  type AssignStatus = { portal_user_id: string; status: string | null };
  const scanned: AssignStatus[] = [];
  let partial = false;
  for (let offset = 0; offset < PORTAL_TEAM_STATS_MAX_ROWS; offset += PAGE_SIZE) {
    const take = Math.min(PAGE_SIZE, PORTAL_TEAM_STATS_MAX_ROWS - offset);
    const { data } = await supabase
      .from('lead_assignments')
      .select('portal_user_id, status')
      .eq('customer_id', customer.id)
      .in('portal_user_id', userIds)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + take - 1);
    if (!data?.length) break;
    scanned.push(...(data as AssignStatus[]));
    if (data.length < take) break;
    if (offset + take >= PORTAL_TEAM_STATS_MAX_ROWS) partial = true;
  }

  const statusByMember: Record<string, Record<string, number>> = {};
  for (const a of scanned) {
    if (!a.portal_user_id) continue;
    if (!statusByMember[a.portal_user_id]) statusByMember[a.portal_user_id] = {};
    const s = a.status || 'nieuw';
    statusByMember[a.portal_user_id][s] = (statusByMember[a.portal_user_id][s] || 0) + 1;
  }

  const stats = members.map(member => {
    const total = totalByMember[member.id] || 0;
    const statusCounts = statusByMember[member.id] || {};
    const sold = statusCounts['verkocht'] || 0;
    const conversionRate = total > 0 ? Math.round((sold / total) * 10000) / 100 : 0;
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      is_active: member.is_active,
      total_leads: total,
      leads_this_week: weekByMember[member.id] || 0,
      conversion_rate: conversionRate,
      status_breakdown: statusCounts,
    };
  });

  if (partial) {
    console.info('[portal/team/stats]', {
      customerId: customer.id,
      members: members.length,
      scanned: scanned.length,
      partial,
    });
  }

  return NextResponse.json({ stats, partial, maxAssignmentsScanned: PORTAL_TEAM_STATS_MAX_ROWS });
}
