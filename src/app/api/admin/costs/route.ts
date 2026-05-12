import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

/** Na zware wijzigingen: Supabase → Query Performance + advisors (indexes i.c.m. costs-vensters). */

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Geen toegang tot kostendata' }, { status: 403 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const t0 = Date.now();

  const COSTS_LOOKBACK_DAYS = 730;
  const COSTS_LEADS_MAX_PAGES = 60;
  const COSTS_ASSIGN_MAX_PAGES = 80;
  const PAGE = 1000;

  const costsSinceIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - COSTS_LOOKBACK_DAYS);
    return d.toISOString();
  })();

  interface LeadRow { id: string; branch: string; meta_campaign_id: string | null; wervingsdatum: string | null; lead_cost: number | null }
  interface AssignRow { id: string; lead_id: string; customer_id: string; batch_id: string | null }

  async function fetchLeadsBounded(): Promise<{ rows: LeadRow[]; truncated: boolean }> {
    const rows: LeadRow[] = [];
    let truncated = false;
    let offset = 0;
    for (let p = 0; p < COSTS_LEADS_MAX_PAGES; p++) {
      const { data } = await supabase
        .from('leads')
        .select('id, branch, meta_campaign_id, wervingsdatum, lead_cost')
        .neq('bron', 'excel_import')
        .gte('created_at', costsSinceIso)
        .range(offset, offset + PAGE - 1);
      if (!data?.length) break;
      rows.push(...(data as LeadRow[]));
      if (data.length < PAGE) break;
      offset += PAGE;
      if (p === COSTS_LEADS_MAX_PAGES - 1) truncated = true;
    }
    return { rows, truncated };
  }

  async function fetchAssignmentsBounded(): Promise<{ rows: AssignRow[]; truncated: boolean }> {
    const rows: AssignRow[] = [];
    let truncated = false;
    let offset = 0;
    for (let p = 0; p < COSTS_ASSIGN_MAX_PAGES; p++) {
      const { data } = await supabase
        .from('lead_assignments')
        .select('id, lead_id, customer_id, batch_id')
        .gte('assigned_at', costsSinceIso)
        .range(offset, offset + PAGE - 1);
      if (!data?.length) break;
      rows.push(...(data as AssignRow[]));
      if (data.length < PAGE) break;
      offset += PAGE;
      if (p === COSTS_ASSIGN_MAX_PAGES - 1) truncated = true;
    }
    return { rows, truncated };
  }

  /* ── Wave 1: fetch batches + lastSync (small) + paginated leads & assignments ── */
  const [batchesRes, lastSyncRes, leadBundle, assignBundle] = await Promise.all([
    supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, leads_delivered, price_per_lead, total_price, status, leads_per_week, created_at, is_paid, customers(name)')
      .in('status', ['active', 'completed'])
      .neq('is_paid', false)
      .order('created_at', { ascending: false })
      .limit(2500),
    supabase
      .from('meta_ad_spend')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single(),
    fetchLeadsBounded(),
    fetchAssignmentsBounded(),
  ]);

  const allLeads = leadBundle.rows;
  const allAssignments = assignBundle.rows;
  const leadsTruncated = leadBundle.truncated;
  const assignmentsTruncated = assignBundle.truncated;

  const allBatches = batchesRes.data || [];
  const lastSync = lastSyncRes.data;

  // ── Batch start dates per branch ──
  const branchStartDate = new Map<string, string>();
  for (const b of allBatches) {
    const batchDate = b.created_at ? b.created_at.split('T')[0] : today;
    const existing = branchStartDate.get(b.branch);
    if (!existing || batchDate < existing) branchStartDate.set(b.branch, batchDate);
  }
  const globalStartDate = branchStartDate.size > 0 ? [...branchStartDate.values()].sort()[0] : today;

  // ── Campaign mapping from leads ──
  const leadsWithCampaign = allLeads.filter((l): l is LeadRow & { meta_campaign_id: string } => !!l.meta_campaign_id);
  const campaignBranchMap = new Map<string, string>();
  for (const l of leadsWithCampaign) {
    if (!campaignBranchMap.has(l.meta_campaign_id)) {
      campaignBranchMap.set(l.meta_campaign_id, l.branch);
    }
  }
  const campaignIdSet = [...campaignBranchMap.keys()];
  const totalOurLeads = leadsWithCampaign.length;

  /* ── Wave 2: meta_ad_spend chunks in parallel ── */
  interface SpendRow { campaign_id: string; date: string; spend: string; leads_count: number }
  let allSpendRows: SpendRow[] = [];
  if (campaignIdSet.length > 0) {
    const chunkSize = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < campaignIdSet.length; i += chunkSize) {
      chunks.push(campaignIdSet.slice(i, i + chunkSize));
    }
    const chunkResults = await Promise.all(
      chunks.map(chunk =>
        supabase
          .from('meta_ad_spend')
          .select('campaign_id, date, spend, leads_count')
          .in('campaign_id', chunk)
          .gte('date', globalStartDate),
      ),
    );
    allSpendRows = chunkResults.flatMap(r => (r.data || []) as SpendRow[]);
  }

  /* ── Compute all aggregates (pure CPU, no more DB calls) ── */

  let totalAdSpend = 0;
  let weekSpend = 0;
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const row of allSpendRows) {
    const branch = campaignBranchMap.get(row.campaign_id);
    const startDate = branch ? branchStartDate.get(branch) : globalStartDate;
    if (startDate && row.date < startDate) continue;
    const spend = parseFloat(row.spend) || 0;
    totalAdSpend += spend;
    if (row.date >= weekAgo) weekSpend += spend;
  }

  const brutoCpl = totalOurLeads > 0
    ? Math.round((totalAdSpend / totalOurLeads) * 100) / 100
    : null;

  const assignmentsByLead = new Map<string, number>();
  let batchAssignmentCount = 0;
  for (const a of allAssignments) {
    if (a.batch_id) {
      assignmentsByLead.set(a.lead_id, (assignmentsByLead.get(a.lead_id) || 0) + 1);
      batchAssignmentCount++;
    }
  }

  const totalAssignments = batchAssignmentCount;
  const uniqueAssignedLeads = assignmentsByLead.size;
  const avgAssignments = uniqueAssignedLeads > 0
    ? Math.round((totalAssignments / uniqueAssignedLeads) * 100) / 100
    : 0;

  const effectieveCpl = brutoCpl && avgAssignments > 0
    ? Math.round((brutoCpl / avgAssignments) * 100) / 100
    : null;

  const costPerLead = totalOurLeads > 0 ? totalAdSpend / totalOurLeads : 0;

  // ── Branch-level costs ──
  const branchLeads = new Map<string, number>();
  const branchSpend = new Map<string, number>();
  const branchLeadIds = new Map<string, Set<string>>();

  for (const l of leadsWithCampaign) {
    branchLeads.set(l.branch, (branchLeads.get(l.branch) || 0) + 1);
    if (!branchLeadIds.has(l.branch)) branchLeadIds.set(l.branch, new Set());
    branchLeadIds.get(l.branch)!.add(l.id);
  }

  for (const row of allSpendRows) {
    const branch = campaignBranchMap.get(row.campaign_id);
    if (!branch) continue;
    const startDate = branchStartDate.get(branch);
    if (startDate && row.date < startDate) continue;
    branchSpend.set(branch, (branchSpend.get(branch) || 0) + (parseFloat(row.spend) || 0));
  }

  const branchCosts: Record<string, { spend: number; count: number; avgCpl: number; effectieveCpl: number; assignments: number }> = {};
  for (const [branch, count] of branchLeads) {
    const spend = branchSpend.get(branch) || 0;
    const avgCpl = count > 0 ? Math.round((spend / count) * 100) / 100 : 0;
    let branchAssignments = 0;
    const ids = branchLeadIds.get(branch);
    if (ids) for (const id of ids) branchAssignments += assignmentsByLead.get(id) || 0;
    const branchAvgAssign = ids && ids.size > 0 ? branchAssignments / ids.size : 1;
    branchCosts[branch] = {
      spend: Math.round(spend * 100) / 100,
      count,
      avgCpl,
      effectieveCpl: avgCpl > 0 && branchAvgAssign > 0 ? Math.round((avgCpl / branchAvgAssign) * 100) / 100 : avgCpl,
      assignments: branchAssignments,
    };
  }

  // ── Lead cost lookup ──
  const leadCostMap: Record<string, number> = {};
  for (const l of allLeads) {
    if (l.meta_campaign_id) leadCostMap[l.id] = costPerLead;
  }

  // ── Batch-level financials ──
  interface BatchFinancial {
    id: string; customer: string; branch: string; batchSize: number; delivered: number;
    pricePerLead: number; status: string; revenue: number; cost: number; profit: number;
    marginPct: number; leadsWithCost: number; startDate: string;
  }

  const batchFinancials: BatchFinancial[] = [];
  const batchAssignments = new Map<string, { lead_ids: string[] }>();
  for (const a of allAssignments) {
    if (!a.batch_id) continue;
    if (!batchAssignments.has(a.batch_id)) batchAssignments.set(a.batch_id, { lead_ids: [] });
    batchAssignments.get(a.batch_id)!.lead_ids.push(a.lead_id);
  }

  for (const b of allBatches) {
    if (!b.price_per_lead) continue;
    const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
    const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
    const revenue = Number(b.total_price) || (b.batch_size * b.price_per_lead);
    const startDate = b.created_at ? b.created_at.split('T')[0] : today;

    const ba = batchAssignments.get(b.id);
    let cost = 0;
    let leadsWithCost = 0;
    if (ba) {
      for (const lid of ba.lead_ids) {
        const lc = leadCostMap[lid];
        if (lc !== undefined) { cost += lc; leadsWithCost++; }
      }
    }

    const profit = revenue - cost;
    const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    batchFinancials.push({
      id: b.id, customer: custName, branch: b.branch, batchSize: b.batch_size,
      delivered: b.leads_delivered || 0, pricePerLead: b.price_per_lead, status: b.status,
      revenue: Math.round(revenue * 100) / 100, cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100, marginPct, leadsWithCost, startDate,
    });
  }

  // ── Customer margins (order-based: revenue = total_price per batch) ──
  const customerMargins: Record<string, { name: string; revenue: number; cost: number; margin: number; leads: number; marginPct: number }> = {};

  for (const b of allBatches) {
    if (!b.price_per_lead) continue;
    const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
    const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
    if (!customerMargins[b.customer_id]) {
      customerMargins[b.customer_id] = { name: custName, revenue: 0, cost: 0, margin: 0, leads: 0, marginPct: 0 };
    }
    const cm = customerMargins[b.customer_id];
    cm.revenue += Number(b.total_price) || (b.batch_size * b.price_per_lead);
    cm.leads += b.batch_size;
  }

  // Add cost from assignments (only batch-linked for ad-cost attribution)
  const batchCustomerMap = new Map<string, string>();
  for (const b of allBatches) batchCustomerMap.set(b.id, b.customer_id);
  for (const a of allAssignments) {
    if (!a.batch_id) continue;
    const custId = batchCustomerMap.get(a.batch_id);
    if (!custId) continue;
    const cm = customerMargins[custId];
    if (!cm) continue;
    const lc = leadCostMap[a.lead_id];
    if (lc !== undefined) cm.cost += lc;
  }

  for (const cm of Object.values(customerMargins)) {
    cm.margin = Math.round((cm.revenue - cm.cost) * 100) / 100;
    cm.marginPct = cm.revenue > 0 ? Math.round(((cm.revenue - cm.cost) / cm.revenue) * 100) : 0;
  }

  // ── Bulk revenue (assignments without batch, priced via customer bulk_price_per_lead) ──
  const { data: bulkCustomers } = await supabase
    .from('customers')
    .select('id, name, bulk_price_per_lead')
    .not('bulk_price_per_lead', 'is', null);
  const bulkPriceMap = new Map<string, { price: number; name: string }>();
  for (const c of bulkCustomers || []) {
    bulkPriceMap.set(c.id, { price: Number(c.bulk_price_per_lead), name: c.name });
  }

  let bulkRevenue = 0;
  const bulkByCustomer: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const a of allAssignments) {
    if (a.batch_id) continue;
    const bp = bulkPriceMap.get(a.customer_id);
    if (!bp) continue;
    bulkRevenue += bp.price;
    if (!bulkByCustomer[a.customer_id]) bulkByCustomer[a.customer_id] = { name: bp.name, count: 0, revenue: 0 };
    bulkByCustomer[a.customer_id].count++;
    bulkByCustomer[a.customer_id].revenue += bp.price;
  }

  // ── Totals ──
  const batchRevenue = Object.values(customerMargins).reduce((s, cm) => s + cm.revenue, 0);
  const totalRevenue = batchRevenue + bulkRevenue;
  const totalProfit = totalRevenue - totalAdSpend;
  const roi = totalAdSpend > 0 ? Math.round(((totalRevenue - totalAdSpend) / totalAdSpend) * 100) : 0;

  // ── Daily trend ──
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dailyTrend: Record<string, { spend: number; leads: number }> = {};
  for (const row of allSpendRows) {
    if (row.date < twoWeeksAgo) continue;
    const branch = campaignBranchMap.get(row.campaign_id);
    const startDate = branch ? branchStartDate.get(branch) : globalStartDate;
    if (startDate && row.date < startDate) continue;
    if (!dailyTrend[row.date]) dailyTrend[row.date] = { spend: 0, leads: 0 };
    dailyTrend[row.date].spend += parseFloat(row.spend) || 0;
    dailyTrend[row.date].leads += row.leads_count || 0;
  }

  console.info('[admin/costs]', {
    computeMs: Date.now() - t0,
    leadsRows: allLeads.length,
    assignRows: allAssignments.length,
    leadsTruncated,
    assignmentsTruncated,
  });

  return NextResponse.json({
    weekSpend: Math.round(weekSpend * 100) / 100,
    monthSpend: Math.round(totalAdSpend * 100) / 100,
    totalSpend: Math.round(totalAdSpend * 100) / 100,
    monthBrutoCpl: brutoCpl,
    effectieveCpl,
    avgAssignments,
    batchRevenue: Math.round(batchRevenue * 100) / 100,
    bulkRevenue: Math.round(bulkRevenue * 100) / 100,
    bulkByCustomer: Object.values(bulkByCustomer),
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalAdSpend * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    roi,
    leadsWithCost: totalOurLeads,
    uniqueAssignedLeads,
    totalAssignments,
    globalStartDate,
    branchCosts,
    customerMargins: Object.values(customerMargins).sort((a, b) => b.margin - a.margin),
    batchFinancials: batchFinancials.sort((a, b) => b.profit - a.profit),
    lastSyncAt: lastSync?.synced_at || null,
    dailyTrend: Object.entries(dailyTrend).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
    _costsScope: {
      lookbackDays: COSTS_LOOKBACK_DAYS,
      leadsSampled: allLeads.length,
      assignmentsSampled: allAssignments.length,
      leadsTruncated,
      assignmentsTruncated,
      maxLeadPages: COSTS_LEADS_MAX_PAGES,
      maxAssignmentPages: COSTS_ASSIGN_MAX_PAGES,
      batchesCappedAt: 2500,
      note:
        'Lead- en assignment-aggregaties zijn begrensd op het lookback-venster; zeer oude data kan ontbreken in CPL/marges.',
    },
  });
}
