import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, weekRes, monthRes, byStatusRes, byBranchRes, byCustomerRes, recentRes] =
    await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
      supabase.rpc('count_leads_by_status').catch(() => ({ data: null })),
      supabase.rpc('count_leads_by_branch').catch(() => ({ data: null })),
      supabase.from('leads').select('customer_id, customers(name)'),
      supabase.from('leads').select('*, customers(id, name)').order('created_at', { ascending: false }).limit(10),
    ]);

  // Manual aggregation for status and branch (RPC may not exist)
  let byStatus: Record<string, number> = {};
  let byBranch: Record<string, number> = {};
  let byCustomer: Record<string, number> = {};

  if (!byStatusRes.data) {
    const { data: allLeads } = await supabase.from('leads').select('status, branch, customer_id, customers(name)');
    if (allLeads) {
      for (const lead of allLeads) {
        byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
        byBranch[lead.branch] = (byBranch[lead.branch] || 0) + 1;
        const custName = (lead as any).customers?.name || 'Onbekend';
        byCustomer[custName] = (byCustomer[custName] || 0) + 1;
      }
    }
  }

  return NextResponse.json({
    total: totalRes.count || 0,
    thisWeek: weekRes.count || 0,
    thisMonth: monthRes.count || 0,
    byStatus,
    byBranch,
    byCustomer,
    recentLeads: recentRes.data || [],
  });
}
