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

  const [totalRes, weekRes, monthRes, allLeadsRes, recentRes] =
    await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
      supabase.from('leads').select('status, branch, customer_id, customers(name)'),
      supabase.from('leads').select('*, customers(id, name)').order('created_at', { ascending: false }).limit(10),
    ]);

  const byStatus: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};

  if (allLeadsRes.data) {
    for (const lead of allLeadsRes.data) {
      if (lead.status) byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      if (lead.branch) byBranch[lead.branch] = (byBranch[lead.branch] || 0) + 1;
      const custName = (lead as Record<string, unknown>).customers
        ? ((lead as Record<string, unknown>).customers as { name: string })?.name || 'Onbekend'
        : 'Onbekend';
      byCustomer[custName] = (byCustomer[custName] || 0) + 1;
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
