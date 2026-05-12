import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

/** Na deploy: Supabase → Query Performance / Reports + Database advisors (o.a. indexes op leads.created_at, lead_assignments.assigned_at). */

const STATS_LOOKBACK_DAYS = 730;
const STATS_LEADS_MAX_PAGES = 60;
const STATS_ASSIGNMENTS_MAX_PAGES = 80;
const PAGE = 1000;

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

function getPrevPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1) - 7);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);
    case 'year':
      return new Date(now.getFullYear() - 1, 0, 1);
    default:
      return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  }
}

function statsSinceIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - STATS_LOOKBACK_DAYS);
  return d.toISOString();
}

async function fetchLeadsForStats(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ rows: { id: string; status: string; branch: string }[]; truncated: boolean }> {
  const since = statsSinceIso();
  const rows: { id: string; status: string; branch: string }[] = [];
  let truncated = false;
  let from = 0;
  for (let p = 0; p < STATS_LEADS_MAX_PAGES; p++) {
    const { data } = await supabase
      .from('leads')
      .select('id, status, branch')
      .gte('created_at', since)
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    rows.push(...(data as { id: string; status: string; branch: string }[]));
    if (data.length < PAGE) break;
    from += PAGE;
    if (p === STATS_LEADS_MAX_PAGES - 1) truncated = true;
  }
  return { rows, truncated };
}

async function fetchAssignmentsForStats(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ rows: { lead_id: string; customers: { name: string } | null }[]; truncated: boolean }> {
  const since = statsSinceIso();
  const rows: { lead_id: string; customers: { name: string } | null }[] = [];
  let truncated = false;
  let from = 0;
  for (let p = 0; p < STATS_ASSIGNMENTS_MAX_PAGES; p++) {
    const { data } = await supabase
      .from('lead_assignments')
      .select('lead_id, customers(name)')
      .gte('assigned_at', since)
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    for (const row of data as unknown as { lead_id: string; customers: { name: string } | { name: string }[] | null }[]) {
      const c = row.customers;
      const name = Array.isArray(c) ? c[0]?.name : c?.name;
      rows.push({ lead_id: row.lead_id, customers: name ? { name } : null });
    }
    if (data.length < PAGE) break;
    from += PAGE;
    if (p === STATS_ASSIGNMENTS_MAX_PAGES - 1) truncated = true;
  }
  return { rows, truncated };
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const t0 = Date.now();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, weekRes, monthRes, recentRes, customersRes, leadChunk, assignChunk] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', weekAgo),
    supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', monthAgo),
    supabase
      .from('leads')
      .select('*, customers(id, name)')
      .neq('bron', 'excel_import')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    fetchLeadsForStats(supabase),
    fetchAssignmentsForStats(supabase),
  ]);

  const allLeads = leadChunk.rows;
  const allAssignments = assignChunk.rows;

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
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', start),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .neq('bron', 'excel_import')
        .gte('created_at', prevStart)
        .lt('created_at', start),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', start),
      supabase
        .from('lead_assignments')
        .select('id', { count: 'exact', head: true })
        .gte('assigned_at', prevStart)
        .lt('assigned_at', start),
    ]);

    periodStats[p] = {
      leads: leadsNow.count || 0,
      prevLeads: leadsPrev.count || 0,
      assigned: assignNow.count || 0,
      prevAssigned: assignPrev.count || 0,
    };
  }

  console.info('[admin/stats]', {
    computeMs: Date.now() - t0,
    leadsRows: allLeads.length,
    assignRows: allAssignments.length,
    leadsTruncated: leadChunk.truncated,
    assignTruncated: assignChunk.truncated,
  });

  return NextResponse.json({
    total: totalRes.count || 0,
    thisWeek: weekRes.count || 0,
    thisMonth: monthRes.count || 0,
    customerCount: customersRes.count || 0,
    byStatus,
    byBranch,
    byCustomer,
    recentLeads: recentRes.data || [],
    periodStats,
    _statsScope: {
      lookbackDays: STATS_LOOKBACK_DAYS,
      leadsSampled: allLeads.length,
      assignmentsSampled: allAssignments.length,
      leadsTruncated: leadChunk.truncated,
      assignmentsTruncated: assignChunk.truncated,
      maxLeadPages: STATS_LEADS_MAX_PAGES,
      maxAssignmentPages: STATS_ASSIGNMENTS_MAX_PAGES,
      note:
        'byStatus/byBranch/byCustomer zijn gebaseerd op leads en assignments binnen het lookback-venster (niet all-time).',
    },
  });
}
