import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { adminCustomerTargetsOnly } from '@/lib/adminBatchQueries';
import { activeTargetSummariesFromUnknown } from '@/lib/batchTargetAreas';

const BREAKDOWN_LOOKBACK_DAYS = 90;
/** Max rijen voor provincie/tak in JS-aggregatie (voorkomt full-table reads). */
const BREAKDOWN_MAX_ROWS = 12_000;
const META_CAMPAIGN_LOOKBACK_DAYS = 180;
const META_CAMPAIGN_PAGE = 1000;
const META_CAMPAIGN_MAX_PAGES = 50;
const BATCHES_LIST_LIMIT = 1_500;
const BULK_ASSIGNMENTS_MAX_PAGES = 80;

const LIVE_STATS_CACHE_TTL_MS = 45_000;
const LIVE_STATS_CACHE_KEY = 'live-stats-v4';
const UNPAID_BATCH_FEED_LIMIT = 18;

interface LiveStatsCacheEntry {
  data: unknown;
  expires: number;
}
const liveStatsCache = new Map<string, LiveStatsCacheEntry>();

function todayMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const t0 = Date.now();
  const cached = liveStatsCache.get(LIVE_STATS_CACHE_KEY);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  const supabase = createServerClient();

  const todayStart = todayMidnight().toISOString();

  const breakdownSince = new Date();
  breakdownSince.setDate(breakdownSince.getDate() - BREAKDOWN_LOOKBACK_DAYS);
  const breakdownSinceIso = breakdownSince.toISOString();

  const [
    totalLeadsRes,
    customersRes,
    batchesRes,
    provincesRes,
    branchRes,
    phoneTodayRes,
    phoneInvalidTodayRes,
  ] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).neq('bron', 'excel_import').neq('bron', 'demo'),
    supabase.from('customers').select('id, name, is_active'),
    supabase
      .from('customer_batches')
      .select(`*, ${adminCustomerTargetsOnly}`)
      .order('created_at', { ascending: false })
      .limit(BATCHES_LIST_LIMIT),
    supabase
      .from('leads')
      .select('provincie, postcode')
      .neq('bron', 'excel_import')
      .neq('bron', 'demo')
      .not('provincie', 'is', null)
      .not('provincie', 'eq', '')
      .gte('created_at', breakdownSinceIso)
      .limit(BREAKDOWN_MAX_ROWS),
    supabase
      .from('leads')
      .select('branch')
      .neq('bron', 'excel_import')
      .neq('bron', 'demo')
      .not('branch', 'is', null)
      .not('branch', 'eq', '')
      .gte('created_at', breakdownSinceIso)
      .limit(BREAKDOWN_MAX_ROWS),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .neq('bron', 'excel_import')
      .neq('bron', 'demo')
      .gte('created_at', todayStart),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .neq('bron', 'excel_import')
      .neq('bron', 'demo')
      .gte('created_at', todayStart)
      .eq('phone_valid', false),
  ]);

  const PROVINCE_ALIASES: Record<string, string> = {
    'Fryslân': 'Friesland',
    'Fryslan': 'Friesland',
    'Fryslàn': 'Friesland',
  };

  const provinceBreakdown: Record<string, number> = {};
  for (const r of provincesRes.data || []) {
    let p = r.provincie as string;
    p = PROVINCE_ALIASES[p] || p;
    if (p === 'Limburg') {
      const pc = ((r.postcode as string) || '').replace(/\s/g, '');
      const isBelgian = /^\d{4}$/.test(pc);
      if (isBelgian) p = 'Limburg (BE)';
    }
    provinceBreakdown[p] = (provinceBreakdown[p] || 0) + 1;
  }

  const branchBreakdown: Record<string, number> = {};
  for (const r of branchRes.data || []) {
    const b = r.branch as string;
    branchBreakdown[b] = (branchBreakdown[b] || 0) + 1;
  }

  const phoneTodayTotal = phoneTodayRes.count || 0;
  const phoneInvalidToday = phoneInvalidTodayRes.count || 0;
  const phoneValidPct =
    phoneTodayTotal > 0 ? Math.round(((phoneTodayTotal - phoneInvalidToday) / phoneTodayTotal) * 100) : 100;

  const batches = batchesRes.data || [];
  const activeBatches = batches.filter(b => b.status === 'active' && b.is_paid === true);
  const completedBatches = batches.filter(b => b.status === 'completed');
  const activeCustomers = (customersRes.data || []).filter(c => c.is_active);

  const { data: apptBatchRows } = await supabase
    .from('appointment_batches')
    .select(
      `id, branch, batch_size, total_price, price_per_appointment, status, is_paid, created_at, ${adminCustomerTargetsOnly}`,
    )
    .eq('is_paid', false)
    .order('created_at', { ascending: false })
    .limit(200);

  type UnpaidFeed = {
    id: string;
    product: 'leads' | 'appointments';
    customer: string;
    branch: string;
    batchSize: number;
    totalPrice: number;
    unitPrice: number | null;
    status: string;
    createdAt: string;
    targetAreaLabels: string[];
  };

  const unpaidLeadItems: UnpaidFeed[] = batches
    .filter(
      b =>
        b.is_paid === false &&
        b.status !== 'completed' &&
        b.status !== 'cancelled',
    )
    .map(b => {
      const cust = b.customers as { name?: string; customer_targets?: unknown } | null;
      return {
        id: String(b.id),
        product: 'leads' as const,
        customer: cust?.name || '-',
        branch: String(b.branch || ''),
        batchSize: Number(b.batch_size) || 0,
        totalPrice: Math.round((Number(b.total_price) || 0) * 100) / 100,
        unitPrice: b.price_per_lead != null ? Math.round(Number(b.price_per_lead) * 100) / 100 : null,
        status: String(b.status || ''),
        createdAt: String(b.created_at || ''),
        targetAreaLabels: activeTargetSummariesFromUnknown(cust?.customer_targets),
      };
    });

  const unpaidApptItems: UnpaidFeed[] = (apptBatchRows || [])
    .filter(b => b.status !== 'completed' && b.status !== 'cancelled')
    .map(b => {
      const cust = b.customers as { name?: string; customer_targets?: unknown } | null;
      return {
        id: String(b.id),
        product: 'appointments' as const,
        customer: cust?.name || '-',
        branch: String(b.branch || ''),
        batchSize: Number(b.batch_size) || 0,
        totalPrice: Math.round((Number(b.total_price) || 0) * 100) / 100,
        unitPrice: b.price_per_appointment != null ? Math.round(Number(b.price_per_appointment) * 100) / 100 : null,
        status: String(b.status || ''),
        createdAt: String(b.created_at || ''),
        targetAreaLabels: activeTargetSummariesFromUnknown(cust?.customer_targets),
      };
    });

  const unpaidBatches = [...unpaidLeadItems, ...unpaidApptItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, UNPAID_BATCH_FEED_LIMIT);

  const [revenueStatsRes, batchStartRes] = await Promise.all([
    supabase.rpc('live_revenue_stats'),
    supabase
      .from('customer_batches')
      .select('branch, created_at')
      .in('status', ['active', 'completed'])
      .limit(3000),
  ]);

  const metaSince = new Date();
  metaSince.setDate(metaSince.getDate() - META_CAMPAIGN_LOOKBACK_DAYS);
  const metaSinceIso = metaSince.toISOString();

  let relevantAdsData: { meta_campaign_id: string; branch: string }[] = [];
  let metaCampaignPagesFetched = 0;
  let metaCampaignTruncated = false;
  {
    let offset = 0;
    for (let page = 0; page < META_CAMPAIGN_MAX_PAGES; page++) {
      const { data } = await supabase
        .from('leads')
        .select('meta_campaign_id, branch')
        .neq('bron', 'excel_import')
        .neq('bron', 'demo')
        .not('meta_campaign_id', 'is', null)
        .gte('created_at', metaSinceIso)
        .range(offset, offset + META_CAMPAIGN_PAGE - 1);
      metaCampaignPagesFetched++;
      if (!data || data.length === 0) break;
      relevantAdsData = relevantAdsData.concat(data as { meta_campaign_id: string; branch: string }[]);
      if (data.length < META_CAMPAIGN_PAGE) break;
      offset += META_CAMPAIGN_PAGE;
      if (page === META_CAMPAIGN_MAX_PAGES - 1) {
        metaCampaignTruncated = true;
      }
    }
  }

  const revenueStats =
    (revenueStatsRes.data as {
      batch_revenue: number;
      bulk_revenue: number;
      total_assignments: number;
      unique_assigned_leads: number;
      bulk_assignment_count: number;
    } | null) || {
      batch_revenue: 0,
      bulk_revenue: 0,
      total_assignments: 0,
      unique_assigned_leads: 0,
      bulk_assignment_count: 0,
    };

  const branchStart = new Map<string, string>();
  for (const b of batchStartRes.data || []) {
    const d = b.created_at ? b.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
    const existing = branchStart.get(b.branch);
    if (!existing || d < existing) branchStart.set(b.branch, d);
  }
  const globalStart =
    branchStart.size > 0 ? [...branchStart.values()].sort()[0] : new Date().toISOString().split('T')[0];

  const campaignBranch = new Map<string, string>();
  for (const l of relevantAdsData) {
    if (l.meta_campaign_id && l.branch) campaignBranch.set(l.meta_campaign_id, l.branch);
  }
  const relevantCampaignIds = [...campaignBranch.keys()];
  const totalOurLeads = relevantAdsData.length;

  let monthAdSpend = 0;
  if (relevantCampaignIds.length > 0) {
    const { data: spendRows } = await supabase
      .from('meta_ad_spend')
      .select('campaign_id, date, spend')
      .in('campaign_id', relevantCampaignIds)
      .gte('date', globalStart);
    for (const r of spendRows || []) {
      const branch = campaignBranch.get(r.campaign_id);
      const startDate = branch ? branchStart.get(branch) : globalStart;
      if (startDate && r.date < startDate) continue;
      monthAdSpend += parseFloat(r.spend) || 0;
    }
  }

  const brutoCpl = totalOurLeads > 0 ? monthAdSpend / totalOurLeads : 0;

  /** Zelfde logica als admin kosten: distributie-toewijzingen / Meta-leads in venster. */
  const distributionAssignTotal = Number(revenueStats.total_assignments) || 0;
  const avgAssignments =
    totalOurLeads > 0 && distributionAssignTotal > 0
      ? Math.round((distributionAssignTotal / totalOurLeads) * 100) / 100
      : 0;
  const effectieveCpl =
    distributionAssignTotal > 0
      ? Math.round((monthAdSpend / distributionAssignTotal) * 100) / 100
      : 0;

  const batchRevenue = Number(revenueStats.batch_revenue) || 0;
  const bulkRevenue = Number(revenueStats.bulk_revenue) || 0;
  const totalRevenue = batchRevenue + bulkRevenue;
  const totalProfit = totalRevenue - monthAdSpend;

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentPaidOrders } = await supabase
    .from('batch_orders')
    .select(
      'id, batch_id, total_price, paid_at, customer_batches!batch_orders_batch_id_fkey(account_manager_id, customer_id, branch, customers(name, account_manager_id))',
    )
    .eq('status', 'paid')
    .gte('paid_at', tenMinAgo)
    .order('paid_at', { ascending: false })
    .limit(5);

  const recentPaidBatches: {
    id: string;
    batchId: string;
    customer: string;
    branch: string;
    amount: number;
    paidAt: string;
    amId: string | null;
    amName: string | null;
    celebrationVideoUrl: string | null;
    videoStart: number | null;
    videoEnd: number | null;
  }[] = [];

  if (recentPaidOrders && recentPaidOrders.length > 0) {
    const amIds = new Set<string>();
    for (const o of recentPaidOrders) {
      const cb = o.customer_batches as any;
      const resolvedAmId = cb?.account_manager_id || cb?.customers?.account_manager_id;
      if (resolvedAmId) amIds.add(resolvedAmId);
    }

    const amMap = new Map<
      string,
      {
        name: string;
        celebration_video_url: string | null;
        celebration_video_start: number | null;
        celebration_video_end: number | null;
      }
    >();
    if (amIds.size > 0) {
      const { data: ams } = await supabase
        .from('admin_users')
        .select('id, name, celebration_video_url, celebration_video_start, celebration_video_end')
        .in('id', [...amIds]);
      for (const am of ams || []) {
        amMap.set(am.id, {
          name: am.name,
          celebration_video_url: am.celebration_video_url,
          celebration_video_start: am.celebration_video_start,
          celebration_video_end: am.celebration_video_end,
        });
      }
    }

    for (const o of recentPaidOrders) {
      const cb = o.customer_batches as any;
      const amId = cb?.account_manager_id || cb?.customers?.account_manager_id || null;
      const am = amId ? amMap.get(amId) : null;
      recentPaidBatches.push({
        id: o.id,
        batchId: o.batch_id,
        customer: cb?.customers?.name || '-',
        branch: cb?.branch || '-',
        amount: Number(o.total_price) || 0,
        paidAt: o.paid_at,
        amId,
        amName: am?.name || null,
        celebrationVideoUrl: am?.celebration_video_url || null,
        videoStart: am?.celebration_video_start ?? null,
        videoEnd: am?.celebration_video_end ?? null,
      });
    }
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: monthlyPaidBatches } = await supabase
    .from('customer_batches')
    .select('total_price, account_manager_id, customer_id, customers(account_manager_id)')
    .eq('is_paid', true)
    .gte('created_at', monthStart);

  const amRevenue = new Map<string, number>();
  const amBatchCount = new Map<string, number>();
  for (const cb of monthlyPaidBatches || []) {
    const cust = cb.customers as any;
    const amId = cb.account_manager_id || cust?.account_manager_id;
    if (!amId) continue;
    amRevenue.set(amId, (amRevenue.get(amId) || 0) + (Number(cb.total_price) || 0));
    amBatchCount.set(amId, (amBatchCount.get(amId) || 0) + 1);
  }

  const { data: bulkCustomers } = await supabase
    .from('customers')
    .select('id, bulk_price_per_lead, account_manager_id')
    .not('bulk_price_per_lead', 'is', null);

  const amBulkRevenue = new Map<string, number>();
  let bulkAssignmentsTruncated = false;
  if (bulkCustomers && bulkCustomers.length > 0) {
    const bulkMap = new Map<string, { price: number; amId: string | null }>();
    for (const c of bulkCustomers) {
      bulkMap.set(c.id, { price: Number(c.bulk_price_per_lead), amId: c.account_manager_id });
    }

    const bulkCustIds = [...bulkMap.keys()];
    let bulkAssignments: { customer_id: string }[] = [];
    const PAGE = 1000;
    let offset = 0;
    for (let p = 0; p < BULK_ASSIGNMENTS_MAX_PAGES; p++) {
      const { data } = await supabase
        .from('lead_assignments')
        .select('customer_id')
        .is('batch_id', null)
        .in('customer_id', bulkCustIds)
        .gte('assigned_at', monthStart)
        .range(offset, offset + PAGE - 1);
      if (!data || data.length === 0) break;
      bulkAssignments = bulkAssignments.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
      if (p === BULK_ASSIGNMENTS_MAX_PAGES - 1) {
        bulkAssignmentsTruncated = true;
        break;
      }
    }

    for (const a of bulkAssignments) {
      const info = bulkMap.get(a.customer_id);
      if (!info || !info.amId) continue;
      amBulkRevenue.set(info.amId, (amBulkRevenue.get(info.amId) || 0) + info.price);
    }
  }

  const { data: allAMs } = await supabase
    .from('admin_users')
    .select('id, name, celebration_video_url, avatar_url')
    .eq('is_account_manager', true)
    .eq('is_active', true);

  const amLeaderboard = (allAMs || [])
    .map(am => ({
      id: am.id,
      name: am.name,
      revenue: amRevenue.get(am.id) || 0,
      bulkRevenue: Math.round((amBulkRevenue.get(am.id) || 0) * 100) / 100,
      batches: amBatchCount.get(am.id) || 0,
      celebrationVideoUrl: am.celebration_video_url,
      avatarUrl: am.avatar_url,
    }))
    .sort((a, b) => b.revenue + b.bulkRevenue - (a.revenue + a.bulkRevenue));

  const periodStats: Record<
    string,
    {
      leads: number;
      prevLeads: number;
      assigned: number;
      prevAssigned: number;
      revenue: number;
      prevRevenue: number;
      adSpend: number;
      prevAdSpend: number;
      profit: number;
      prevProfit: number;
    }
  > = {};

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

  const provinceSampleSize = (provincesRes.data || []).length;
  const branchSampleSize = (branchRes.data || []).length;
  const provinceBranchCapped =
    provinceSampleSize >= BREAKDOWN_MAX_ROWS || branchSampleSize >= BREAKDOWN_MAX_ROWS;

  const payload = {
    totalLeads: totalLeadsRes.count || 0,
    activeCustomers: activeCustomers.length,
    totalCustomers: (customersRes.data || []).length,
    activeBatches: activeBatches.map(b => {
      const cust = b.customers as { name?: string; customer_targets?: unknown } | null;
      return {
        id: b.id,
        customer: cust?.name || '-',
        branch: b.branch,
        batchSize: b.batch_size,
        delivered: b.leads_delivered,
        pricePerLead: b.price_per_lead,
        leadsPerDay: b.leads_per_day,
        leadsPerWeek: b.leads_per_week,
        notes: b.notes,
        targetAreaLabels: activeTargetSummariesFromUnknown(cust?.customer_targets),
      };
    }),
    completedBatchCount: completedBatches.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    unpaidBatches,
    periodStats,
    provinceBreakdown,
    branchBreakdown,
    phoneQuality: { total: phoneTodayTotal, invalid: phoneInvalidToday, validPct: phoneValidPct },
    costMetrics: {
      monthAdSpend: Math.round(monthAdSpend * 100) / 100,
      brutoCpl: Math.round(brutoCpl * 100) / 100,
      effectieveCpl,
      avgAssignments,
      distributionAssignmentTotal: distributionAssignTotal,
      batchRevenue: Math.round(batchRevenue * 100) / 100,
      bulkRevenue: Math.round(bulkRevenue * 100) / 100,
      bulkAssignmentCount: revenueStats.bulk_assignment_count,
      totalProfit: Math.round(totalProfit * 100) / 100,
    },
    recentPaidBatches,
    amLeaderboard,
    timestamp: new Date().toISOString(),
    _liveStatsScope: {
      breakdownLookbackDays: BREAKDOWN_LOOKBACK_DAYS,
      breakdownMaxRows: BREAKDOWN_MAX_ROWS,
      provinceSampleRows: provinceSampleSize,
      branchSampleRows: branchSampleSize,
      provinceBranchCapped,
      metaCampaignLookbackDays: META_CAMPAIGN_LOOKBACK_DAYS,
      metaCampaignPagesFetched,
      metaCampaignTruncated,
      batchesListLimit: BATCHES_LIST_LIMIT,
      bulkAssignmentsMaxPages: BULK_ASSIGNMENTS_MAX_PAGES,
      bulkAssignmentsTruncated,
      cacheTtlMs: LIVE_STATS_CACHE_TTL_MS,
      computeMs: Date.now() - t0,
    },
  };

  liveStatsCache.set(LIVE_STATS_CACHE_KEY, {
    data: payload,
    expires: Date.now() + LIVE_STATS_CACHE_TTL_MS,
  });

  console.info('[live-stats]', {
    computeMs: Date.now() - t0,
    metaCampaignPagesFetched,
    metaCampaignTruncated,
    provinceSampleRows: provinceSampleSize,
    branchSampleRows: branchSampleSize,
  });

  return NextResponse.json(payload);
}
