import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

function todayMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const todayStart = todayMidnight().toISOString();

  const [
    totalLeadsRes,
    customersRes,
    batchesRes,
    recentLeadsRes,
    assignmentsRes,
    provincesRes,
    branchRes,
    phoneTodayRes,
    phoneInvalidTodayRes,
  ] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import'),
    supabase.from('customers').select('id, name, is_active'),
    supabase.from('customer_batches').select('*, customers(name)').order('created_at', { ascending: false }),
    supabase.from('leads').select('id, naam_klant, branch, plaatsnaam, provincie, created_at').neq('bron', 'excel_import').order('created_at', { ascending: false }).limit(12),
    supabase.from('lead_assignments').select('id, lead_id, customer_id, batch_id, assigned_at, customers(name)').order('assigned_at', { ascending: false }).limit(500),
    supabase.from('leads').select('provincie, postcode').neq('bron', 'excel_import').not('provincie', 'is', null).not('provincie', 'eq', ''),
    supabase.from('leads').select('branch').neq('bron', 'excel_import').not('branch', 'is', null).not('branch', 'eq', ''),
    supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', todayStart),
    supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', todayStart).eq('phone_valid', false),
  ]);

  const provinceBreakdown: Record<string, number> = {};
  for (const r of (provincesRes.data || [])) {
    let p = r.provincie as string;
    if (p === 'Limburg') {
      const pc = (r.postcode as string || '').replace(/\s/g, '');
      const isBelgian = /^\d{4}$/.test(pc);
      if (isBelgian) p = 'Limburg (BE)';
    }
    provinceBreakdown[p] = (provinceBreakdown[p] || 0) + 1;
  }

  const branchBreakdown: Record<string, number> = {};
  for (const r of (branchRes.data || [])) {
    const b = r.branch as string;
    branchBreakdown[b] = (branchBreakdown[b] || 0) + 1;
  }

  const phoneTodayTotal = phoneTodayRes.count || 0;
  const phoneInvalidToday = phoneInvalidTodayRes.count || 0;
  const phoneValidPct = phoneTodayTotal > 0 ? Math.round(((phoneTodayTotal - phoneInvalidToday) / phoneTodayTotal) * 100) : 100;

  const batches = batchesRes.data || [];
  const activeBatches = batches.filter(b => b.status === 'active');
  const completedBatches = batches.filter(b => b.status === 'completed');
  const activeCustomers = (customersRes.data || []).filter(c => c.is_active);

  // Cost metrics: use RPC to avoid PostgREST 1000-row default limit
  const [revenueStatsRes, batchStartRes] = await Promise.all([
    supabase.rpc('live_revenue_stats'),
    supabase.from('customer_batches').select('branch, created_at').in('status', ['active', 'completed']),
  ]);

  // Paginate leads with campaign IDs to avoid 1000-row cap
  let relevantAdsData: { meta_campaign_id: string; branch: string }[] = [];
  {
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data } = await supabase.from('leads').select('meta_campaign_id, branch').neq('bron', 'excel_import').not('meta_campaign_id', 'is', null).range(offset, offset + PAGE - 1);
      if (!data || data.length === 0) break;
      relevantAdsData = relevantAdsData.concat(data as { meta_campaign_id: string; branch: string }[]);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  const revenueStats = (revenueStatsRes.data as {
    batch_revenue: number; bulk_revenue: number;
    total_assignments: number; unique_assigned_leads: number;
    bulk_assignment_count: number;
  } | null) || { batch_revenue: 0, bulk_revenue: 0, total_assignments: 0, unique_assigned_leads: 0, bulk_assignment_count: 0 };

  const branchStart = new Map<string, string>();
  for (const b of batchStartRes.data || []) {
    const d = b.created_at ? b.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
    const existing = branchStart.get(b.branch);
    if (!existing || d < existing) branchStart.set(b.branch, d);
  }
  const globalStart = branchStart.size > 0 ? [...branchStart.values()].sort()[0] : new Date().toISOString().split('T')[0];

  const campaignBranch = new Map<string, string>();
  for (const l of relevantAdsData) {
    if (l.meta_campaign_id && l.branch) campaignBranch.set(l.meta_campaign_id, l.branch);
  }
  const relevantCampaignIds = [...campaignBranch.keys()];
  const totalOurLeads = relevantAdsData.length;

  let monthAdSpend = 0;
  if (relevantCampaignIds.length > 0) {
    const { data: spendRows } = await supabase.from('meta_ad_spend').select('campaign_id, date, spend').in('campaign_id', relevantCampaignIds).gte('date', globalStart);
    for (const r of spendRows || []) {
      const branch = campaignBranch.get(r.campaign_id);
      const startDate = branch ? branchStart.get(branch) : globalStart;
      if (startDate && r.date < startDate) continue;
      monthAdSpend += parseFloat(r.spend) || 0;
    }
  }

  const brutoCpl = totalOurLeads > 0 ? monthAdSpend / totalOurLeads : 0;

  const avgAssignments = revenueStats.unique_assigned_leads > 0
    ? Math.round((revenueStats.total_assignments / revenueStats.unique_assigned_leads) * 100) / 100
    : 0;
  const effectieveCpl = brutoCpl > 0 && avgAssignments > 0
    ? Math.round((brutoCpl / avgAssignments) * 100) / 100
    : 0;

  const batchRevenue = Number(revenueStats.batch_revenue) || 0;
  const bulkRevenue = Number(revenueStats.bulk_revenue) || 0;
  const totalRevenue = batchRevenue + bulkRevenue;
  const totalProfit = totalRevenue - monthAdSpend;

  // ── Recently paid batches (last 10 min) for celebration detection ──
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentPaidOrders } = await supabase
    .from('batch_orders')
    .select('id, batch_id, amount, paid_at, customer_batches(customer_id, branch, customers(name, account_manager_id))')
    .eq('status', 'paid')
    .gte('paid_at', tenMinAgo)
    .order('paid_at', { ascending: false })
    .limit(5);

  const recentPaidBatches: { id: string; batchId: string; customer: string; branch: string; amount: number; paidAt: string; amId: string | null; amName: string | null; celebrationVideoUrl: string | null; videoStart: number | null; videoEnd: number | null }[] = [];

  if (recentPaidOrders && recentPaidOrders.length > 0) {
    const amIds = new Set<string>();
    for (const o of recentPaidOrders) {
      const cb = o.customer_batches as any;
      if (cb?.customers?.account_manager_id) amIds.add(cb.customers.account_manager_id);
    }

    let amMap = new Map<string, { name: string; celebration_video_url: string | null; celebration_video_start: number | null; celebration_video_end: number | null }>();
    if (amIds.size > 0) {
      const { data: ams } = await supabase
        .from('admin_users')
        .select('id, name, celebration_video_url, celebration_video_start, celebration_video_end')
        .in('id', [...amIds]);
      for (const am of ams || []) {
        amMap.set(am.id, { name: am.name, celebration_video_url: am.celebration_video_url, celebration_video_start: am.celebration_video_start, celebration_video_end: am.celebration_video_end });
      }
    }

    for (const o of recentPaidOrders) {
      const cb = o.customer_batches as any;
      const amId = cb?.customers?.account_manager_id || null;
      const am = amId ? amMap.get(amId) : null;
      recentPaidBatches.push({
        id: o.id,
        batchId: o.batch_id,
        customer: cb?.customers?.name || '-',
        branch: cb?.branch || '-',
        amount: Number(o.amount) || 0,
        paidAt: o.paid_at,
        amId,
        amName: am?.name || null,
        celebrationVideoUrl: am?.celebration_video_url || null,
        videoStart: am?.celebration_video_start ?? null,
        videoEnd: am?.celebration_video_end ?? null,
      });
    }
  }

  // ── AM Leaderboard (monthly revenue) ──
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: monthlyOrders } = await supabase
    .from('batch_orders')
    .select('amount, customer_batches(customer_id, customers(account_manager_id))')
    .eq('status', 'paid')
    .gte('paid_at', monthStart);

  const amRevenue = new Map<string, number>();
  const amBatchCount = new Map<string, number>();
  for (const o of monthlyOrders || []) {
    const cb = o.customer_batches as any;
    const amId = cb?.customers?.account_manager_id;
    if (!amId) continue;
    amRevenue.set(amId, (amRevenue.get(amId) || 0) + (Number(o.amount) || 0));
    amBatchCount.set(amId, (amBatchCount.get(amId) || 0) + 1);
  }

  let amLeaderboard: { id: string; name: string; revenue: number; batches: number; celebrationVideoUrl: string | null; avatarUrl: string | null }[] = [];
  if (amRevenue.size > 0) {
    const { data: leaderboardAMs } = await supabase
      .from('admin_users')
      .select('id, name, celebration_video_url, avatar_url')
      .in('id', [...amRevenue.keys()]);
    amLeaderboard = (leaderboardAMs || []).map(am => ({
      id: am.id,
      name: am.name,
      revenue: amRevenue.get(am.id) || 0,
      batches: amBatchCount.get(am.id) || 0,
      celebrationVideoUrl: am.celebration_video_url,
      avatarUrl: am.avatar_url,
    })).sort((a, b) => b.revenue - a.revenue);
  }

  // All period stats (leads, assignments, revenue, ad spend, profit) from a single RPC
  // to ensure consistent timestamps and eliminate timezone mismatches
  const periodStats: Record<string, { leads: number; prevLeads: number; assigned: number; prevAssigned: number; revenue: number; prevRevenue: number; adSpend: number; prevAdSpend: number; profit: number; prevProfit: number }> = {};

  const { data: profitData } = await supabase.rpc('period_profit_stats');
  if (profitData) {
    for (const key of Object.keys(profitData)) {
      const pp = profitData[key];
      if (pp) {
        periodStats[key] = {
          leads: Number(pp.leads) || 0,
          prevLeads: Number(pp.prev_leads) || 0,
          assigned: Number(pp.assigned) || 0,
          prevAssigned: Number(pp.prev_assigned) || 0,
          revenue: Math.round((Number(pp.revenue) || 0) * 100) / 100,
          prevRevenue: Math.round((Number(pp.prev_revenue) || 0) * 100) / 100,
          adSpend: Math.round((Number(pp.ad_spend) || 0) * 100) / 100,
          prevAdSpend: Math.round((Number(pp.prev_ad_spend) || 0) * 100) / 100,
          profit: Math.round((Number(pp.profit) || 0) * 100) / 100,
          prevProfit: Math.round((Number(pp.prev_profit) || 0) * 100) / 100,
        };
      }
    }
  }

  return NextResponse.json({
    totalLeads: totalLeadsRes.count || 0,
    activeCustomers: activeCustomers.length,
    totalCustomers: (customersRes.data || []).length,
    activeBatches: activeBatches.map(b => ({
      id: b.id,
      customer: b.customers?.name || '-',
      branch: b.branch,
      batchSize: b.batch_size,
      delivered: b.leads_delivered,
      pricePerLead: b.price_per_lead,
      leadsPerDay: b.leads_per_day,
      leadsPerWeek: b.leads_per_week,
      notes: b.notes,
    })),
    completedBatchCount: completedBatches.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    recentLeads: (recentLeadsRes.data || []).map(l => ({
      id: l.id,
      name: l.naam_klant,
      branch: l.branch,
      city: l.plaatsnaam,
      province: l.provincie,
      createdAt: l.created_at,
    })),
    periodStats,
    provinceBreakdown,
    branchBreakdown,
    phoneQuality: { total: phoneTodayTotal, invalid: phoneInvalidToday, validPct: phoneValidPct },
    costMetrics: {
      monthAdSpend: Math.round(monthAdSpend * 100) / 100,
      brutoCpl: Math.round(brutoCpl * 100) / 100,
      effectieveCpl,
      avgAssignments,
      batchRevenue: Math.round(batchRevenue * 100) / 100,
      bulkRevenue: Math.round(bulkRevenue * 100) / 100,
      bulkAssignmentCount: revenueStats.bulk_assignment_count,
      totalProfit: Math.round(totalProfit * 100) / 100,
    },
    recentPaidBatches,
    amLeaderboard,
    timestamp: new Date().toISOString(),
  });
}
