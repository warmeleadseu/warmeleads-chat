import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // ── 0. Batch start dates per branch ──
  const { data: allBatches } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, price_per_lead, total_price, status, leads_per_week, created_at, customers(name)')
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false });

  const branchStartDate = new Map<string, string>();
  for (const b of allBatches || []) {
    const batchDate = b.created_at ? b.created_at.split('T')[0] : today;
    const existing = branchStartDate.get(b.branch);
    if (!existing || batchDate < existing) branchStartDate.set(b.branch, batchDate);
  }
  const globalStartDate = branchStartDate.size > 0 ? [...branchStartDate.values()].sort()[0] : today;

  // ── 1. All our leads with campaign info (exclude spreadsheet imports) ──
  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, branch, meta_campaign_id, wervingsdatum, lead_cost')
    .neq('bron', 'excel_import');

  const leadsWithCampaign = (allLeads || []).filter(l => l.meta_campaign_id);
  const campaignBranchMap = new Map<string, string>();
  for (const l of leadsWithCampaign) {
    if (!campaignBranchMap.has(l.meta_campaign_id)) {
      campaignBranchMap.set(l.meta_campaign_id, l.branch);
    }
  }
  const campaignIdSet = [...campaignBranchMap.keys()];
  const totalOurLeads = leadsWithCampaign.length;

  // ── 2. Total campaign spend from Meta (from batch start dates) ──
  interface SpendRow { campaign_id: string; date: string; spend: string; leads_count: number }
  const allSpendRows: SpendRow[] = [];
  if (campaignIdSet.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < campaignIdSet.length; i += chunkSize) {
      const chunk = campaignIdSet.slice(i, i + chunkSize);
      const { data } = await supabase
        .from('meta_ad_spend')
        .select('campaign_id, date, spend, leads_count')
        .in('campaign_id', chunk)
        .gte('date', globalStartDate);
      if (data) allSpendRows.push(...(data as SpendRow[]));
    }
  }

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

  // ── 3. Bruto CPL = total ad spend / our lead count ──
  const brutoCpl = totalOurLeads > 0
    ? Math.round((totalAdSpend / totalOurLeads) * 100) / 100
    : null;

  // ── 4. All assignments for multiplier + revenue calc ──
  const { data: allAssignments } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, customer_id, batch_id');

  const assignmentsByLead = new Map<string, number>();
  for (const a of allAssignments || []) {
    assignmentsByLead.set(a.lead_id, (assignmentsByLead.get(a.lead_id) || 0) + 1);
  }

  const totalAssignments = allAssignments?.length || 0;
  const uniqueAssignedLeads = assignmentsByLead.size;
  const avgAssignments = uniqueAssignedLeads > 0
    ? Math.round((totalAssignments / uniqueAssignedLeads) * 100) / 100
    : 0;

  // ── 5. Effectieve CPL = bruto CPL / gem. toewijzingen ──
  const effectieveCpl = brutoCpl && avgAssignments > 0
    ? Math.round((brutoCpl / avgAssignments) * 100) / 100
    : null;

  // ── 6. Cost per lead for profit calculations = ad spend / our leads ──
  // Each lead's share of cost = totalAdSpend / totalOurLeads
  const costPerLead = totalOurLeads > 0 ? totalAdSpend / totalOurLeads : 0;

  // ── 7. Branch-level costs ──
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

  // ── 8. Lead cost lookup for batch/customer financials ──
  const leadCostMap: Record<string, number> = {};
  for (const l of allLeads || []) {
    if (l.meta_campaign_id) leadCostMap[l.id] = costPerLead;
  }

  // ── 9. Batch-level financials ──
  interface BatchFinancial {
    id: string; customer: string; branch: string; batchSize: number; delivered: number;
    pricePerLead: number; status: string; revenue: number; cost: number; profit: number;
    marginPct: number; leadsWithCost: number; startDate: string;
  }

  const batchFinancials: BatchFinancial[] = [];
  const batchAssignments = new Map<string, { lead_ids: string[] }>();
  for (const a of allAssignments || []) {
    if (!a.batch_id) continue;
    if (!batchAssignments.has(a.batch_id)) batchAssignments.set(a.batch_id, { lead_ids: [] });
    batchAssignments.get(a.batch_id)!.lead_ids.push(a.lead_id);
  }

  for (const b of allBatches || []) {
    if (!b.price_per_lead) continue;
    const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
    const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
    const revenue = (b.leads_delivered || 0) * b.price_per_lead;
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

  // ── 10. Customer margins ──
  const customerMargins: Record<string, { name: string; revenue: number; cost: number; margin: number; leads: number; marginPct: number }> = {};
  const batchPriceMap = new Map<string, number>();
  const batchCustomerMap = new Map<string, { customerId: string; name: string }>();

  for (const b of allBatches || []) {
    if (!b.price_per_lead) continue;
    batchPriceMap.set(b.id, b.price_per_lead);
    const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
    const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
    batchCustomerMap.set(b.id, { customerId: b.customer_id, name: custName });
    if (!customerMargins[b.customer_id]) {
      customerMargins[b.customer_id] = { name: custName, revenue: 0, cost: 0, margin: 0, leads: 0, marginPct: 0 };
    }
  }

  for (const a of allAssignments || []) {
    if (!a.batch_id) continue;
    const price = batchPriceMap.get(a.batch_id);
    const info = batchCustomerMap.get(a.batch_id);
    if (price === undefined || !info) continue;
    const cm = customerMargins[info.customerId];
    if (!cm) continue;
    cm.revenue += price;
    cm.leads++;
    const lc = leadCostMap[a.lead_id];
    if (lc !== undefined) cm.cost += lc;
  }

  for (const cm of Object.values(customerMargins)) {
    cm.margin = Math.round((cm.revenue - cm.cost) * 100) / 100;
    cm.marginPct = cm.revenue > 0 ? Math.round(((cm.revenue - cm.cost) / cm.revenue) * 100) : 0;
  }

  // ── 11. Totals ──
  const totalRevenue = Object.values(customerMargins).reduce((s, cm) => s + cm.revenue, 0);
  const totalProfit = totalRevenue - totalAdSpend;
  const roi = totalAdSpend > 0 ? Math.round(((totalRevenue - totalAdSpend) / totalAdSpend) * 100) : 0;

  // ── 12. Last sync + daily trend ──
  const { data: lastSync } = await supabase
    .from('meta_ad_spend')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

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

  return NextResponse.json({
    weekSpend: Math.round(weekSpend * 100) / 100,
    monthSpend: Math.round(totalAdSpend * 100) / 100,
    totalSpend: Math.round(totalAdSpend * 100) / 100,
    monthBrutoCpl: brutoCpl,
    effectieveCpl,
    avgAssignments,
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
  });
}
