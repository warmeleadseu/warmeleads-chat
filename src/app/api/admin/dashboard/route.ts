import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getPeriodStart, getPrevPeriodStart } from '@/lib/adminDashboardPeriod';

async function fetchAllLight<T>(
  supabase: ReturnType<typeof createServerClient>,
  table: string,
  columns: string,
  filter?: { column: string; values: string[] },
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + PAGE - 1);
    if (filter) q = q.in(filter.column, filter.values);
    const { data } = await q;
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

const STATUSES = ['nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'verkocht', 'afgewezen'];

interface CacheEntry { data: any; expires: number }
const dashboardCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000;

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const cacheKey = `${admin.role}:${admin.id}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  const supabase = createServerClient();
  const t0 = Date.now();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const isAM = admin.role === 'accountmanager';
  let amCustomerIds: string[] = [];
  if (isAM) {
    const { data: myCusts } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    amCustomerIds = (myCusts || []).map(c => c.id);
    if (amCustomerIds.length === 0) {
      const { data: brData } = await supabase
        .from('branches')
        .select('slug, name, color')
        .eq('hidden_from_admin', false)
        .order('sort_order', { ascending: true });
      const bm: Record<string, { slug: string; name: string; color: string }> = {};
      (brData || []).forEach((b: any) => { bm[b.slug] = b; });
      console.info('[admin/dashboard]', { computeMs: Date.now() - t0, isAM, earlyEmpty: true });
      return NextResponse.json({
        total: 0, thisWeek: 0, thisMonth: 0, customerCount: 0, assignmentCount: 0,
        byStatus: {}, byBranch: {}, byCustomer: {}, recentLeads: [],
        periodStats: Object.fromEntries(['day','week','month','quarter','year'].map(p => [p, { leads: 0, prevLeads: 0, assigned: 0, prevAssigned: 0 }])),
        branchMeta: bm,
      });
    }
  }

  const scopeLeads = (q: any) => (isAM ? q.in('customer_id', amCustomerIds) : q);
  const scopeAssign = (q: any) => (isAM ? q.in('customer_id', amCustomerIds) : q);

  /** Zelfde scope als kosten/CPL: geen bulk-export, geen demo-portaaltoewijzingen. */
  const scopeAssignDistributie = (q: any) =>
    scopeAssign(q).or('source.is.null,source.not.in.(bulk_export,demo)');

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
    allAssignmentRows,
  ] = await Promise.all([
    Promise.all([
      scopeLeads(supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'demo')),
      scopeLeads(supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').neq('bron', 'demo').gte('created_at', weekAgo)),
      scopeLeads(supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').neq('bron', 'demo').gte('created_at', monthAgo)),
      isAM
        ? Promise.resolve({ count: amCustomerIds.length })
        : supabase.from('customers').select('id', { count: 'exact', head: true }),
      scopeAssignDistributie(supabase.from('lead_assignments').select('id', { count: 'exact', head: true })),
    ]),
    scopeLeads(supabase.from('leads').select('*, customers(id, name)').neq('bron', 'excel_import').neq('bron', 'demo').order('created_at', { ascending: false }).limit(10)),
    supabase
      .from('branches')
      .select('slug, name, color')
      .eq('hidden_from_admin', false)
      .order('sort_order', { ascending: true }),
    isAM
      ? supabase.from('customers').select('id, name').in('id', amCustomerIds)
      : supabase.from('customers').select('id, name'),
    Promise.all(
      STATUSES.map(s =>
        scopeLeads(supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'demo').eq('status', s)),
      ),
    ),
    Promise.all(
      periodBounds.flatMap(({ start, prevStart }) => [
        scopeLeads(supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').neq('bron', 'demo').gte('created_at', start)),
        scopeLeads(supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').neq('bron', 'demo').gte('created_at', prevStart).lt('created_at', start)),
        scopeAssignDistributie(supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', start)),
        scopeAssignDistributie(supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', prevStart).lt('assigned_at', start)),
      ]),
    ),
    fetchAllLight<{ lead_id: string; customer_id: string; source: string | null }>(
      supabase, 'lead_assignments', 'lead_id, customer_id, source',
      isAM ? { column: 'customer_id', values: amCustomerIds } : undefined,
    ),
  ]);

  const [totalRes, weekRes, monthRes, customersRes, assignCountRes] = basicCounts;

  const allAssignments = allAssignmentRows.filter(a => {
    const s = a.source || 'distribution';
    return s !== 'bulk_export' && s !== 'demo';
  });

  /* ── Wave 2: branch lead counts (needs branch slugs from wave 1) ── */
  const branches = (branchRes.data || []) as { slug: string; name: string; color: string }[];
  const branchCountResults = await Promise.all(
    branches.map(b =>
      scopeLeads(supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'demo').eq('branch', b.slug)),
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

  const payload = {
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
  };

  dashboardCache.set(cacheKey, { data: payload, expires: Date.now() + CACHE_TTL });

  // Evict stale entries periodically
  if (dashboardCache.size > 50) {
    const nowMs = Date.now();
    for (const [k, v] of dashboardCache) {
      if (nowMs > v.expires) dashboardCache.delete(k);
    }
  }

  console.info('[admin/dashboard]', {
    computeMs: Date.now() - t0,
    isAM,
    assignmentJoinRows: allAssignments.length,
  });

  return NextResponse.json(payload);
}
