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
  const today = now.toISOString().split('T')[0];

  // Total spend this week and month
  const [weekSpendRes, monthSpendRes] = await Promise.all([
    supabase.from('meta_ad_spend').select('spend').gte('date', weekAgo),
    supabase.from('meta_ad_spend').select('spend').gte('date', monthAgo),
  ]);

  const weekSpend = (weekSpendRes.data || []).reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);
  const monthSpend = (monthSpendRes.data || []).reduce((s, r) => s + (parseFloat(r.spend) || 0), 0);

  // Average CPL this week and month
  const { data: weekLeadCosts } = await supabase
    .from('leads')
    .select('lead_cost')
    .not('lead_cost', 'is', null)
    .gte('wervingsdatum', weekAgo);

  const { data: monthLeadCosts } = await supabase
    .from('leads')
    .select('lead_cost')
    .not('lead_cost', 'is', null)
    .gte('wervingsdatum', monthAgo);

  const weekCosts = (weekLeadCosts || []).map(l => parseFloat(l.lead_cost) || 0);
  const monthCosts = (monthLeadCosts || []).map(l => parseFloat(l.lead_cost) || 0);
  const weekAvgCpl = weekCosts.length > 0 ? weekCosts.reduce((a, b) => a + b, 0) / weekCosts.length : null;
  const monthAvgCpl = monthCosts.length > 0 ? monthCosts.reduce((a, b) => a + b, 0) / monthCosts.length : null;

  // Spend per branch (from leads with cost)
  const { data: branchCosts } = await supabase
    .from('leads')
    .select('branch, lead_cost')
    .not('lead_cost', 'is', null)
    .gte('wervingsdatum', monthAgo);

  const branchTotals: Record<string, { spend: number; count: number; avgCpl: number }> = {};
  for (const lead of branchCosts || []) {
    const cost = parseFloat(lead.lead_cost) || 0;
    if (!branchTotals[lead.branch]) branchTotals[lead.branch] = { spend: 0, count: 0, avgCpl: 0 };
    branchTotals[lead.branch].spend += cost;
    branchTotals[lead.branch].count++;
  }
  for (const key of Object.keys(branchTotals)) {
    branchTotals[key].avgCpl = branchTotals[key].count > 0
      ? Math.round((branchTotals[key].spend / branchTotals[key].count) * 100) / 100
      : 0;
  }

  // Margin per customer (lead_cost vs price_per_lead from batches)
  const { data: batches } = await supabase
    .from('customer_batches')
    .select('customer_id, branch, price_per_lead, customers(name)')
    .eq('status', 'active');

  const { data: assignedLeads } = await supabase
    .from('lead_assignments')
    .select('customer_id, lead_id')
    .gte('assigned_at', monthAgo);

  const leadIds = (assignedLeads || []).map(a => a.lead_id);
  let leadCostMap: Record<string, number> = {};
  if (leadIds.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < leadIds.length; i += batchSize) {
      const chunk = leadIds.slice(i, i + batchSize);
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

  const customerMargins: Record<string, { name: string; revenue: number; cost: number; margin: number; leads: number }> = {};
  const batchPriceMap: Record<string, number> = {};
  for (const b of batches || []) {
    if (b.price_per_lead) {
      batchPriceMap[b.customer_id] = b.price_per_lead;
      const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
      const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
      if (!customerMargins[b.customer_id]) {
        customerMargins[b.customer_id] = { name: custName, revenue: 0, cost: 0, margin: 0, leads: 0 };
      }
    }
  }

  for (const a of assignedLeads || []) {
    const price = batchPriceMap[a.customer_id];
    if (price === undefined) continue;
    const cm = customerMargins[a.customer_id];
    if (!cm) continue;
    cm.revenue += price;
    cm.leads++;
    const leadCost = leadCostMap[a.lead_id];
    if (leadCost !== undefined) cm.cost += leadCost;
  }

  for (const cm of Object.values(customerMargins)) {
    cm.margin = cm.revenue - cm.cost;
  }

  // Last sync info
  const { data: lastSync } = await supabase
    .from('meta_ad_spend')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  // Daily spend trend (last 14 days)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: dailySpend } = await supabase
    .from('meta_ad_spend')
    .select('date, spend, leads_count')
    .gte('date', twoWeeksAgo)
    .order('date');

  const dailyTrend: Record<string, { spend: number; leads: number }> = {};
  for (const row of dailySpend || []) {
    if (!dailyTrend[row.date]) dailyTrend[row.date] = { spend: 0, leads: 0 };
    dailyTrend[row.date].spend += parseFloat(row.spend) || 0;
    dailyTrend[row.date].leads += row.leads_count || 0;
  }

  return NextResponse.json({
    weekSpend: Math.round(weekSpend * 100) / 100,
    monthSpend: Math.round(monthSpend * 100) / 100,
    weekAvgCpl: weekAvgCpl ? Math.round(weekAvgCpl * 100) / 100 : null,
    monthAvgCpl: monthAvgCpl ? Math.round(monthAvgCpl * 100) / 100 : null,
    leadsWithCost: monthCosts.length,
    branchCosts: branchTotals,
    customerMargins: Object.values(customerMargins).sort((a, b) => b.margin - a.margin),
    lastSyncAt: lastSync?.synced_at || null,
    dailyTrend: Object.entries(dailyTrend).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date)),
  });
}
