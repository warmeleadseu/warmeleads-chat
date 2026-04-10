import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

function periodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '3days': return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
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

function prevPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    case '3days': return new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
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

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const todayStart = periodStart('day').toISOString();

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

  // Cost metrics: same logic as costs/route.ts (single source of truth)
  const [allAssignmentsRes, relevantAdsRes, batchStartRes] = await Promise.all([
    supabase.from('lead_assignments').select('lead_id, batch_id'),
    supabase.from('leads').select('meta_campaign_id, branch').neq('bron', 'excel_import').not('meta_campaign_id', 'is', null),
    supabase.from('customer_batches').select('branch, created_at').in('status', ['active', 'completed']),
  ]);

  const branchStart = new Map<string, string>();
  for (const b of batchStartRes.data || []) {
    const d = b.created_at ? b.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
    const existing = branchStart.get(b.branch);
    if (!existing || d < existing) branchStart.set(b.branch, d);
  }
  const globalStart = branchStart.size > 0 ? [...branchStart.values()].sort()[0] : new Date().toISOString().split('T')[0];

  const campaignBranch = new Map<string, string>();
  for (const l of relevantAdsRes.data || []) {
    if (l.meta_campaign_id && l.branch) campaignBranch.set(l.meta_campaign_id, l.branch);
  }
  const relevantCampaignIds = [...campaignBranch.keys()];
  const totalOurLeads = (relevantAdsRes.data || []).length;

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

  const assignByLead = new Map<string, number>();
  for (const a of allAssignmentsRes.data || []) {
    assignByLead.set(a.lead_id, (assignByLead.get(a.lead_id) || 0) + 1);
  }
  const avgAssignments = assignByLead.size > 0
    ? Math.round(((allAssignmentsRes.data || []).length / assignByLead.size) * 100) / 100
    : 0;
  const effectieveCpl = brutoCpl > 0 && avgAssignments > 0
    ? Math.round((brutoCpl / avgAssignments) * 100) / 100
    : 0;

  // Revenue based on actual assignments × price_per_lead (same as costs API)
  const batchPriceMap = new Map<string, number>();
  for (const b of batches) {
    if (b.price_per_lead) batchPriceMap.set(b.id, b.price_per_lead);
  }
  let totalRevenue = 0;
  for (const a of allAssignmentsRes.data || []) {
    if (!a.batch_id) continue;
    const price = batchPriceMap.get(a.batch_id);
    if (price !== undefined) totalRevenue += price;
  }

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

  const recentPaidBatches: { id: string; batchId: string; customer: string; branch: string; amount: number; paidAt: string; amId: string | null; amName: string | null; celebrationVideoUrl: string | null }[] = [];

  if (recentPaidOrders && recentPaidOrders.length > 0) {
    const amIds = new Set<string>();
    for (const o of recentPaidOrders) {
      const cb = o.customer_batches as any;
      if (cb?.customers?.account_manager_id) amIds.add(cb.customers.account_manager_id);
    }

    let amMap = new Map<string, { name: string; celebration_video_url: string | null }>();
    if (amIds.size > 0) {
      const { data: ams } = await supabase
        .from('admin_users')
        .select('id, name, celebration_video_url')
        .in('id', [...amIds]);
      for (const am of ams || []) {
        amMap.set(am.id, { name: am.name, celebration_video_url: am.celebration_video_url });
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

  let amLeaderboard: { id: string; name: string; revenue: number; batches: number; celebrationVideoUrl: string | null }[] = [];
  if (amRevenue.size > 0) {
    const { data: leaderboardAMs } = await supabase
      .from('admin_users')
      .select('id, name, celebration_video_url')
      .in('id', [...amRevenue.keys()]);
    amLeaderboard = (leaderboardAMs || []).map(am => ({
      id: am.id,
      name: am.name,
      revenue: amRevenue.get(am.id) || 0,
      batches: amBatchCount.get(am.id) || 0,
      celebrationVideoUrl: am.celebration_video_url,
    })).sort((a, b) => b.revenue - a.revenue);
  }

  const periods = ['day', '3days', 'week', 'month', 'quarter', 'year'] as const;
  const periodStats: Record<string, { leads: number; prevLeads: number; assigned: number; prevAssigned: number }> = {};

  for (const p of periods) {
    const start = periodStart(p).toISOString();
    const prev = prevPeriodStart(p).toISOString();

    const [leadsNow, leadsPrev, assignNow, assignPrev] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', start),
      supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').gte('created_at', prev).lt('created_at', start),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', start),
      supabase.from('lead_assignments').select('id', { count: 'exact', head: true }).gte('assigned_at', prev).lt('assigned_at', start),
    ]);

    periodStats[p] = {
      leads: leadsNow.count || 0,
      prevLeads: leadsPrev.count || 0,
      assigned: assignNow.count || 0,
      prevAssigned: assignPrev.count || 0,
    };
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
      totalProfit: Math.round(totalProfit * 100) / 100,
    },
    recentPaidBatches,
    amLeaderboard,
    timestamp: new Date().toISOString(),
  });
}
