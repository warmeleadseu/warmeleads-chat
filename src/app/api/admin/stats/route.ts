import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'year': return new Date(now.getFullYear(), 0, 1);
    default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

function getPrevPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1) - 7);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month': return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
    case 'year': return new Date(now.getFullYear() - 1, 0, 1);
    default: return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  }
}

async function fetchAll<T>(supabase: ReturnType<typeof createServerClient>, table: string, columns: string): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, weekRes, monthRes, allLeads, recentRes, allAssignments] =
    await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
      fetchAll<{ id: string; status: string; branch: string }>(supabase, 'leads', 'id, status, branch'),
      supabase.from('leads').select('*, customers(id, name)').order('created_at', { ascending: false }).limit(10),
      fetchAll<{ lead_id: string; customers: { name: string } | null }>(supabase, 'lead_assignments', 'lead_id, customers(name)'),
    ]);

  const byStatus: Record<string, number> = {};
  const byBranch: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};

  const assignedLeadIds = new Set<string>();

  for (const a of allAssignments) {
    const custName = a.customers?.name || 'Onbekend';
    byCustomer[custName] = (byCustomer[custName] || 0) + 1;
    assignedLeadIds.add(a.lead_id);
  }

  for (const lead of allLeads) {
    if (lead.status) byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    if (lead.branch) byBranch[lead.branch] = (byBranch[lead.branch] || 0) + 1;
  }
  const unassigned = allLeads.filter(l => !assignedLeadIds.has(l.id)).length;
  if (unassigned > 0) byCustomer['Niet toegewezen'] = unassigned;

  const periods = ['day', 'week', 'month', 'quarter', 'year'] as const;
  const periodStats: Record<string, { leads: number; prevLeads: number; assigned: number; prevAssigned: number }> = {};

  for (const p of periods) {
    const start = getPeriodStart(p).toISOString();
    const prevStart = getPrevPeriodStart(p).toISOString();

    const [leadsNow, leadsPrev, assignNow, assignPrev] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', start),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', start),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', start),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', prevStart).lt('assigned_at', start),
    ]);

    periodStats[p] = {
      leads: leadsNow.count || 0,
      prevLeads: leadsPrev.count || 0,
      assigned: assignNow.count || 0,
      prevAssigned: assignPrev.count || 0,
    };
  }

  return NextResponse.json({
    total: totalRes.count || 0,
    thisWeek: weekRes.count || 0,
    thisMonth: monthRes.count || 0,
    byStatus,
    byBranch,
    byCustomer,
    recentLeads: recentRes.data || [],
    periodStats,
  });
}
