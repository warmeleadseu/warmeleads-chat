import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { data: directLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('customer_id', customer.id);

  const { data: assignedLeads } = await supabase
    .from('lead_assignments')
    .select('lead_id')
    .eq('customer_id', customer.id);

  const leadIds = new Set<string>();
  (directLeads || []).forEach(l => leadIds.add(l.id));
  (assignedLeads || []).forEach(a => leadIds.add(a.lead_id));

  const allIds = Array.from(leadIds);

  if (allIds.length === 0) {
    return NextResponse.json({
      totalLeads: 0, newThisWeek: 0, contacted: 0, sold: 0,
      bulkLeads: 0, statusBreakdown: {}, branchBreakdown: {},
    });
  }

  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, status, branch, created_at')
    .in('id', allIds);

  const leads = allLeads || [];

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const totalLeads = leads.length;
  const newThisWeek = leads.filter(l => new Date(l.created_at) >= weekAgo).length;
  const contacted = leads.filter(l => l.status === 'gecontacteerd').length;
  const sold = leads.filter(l => l.status === 'verkocht').length;

  const statusCounts: Record<string, number> = {};
  leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });

  const branchCounts: Record<string, number> = {};
  leads.forEach(l => { branchCounts[l.branch] = (branchCounts[l.branch] || 0) + 1; });

  const { count: bulkLeads } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer.id)
    .eq('source', 'bulk_export');

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
