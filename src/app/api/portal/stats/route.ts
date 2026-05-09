import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { repairDemoAssignmentsIfNeeded } from '@/lib/demoPortalLeads';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';

const PAGE_SIZE = 1000;
const IN_CHUNK = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery<T>(query: any): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return all;
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.STATISTICS_VIEW)) return forbidden();

  const { customer } = session;
  const supabase = createServerClient();

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

  let assignQuery = supabase.from('lead_assignments').select('lead_id, status').eq('customer_id', customer.id).order('assigned_at', { ascending: false });
  if (demoMode) {
    assignQuery = assignQuery.eq('source', 'demo');
  } else {
    assignQuery = assignQuery.neq('source', 'demo');
  }
  let assignments = await paginateQuery<{ lead_id: string; status: string | null }>(assignQuery);

  if (demoMode && assignments.length === 0) {
    await repairDemoAssignmentsIfNeeded(supabase, customer.id, customerBranches);
    let retryQ = supabase
      .from('lead_assignments')
      .select('lead_id, status')
      .eq('customer_id', customer.id)
      .eq('source', 'demo')
      .order('assigned_at', { ascending: false });
    assignments = await paginateQuery<{ lead_id: string; status: string | null }>(retryQ);
  }

  const directLeads = demoMode
    ? []
    : await paginateQuery<{ id: string }>(
        supabase.from('leads').select('id').eq('customer_id', customer.id),
      );

  const assignmentStatusMap: Record<string, string> = {};
  const leadIds = new Set<string>();
  assignments.forEach(a => {
    leadIds.add(a.lead_id);
    if (!assignmentStatusMap[a.lead_id]) {
      assignmentStatusMap[a.lead_id] = a.status || 'nieuw';
    }
  });
  directLeads.forEach(l => leadIds.add(l.id));

  const allIds = Array.from(leadIds);

  if (allIds.length === 0) {
    return NextResponse.json({
      totalLeads: 0, newThisWeek: 0, contacted: 0, sold: 0,
      bulkLeads: 0, statusBreakdown: {}, branchBreakdown: {},
    });
  }

  const leads: { id: string; status: string; branch: string; created_at: string }[] = [];
  for (let i = 0; i < allIds.length; i += IN_CHUNK) {
    const chunk = allIds.slice(i, i + IN_CHUNK);
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

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const totalLeads = enriched.length;
  const newThisWeek = enriched.filter(l => new Date(l.created_at) >= weekAgo).length;
  const contacted = enriched.filter(l => l.status === 'gecontacteerd').length;
  const sold = enriched.filter(l => l.status === 'verkocht').length;

  const statusCounts: Record<string, number> = {};
  enriched.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

  const branchCounts: Record<string, number> = {};
  enriched.forEach(l => { branchCounts[l.branch] = (branchCounts[l.branch] || 0) + 1; });

  const bulkLeads = demoMode ? 0 : (await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('source', 'bulk_export')).count || 0;

  return NextResponse.json({
    totalLeads,
    newThisWeek,
    contacted,
    sold,
    bulkLeads: bulkLeads || 0,
    statusBreakdown: statusCounts,
    branchBreakdown: branchCounts,
  });
}
