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

async function fetchAllLight<T>(
  supabase: ReturnType<typeof createServerClient>,
  table: string,
  columns: string,
): Promise<T[]> {
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

const STATUSES = ['nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'verkocht', 'afgewezen'];

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const periods = ['day', 'week', 'month', 'quarter', 'year'];
  const periodBounds = periods.map(p => ({
    period: p,
    start: getPeriodStart(p).toISOString(),
    prevStart: getPrevPeriodStart(p).toISOString(),
  }));

  /* ── Wave 1: everything in parallel ─────────────────────── */
  const [
    basicCounts,
    recentRes,
    branchRes,
    custRes,
    statusCountResults,
    periodResults,
    allAssignments,
  ] = await Promise.all([
    Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', monthAgo),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }),
    ]),
    supabase.from('leads').select('*, customers(id, name)').neq('bron', 'excel_import').order('created_at', { ascending: false }).limit(10),
    supabase.from('branches').select('slug, name, color').order('sort_order', { ascending: true }),
    supabase.from('customers').select('id, name'),
    Promise.all(
      STATUSES.map(s =>
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', s),
      ),
    ),
    Promise.all(
      periodBounds.flatMap(({ start, prevStart }) => [
        supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', start),
        supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', prevStart).lt('created_at', start),
        supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', start),
        supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', prevStart).lt('assigned_at', start),
      ]),
    ),
    fetchAllLight<{ lead_id: string; customer_id: string }>(supabase, 'lead_assignments', 'lead_id, customer_id'),
  ]);

  const [totalRes, weekRes, monthRes, customersRes, assignCountRes] = basicCounts;

  /* ── Wave 2: branch lead counts (needs branch slugs from wave 1) ── */
  const branches = (branchRes.data || []) as { slug: string; name: string; color: string }[];
  const branchCountResults = await Promise.all(
    branches.map(b =>
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('branch', b.slug),
    ),
  );

  /* ── Aggregate results ──────────────────────────────────── */

  const byStatus: Record<string, number> = {};
  STATUSES.forEach((s, i) => {
    const c = statusCountResults[i].count || 0;
    if (c > 0) byStatus[s] = c;
  });

  const byBranch: Record<string, number> = {};
  branches.forEach((b, i) => {
    const c = branchCountResults[i].count || 0;
    if (c > 0) byBranch[b.slug] = c;
  });

  const custNameMap = new Map<string, string>();
  ((custRes.data || []) as { id: string; name: string }[]).forEach(c => custNameMap.set(c.id, c.name));

  const byCustomer: Record<string, number> = {};
  const assignedLeadIds = new Set<string>();
  for (const a of allAssignments) {
    const name = custNameMap.get(a.customer_id) || 'Onbekend';
    byCustomer[name] = (byCustomer[name] || 0) + 1;
    assignedLeadIds.add(a.lead_id);
  }
  const unassigned = (totalRes.count || 0) - assignedLeadIds.size;
  if (unassigned > 0) byCustomer['Niet toegewezen'] = unassigned;

  const periodStats: Record<string, { leads: number; prevLeads: number; assigned: number; prevAssigned: number }> = {};
  periodBounds.forEach(({ period }, i) => {
    const base = i * 4;
    periodStats[period] = {
      leads: periodResults[base].count || 0,
      prevLeads: periodResults[base + 1].count || 0,
      assigned: periodResults[base + 2].count || 0,
      prevAssigned: periodResults[base + 3].count || 0,
    };
  });

  const branchMeta: Record<string, { slug: string; name: string; color: string }> = {};
  branches.forEach(b => { branchMeta[b.slug] = b; });

  return NextResponse.json({
    total: totalRes.count || 0,
    thisWeek: weekRes.count || 0,
    thisMonth: monthRes.count || 0,
    customerCount: customersRes.count || 0,
    assignmentCount: assignCountRes.count || 0,
    byStatus,
    byBranch,
    byCustomer,
    recentLeads: recentRes.data || [],
    periodStats,
    branchMeta,
  });
}
