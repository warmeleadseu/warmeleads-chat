import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { repairDemoAssignmentsIfNeeded } from '@/lib/demoPortalLeads';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';

const PAGE_SIZE = 1000;
const IN_CHUNK = 500;
const PORTAL_PAGINATE_MAX_ROWS = 25_000;
const PORTAL_STATS_MAX_LEAD_DETAIL = 25_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery<T>(query: any, maxRows = PORTAL_PAGINATE_MAX_ROWS): Promise<{ rows: T[]; truncated: boolean }> {
  const all: T[] = [];
  let offset = 0;
  let truncated = false;
  while (all.length < maxRows) {
    const room = maxRows - all.length;
    const take = Math.min(PAGE_SIZE, room);
    const { data } = await query.range(offset, offset + take - 1);
    if (!data?.length) break;
    all.push(...(data as T[]));
    if (data.length < take) break;
    offset += data.length;
    if (all.length >= maxRows) {
      truncated = true;
      break;
    }
  }
  return { rows: all, truncated };
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.STATISTICS_VIEW)) return forbidden();

  const { customer } = session;
  const supabase = createServerClient();
  const t0 = Date.now();

  const { data: custData } = await supabase
    .from('customers')
    .select('demo_mode, branches, signup_source')
    .eq('id', customer.id)
    .single();
  const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, customer.id);
  const demoMode = shouldUseDemoPortalExperience({
    signup_source: custData?.signup_source,
    demo_mode: custData?.demo_mode,
    hasPaidCustomerBatch,
  });
  const customerBranches: string[] = custData?.branches ?? [];

  // Optionele branche-scope (uit pill-tabs op /portal). 'all' / leeg / onbekende
  // slug = volledige set; bij geldige slug filteren we lokaal op `leads.branch`
  // voor totalLeads/bulkLeads/statusBreakdown e.d. `branchBreakdown` en
  // `branchLastLeadAt` blijven altijd globaal — die voeden de tabs zelf.
  const branchParam = request.nextUrl.searchParams.get('branch') || '';
  const branchScope = branchParam && branchParam !== 'all' && customerBranches.includes(branchParam)
    ? branchParam
    : null;

  let assignQuery = supabase.from('lead_assignments').select('lead_id, status, source').eq('customer_id', customer.id).order('assigned_at', { ascending: false });
  if (demoMode) {
    assignQuery = assignQuery.eq('source', 'demo');
  } else {
    assignQuery = assignQuery.neq('source', 'demo');
  }
  const assignRes = await paginateQuery<{ lead_id: string; status: string | null; source: string | null }>(assignQuery);
  let assignments = assignRes.rows;
  let partial = assignRes.truncated;

  if (demoMode && assignments.length === 0) {
    await repairDemoAssignmentsIfNeeded(supabase, customer.id, customerBranches);
    const retryQ = supabase
      .from('lead_assignments')
      .select('lead_id, status, source')
      .eq('customer_id', customer.id)
      .eq('source', 'demo')
      .order('assigned_at', { ascending: false });
    const retryRes = await paginateQuery<{ lead_id: string; status: string | null; source: string | null }>(retryQ);
    assignments = retryRes.rows;
    partial ||= retryRes.truncated;
  }

  const directRes = demoMode
    ? { rows: [] as { id: string }[], truncated: false }
    : await paginateQuery<{ id: string }>(supabase.from('leads').select('id').eq('customer_id', customer.id));
  const directLeads = directRes.rows;
  partial ||= directRes.truncated;

  const assignmentStatusMap: Record<string, string> = {};
  const bulkLeadIds = new Set<string>();
  const leadIds = new Set<string>();
  assignments.forEach(a => {
    leadIds.add(a.lead_id);
    if (!assignmentStatusMap[a.lead_id]) {
      assignmentStatusMap[a.lead_id] = a.status || 'nieuw';
    }
    if (a.source === 'bulk_export') bulkLeadIds.add(a.lead_id);
  });
  directLeads.forEach(l => leadIds.add(l.id));

  const allIds = Array.from(leadIds);

  if (allIds.length === 0) {
    console.info('[portal/stats]', { computeMs: Date.now() - t0, partial: false, totalLeads: 0 });
    return NextResponse.json({
      totalLeads: 0, newThisWeek: 0, contacted: 0, sold: 0,
      bulkLeads: 0, statusBreakdown: {}, branchBreakdown: {}, branchLastLeadAt: {},
      partial: false,
      maxPaginateRows: PORTAL_PAGINATE_MAX_ROWS,
      maxLeadDetailRows: PORTAL_STATS_MAX_LEAD_DETAIL,
    });
  }

  const idList = allIds.length > PORTAL_STATS_MAX_LEAD_DETAIL ? allIds.slice(0, PORTAL_STATS_MAX_LEAD_DETAIL) : allIds;
  if (allIds.length > PORTAL_STATS_MAX_LEAD_DETAIL) partial = true;

  const leads: { id: string; status: string; branch: string; created_at: string }[] = [];
  for (let i = 0; i < idList.length; i += IN_CHUNK) {
    const chunk = idList.slice(i, i + IN_CHUNK);
    const { data } = await supabase
      .from('leads')
      .select('id, status, branch, created_at')
      .in('id', chunk);
    if (data) leads.push(...data);
  }

  const enriched = leads.map(l => ({
    ...l,
    status: assignmentStatusMap[l.id] ?? l.status,
  }));

  // Globale branche-stats (altijd over alle branches; voedt de pill-tabs).
  const branchCounts: Record<string, number> = {};
  const branchLastLeadAt: Record<string, string> = {};
  enriched.forEach(l => {
    branchCounts[l.branch] = (branchCounts[l.branch] || 0) + 1;
    if (!branchLastLeadAt[l.branch] || l.created_at > branchLastLeadAt[l.branch]) {
      branchLastLeadAt[l.branch] = l.created_at;
    }
  });

  // Scoped set voor de geselecteerde branche (of alles).
  const scoped = branchScope ? enriched.filter(l => l.branch === branchScope) : enriched;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const totalLeads = scoped.length;
  const newThisWeek = scoped.filter(l => new Date(l.created_at) >= weekAgo).length;
  const contacted = scoped.filter(l => l.status === 'gecontacteerd').length;
  const sold = scoped.filter(l => l.status === 'verkocht').length;

  const statusCounts: Record<string, number> = {};
  scoped.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

  const bulkLeads = demoMode ? 0 : scoped.filter(l => bulkLeadIds.has(l.id)).length;

  console.info('[portal/stats]', {
    computeMs: Date.now() - t0,
    partial,
    totalLeads,
    idSampleSize: idList.length,
    branchScope: branchScope ?? 'all',
  });

  return NextResponse.json({
    totalLeads,
    newThisWeek,
    contacted,
    sold,
    bulkLeads,
    statusBreakdown: statusCounts,
    branchBreakdown: branchCounts,
    branchLastLeadAt,
    partial,
    maxPaginateRows: PORTAL_PAGINATE_MAX_ROWS,
    maxLeadDetailRows: PORTAL_STATS_MAX_LEAD_DETAIL,
  });
}
