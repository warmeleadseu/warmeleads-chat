import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const now = new Date();

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ── 1. Ad spend from Meta (only for ads that generated leads in our system) ──
  const { data: relevantAdIds } = await supabase
    .from('leads')
    .select('meta_ad_id')
    .not('meta_ad_id', 'is', null);
  const adIdSet = [...new Set((relevantAdIds || []).map(l => l.meta_ad_id).filter(Boolean))];

  let weekSpend = 0;
  let monthSpend = 0;
  if (adIdSet.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < adIdSet.length; i += chunkSize) {
      const chunk = adIdSet.slice(i, i + chunkSize);
      const [weekRes, monthRes] = await Promise.all([
        supabase.from('meta_ad_spend').select('spend').in('ad_id', chunk).gte('date', weekAgo),
        supabase.from('meta_ad_spend').select('spend').in('ad_id', chunk).gte('date', monthAgo),
      ]);
      weekSpend += (weekRes.data || []).reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);
      monthSpend += (monthRes.data || []).reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);
    }
  }

  // ── 2. Bruto CPL from lead_cost ──
  const { data: monthLeadCosts } = await supabase
    .from('leads')
    .select('id, lead_cost, branch')
    .not('lead_cost', 'is', null)
    .gte('wervingsdatum', monthAgo);

  const allCosts = (monthLeadCosts || []).map(l => parseFloat(l.lead_cost) || 0);
  const monthBrutoCpl = allCosts.length > 0 ? allCosts.reduce((a, b) => a + b, 0) / allCosts.length : null;

  // ── 3. All assignments (month) for multiplier + revenue calc ──
  const { data: monthAssignments } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, customer_id, batch_id')
    .gte('assigned_at', monthAgo);

  const assignmentsByLead = new Map<string, number>();
  for (const a of monthAssignments || []) {
    assignmentsByLead.set(a.lead_id, (assignmentsByLead.get(a.lead_id) || 0) + 1);
  }

  const totalAssignments = monthAssignments?.length || 0;
  const uniqueAssignedLeads = assignmentsByLead.size;
  const avgAssignments = uniqueAssignedLeads > 0
    ? Math.round((totalAssignments / uniqueAssignedLeads) * 100) / 100
    : 0;

  // ── 4. Effectieve CPL = bruto CPL / gem. toewijzingen ──
  const effectieveCpl = monthBrutoCpl && avgAssignments > 0
    ? Math.round((monthBrutoCpl / avgAssignments) * 100) / 100
    : null;

  // ── 5. Branch-level costs with effectieve CPL ──
  const branchTotals: Record<string, { spend: number; count: number; avgCpl: number; effectieveCpl: number; assignments: number }> = {};
  const branchLeadIds = new Map<string, Set<string>>();

  for (const lead of monthLeadCosts || []) {
    const cost = parseFloat(lead.lead_cost) || 0;
    if (!branchTotals[lead.branch]) {
      branchTotals[lead.branch] = { spend: 0, count: 0, avgCpl: 0, effectieveCpl: 0, assignments: 0 };
      branchLeadIds.set(lead.branch, new Set());
    }
    branchTotals[lead.branch].spend += cost;
    branchTotals[lead.branch].count++;
    branchLeadIds.get(lead.branch)!.add(lead.id);
  }

  for (const [branch, ids] of branchLeadIds) {
    let branchAssignments = 0;
    for (const id of ids) {
      branchAssignments += assignmentsByLead.get(id) || 0;
    }
    const bt = branchTotals[branch];
    bt.assignments = branchAssignments;
    bt.avgCpl = bt.count > 0 ? Math.round((bt.spend / bt.count) * 100) / 100 : 0;
    const branchAvgAssign = ids.size > 0 ? branchAssignments / ids.size : 1;
    bt.effectieveCpl = bt.avgCpl > 0 && branchAvgAssign > 0
      ? Math.round((bt.avgCpl / branchAvgAssign) * 100) / 100
      : bt.avgCpl;
  }

  // ── 6. Load all batches (active + completed) for batch-level financials ──
  const { data: allBatches } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, price_per_lead, total_price, status, leads_per_week, customers(name)')
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false });

  // Build lead cost lookup for all assigned leads
  const allLeadIds = [...new Set((monthAssignments || []).map(a => a.lead_id))];
  const leadCostMap: Record<string, number> = {};
  if (allLeadIds.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < allLeadIds.length; i += chunkSize) {
      const chunk = allLeadIds.slice(i, i + chunkSize);
      const { data: leads } = await supabase
        .from('leads')
        .select('id, lead_cost')
        .in('id', chunk)
        .not('lead_cost', 'is', null);
      for (const l of leads || []) {
        leadCostMap[l.id] = parseFloat(l.lead_cost) || 0;
      }
    }
  }

  // ── 7. Batch-level financials ──
  interface BatchFinancial {
    id: string;
    customer: string;
    branch: string;
    batchSize: number;
    delivered: number;
    pricePerLead: number;
    status: string;
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
    leadsWithCost: number;
  }

  const batchFinancials: BatchFinancial[] = [];
  const batchAssignments = new Map<string, { lead_ids: string[] }>();
  for (const a of monthAssignments || []) {
    if (!a.batch_id) continue;
    if (!batchAssignments.has(a.batch_id)) batchAssignments.set(a.batch_id, { lead_ids: [] });
    batchAssignments.get(a.batch_id)!.lead_ids.push(a.lead_id);
  }

  for (const b of allBatches || []) {
    if (!b.price_per_lead) continue;
    const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
    const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
    const revenue = (b.leads_delivered || 0) * b.price_per_lead;

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
      id: b.id,
      customer: custName,
      branch: b.branch,
      batchSize: b.batch_size,
      delivered: b.leads_delivered || 0,
      pricePerLead: b.price_per_lead,
      status: b.status,
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      marginPct,
      leadsWithCost,
    });
  }

  // ── 8. Customer margins (improved: per-batch price, all batches) ──
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

  for (const a of monthAssignments || []) {
    if (!a.batch_id) continue;
    const price = batchPriceMap.get(a.batch_id);
    const info = batchCustomerMap.get(a.batch_id);
    if (price === undefined || !info) continue;
    const cm = customerMargins[info.customerId];
    if (!cm) continue;
    cm.revenue += price;
    cm.leads++;
    const leadCost = leadCostMap[a.lead_id];
    if (leadCost !== undefined) cm.cost += leadCost;
  }

  for (const cm of Object.values(customerMargins)) {
    cm.margin = Math.round((cm.revenue - cm.cost) * 100) / 100;
    cm.marginPct = cm.revenue > 0 ? Math.round(((cm.revenue - cm.cost) / cm.revenue) * 100) : 0;
  }

  // ── 9. Totals ──
  const totalRevenue = Object.values(customerMargins).reduce((s, cm) => s + cm.revenue, 0);
  const totalCost = allCosts.reduce((a, b) => a + b, 0);
  const totalProfit = totalRevenue - totalCost;
  const roi = totalCost > 0 ? Math.round(((totalRevenue - totalCost) / totalCost) * 100) : 0;

  // ── 10. Last sync + daily trend ──
  const { data: lastSync } = await supabase
    .from('meta_ad_spend')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dailyTrend: Record<string, { spend: number; leads: number }> = {};
  if (adIdSet.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < adIdSet.length; i += chunkSize) {
      const chunk = adIdSet.slice(i, i + chunkSize);
      const { data: dailySpend } = await supabase
        .from('meta_ad_spend')
        .select('date, spend, leads_count')
        .in('ad_id', chunk)
        .gte('date', twoWeeksAgo)
        .order('date');
      for (const row of dailySpend || []) {
        if (!dailyTrend[row.date]) dailyTrend[row.date] = { spend: 0, leads: 0 };
        dailyTrend[row.date].spend += parseFloat(row.spend) || 0;
        dailyTrend[row.date].leads += row.leads_count || 0;
      }
    }
  }

  return NextResponse.json({
    weekSpend: Math.round(weekSpend * 100) / 100,
    monthSpend: Math.round(monthSpend * 100) / 100,
    monthBrutoCpl: monthBrutoCpl ? Math.round(monthBrutoCpl * 100) / 100 : null,
    effectieveCpl,
    avgAssignments,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    roi,
    leadsWithCost: allCosts.length,
    uniqueAssignedLeads,
    totalAssignments,
    branchCosts: branchTotals,
    customerMargins: Object.values(customerMargins).sort((a, b) => b.margin - a.margin),
    batchFinancials: batchFinancials.sort((a, b) => b.profit - a.profit),
    lastSyncAt: lastSync?.synced_at || null,
    dailyTrend: Object.entries(dailyTrend).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
  });
}
