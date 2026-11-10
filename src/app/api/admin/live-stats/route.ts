import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSpendRowsSince,
  splitSpend,
  leadExclusionOrFilter,
} from '@/lib/metaCpl';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';
import type { ManualLineRow } from '@/lib/amLeaderboardRules';
import { loadLeaderboardExcludedBatchIds, loadLeaderboardManualLines } from '@/lib/amLeaderboardServer';
import { adminCustomerLiveUnpaidEmbed, adminCustomerTargetsOnly } from '@/lib/adminBatchQueries';
import { activeTargetSummariesFromUnknown } from '@/lib/batchTargetAreas';
import { laadActieSamenvatting } from '@/lib/lotenActieLaden';
import { telOmzet } from '@/lib/omzetPerMaand';
import { laadOmzetMetAm } from '@/lib/omzetPerMaandLaden';
import { omzetPerAm } from '@/lib/omzetPerAm';
import { amsterdamWallTimeToUtc, amsterdamYmd } from '@/lib/appointmentSlots';
import {
  countApprovedReclamationsForAssignments,
  getApprovedReclamationStats,
} from '@/lib/reclamationStats';

const BREAKDOWN_LOOKBACK_DAYS = 90;
/** Max rijen voor provincie/tak in JS-aggregatie (voorkomt full-table reads). */
const BREAKDOWN_MAX_ROWS = 12_000;
const BATCHES_LIST_LIMIT = 1_500;

const LIVE_STATS_CACHE_TTL_MS = 45_000;
const LIVE_STATS_CACHE_KEY = 'live-stats-v11';
/** Batches en facturen van vóór deze dag tellen niet meer mee in de maandomzet. */
const OMZET_LAAD_VANAF = '2026-01-01';
const UNPAID_BATCH_FEED_LIMIT = 18;

interface AiSpendSummary {
  enabled: boolean;
  todayCents: number;
  monthCents: number;
  monthCapCents: number;
  branches: Array<{ branch: string; todayCents: number; monthCents: number }>;
  activeExperiments: number;
}

async function loadAiSpendSummary(supabase: ReturnType<typeof createServerClient>): Promise<AiSpendSummary> {
  try {
    const [{ data: setting }, { data: guards }, { count: activeExperiments }] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'ai_campaigns_enabled').maybeSingle(),
      supabase.from('ai_campaign_budget_guards').select('branch, spent_today_cents, spent_month_cents, monthly_budget_cents'),
      supabase.from('ai_campaign_experiments').select('id', { count: 'exact', head: true }).eq('phase', 'running'),
    ]);
    const branches = (guards || []).map(g => ({
      branch: g.branch as string,
      todayCents: (g.spent_today_cents as number) || 0,
      monthCents: (g.spent_month_cents as number) || 0,
    }));
    const todayCents = branches.reduce((s, g) => s + g.todayCents, 0);
    const monthCents = branches.reduce((s, g) => s + g.monthCents, 0);
    const monthCapCents = (guards || []).reduce((s, g) => s + ((g.monthly_budget_cents as number) || 0), 0);
    return {
      enabled: String(setting?.value || '').toLowerCase() === 'true',
      todayCents,
      monthCents,
      monthCapCents,
      branches,
      activeExperiments: activeExperiments || 0,
    };
  } catch {
    return { enabled: false, todayCents: 0, monthCents: 0, monthCapCents: 0, branches: [], activeExperiments: 0 };
  }
}

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
      .select(`*, ${adminCustomerLiveUnpaidEmbed}`)
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
      `id, branch, batch_size, total_price, price_per_appointment, status, is_paid, created_at, account_manager_id, ${adminCustomerLiveUnpaidEmbed}`,
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
    accountManagerName: string | null;
  };

  type UnpaidBatchDraft = Omit<UnpaidFeed, 'accountManagerName'> & { accountManagerId: string | null };

  type CustUnpaid = { name?: string; account_manager_id?: string | null; customer_targets?: unknown } | null;

  const unpaidLeadItems: UnpaidBatchDraft[] = batches
    .filter(
      b =>
        b.is_paid === false &&
        b.status !== 'completed' &&
        b.status !== 'cancelled',
    )
    .map(b => {
      const cust = b.customers as CustUnpaid;
      const batchAm = (b as { account_manager_id?: string | null }).account_manager_id;
      const custAm = cust?.account_manager_id;
      const accountManagerId =
        batchAm && String(batchAm).trim() ? String(batchAm) : custAm && String(custAm).trim() ? String(custAm) : null;
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
        accountManagerId,
      };
    });

  const unpaidApptItems: UnpaidBatchDraft[] = (apptBatchRows || [])
    .filter(b => b.status !== 'completed' && b.status !== 'cancelled')
    .map(b => {
      const cust = b.customers as CustUnpaid;
      const batchAm = (b as { account_manager_id?: string | null }).account_manager_id;
      const custAm = cust?.account_manager_id;
      const accountManagerId =
        batchAm && String(batchAm).trim() ? String(batchAm) : custAm && String(custAm).trim() ? String(custAm) : null;
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
        accountManagerId,
      };
    });

  const unpaidMerged = [...unpaidLeadItems, ...unpaidApptItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const unpaidSliced = unpaidMerged.slice(0, UNPAID_BATCH_FEED_LIMIT);
  const unpaidAmIds = [...new Set(unpaidSliced.map(u => u.accountManagerId).filter((id): id is string => !!id))];
  let amNameById: Record<string, string> = {};
  if (unpaidAmIds.length > 0) {
    const { data: amRows } = await supabase.from('admin_users').select('id, name').in('id', unpaidAmIds);
    for (const row of amRows || []) {
      if (row.id && row.name) amNameById[row.id] = row.name;
    }
  }
  const unpaidBatches: UnpaidFeed[] = unpaidSliced.map(({ accountManagerId, ...rest }) => ({
    ...rest,
    accountManagerName: accountManagerId ? amNameById[accountManagerId] ?? null : null,
  }));

  /* Alle geldcijfers op het dashboard gaan over de lopende kalendermaand
     (Nederlandse tijd): advertentiekosten, CPL, omzet en winst. Tot 30 okt
     2026 telden ze sinds 1 mei 2026 terwijl er "deze maand" bij stond. */
  const maandDag = `${amsterdamYmd(new Date()).slice(0, 7)}-01`;
  const MAAND_START_ISO = amsterdamWallTimeToUtc(maandDag, '00:00').toISOString();

  /* Omzet van deze maand: gefactureerd en betaald, op de dag van betalen, met
     losse facturen, creditnota's en externe facturen; zonder interne klanten
     en zonder afspraken (die tellen niet mee in omzet en winst, 4 nov 2026). Eén definitie met Winst en verlies, zie
     src/lib/omzetPerMaand.ts. Een fout mag het dashboard niet breken. */
  const omzetBron = await laadOmzetMetAm(supabase, OMZET_LAAD_VANAF).catch(err => {
    console.error('[live-stats] omzet laden', err instanceof Error ? err.message : err);
    return null;
  });
  const omzet = await (async () => {
    if (!omzetBron) throw new Error('omzet niet geladen');
    return { ...telOmzet(omzetBron.posten, maandDag, amsterdamYmd(new Date())), externOntbreekt: omzetBron.externOntbreekt };
  })().catch(err => {
    console.error('[live-stats] omzet', err instanceof Error ? err.message : err);
    return null;
  });

  /* ── Advertentiekosten: één definitie, zie src/lib/metaCpl.ts ──
     Alle spend van deze maand telt mee, behalve campagnes met het woord
     pakketadvies of energie in de titel. Gepagineerd opgehaald: één losse
     query wordt door Supabase stil op 1000 rijen afgekapt, en precies dat
     maakte de bruto CPL hier maandenlang ~60% te laag (6,64 om 16,70). */
  const spendFetch = await fetchSpendRowsSince(supabase, maandDag);
  const spendTotals = splitSpend(spendFetch.rows);
  const monthAdSpend = spendTotals.includedTotal;
  const cplWindowSpend = spendTotals.includedTotal;
  const metaCampaignPagesFetched = Math.ceil((spendFetch.rows.length || 1) / 1000);
  const metaCampaignTruncated = spendFetch.truncated;

  /* Noemer: alle echte leads van deze maand. Leads zonder
     campagne-attributie tellen mee (73% van de instroom komt via Zapier
     zonder campagne-id binnen); leads uit uitgesloten campagnes niet. */
  let leadsCountQuery = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .neq('bron', 'excel_import')
    .neq('bron', 'demo')
    .gte('created_at', MAAND_START_ISO);
  const leadExclusion = leadExclusionOrFilter(spendTotals.excludedCampaignIds);
  if (leadExclusion) leadsCountQuery = leadsCountQuery.or(leadExclusion);
  const { count: ourLeadsCount } = await leadsCountQuery;
  const totalOurLeads = ourLeadsCount || 0;

  const brutoCpl = totalOurLeads > 0 ? cplWindowSpend / totalOurLeads : 0;

  // ── Eff. CPL: spend voor verse Meta-leads ÷ uitdelingen van díé leads ──
  //
  // Definitie: "wat heeft een geleverde lead ons gemiddeld gekost". Alles in
  // hetzelfde venster als de lead-pool (deze maand):
  //   • teller   = Meta-spend in het venster (cplWindowSpend)
  //   • noemer   = alle toewijzingen van leads die in het venster zijn
  //                gegenereerd met Meta-attributie — ongeacht wanneer de
  //                toewijzing plaatsvond — minus goedgekeurde reclamaties.
  //   • bulk telt niet mee: source 'bulk_export' nooit, 'bulk_assign' alleen
  //     als de toewijzing aan een betaalde batch hangt (batch_id != null);
  //     losse bulk_assigns zijn bulkverkoop en horen bij bulk_revenue.
  //
  // Null-safe source-filter: oude assignments hebben source NULL
  // (= 'distribution' in de RPC's), die horen in de pool.
  const CPL_ASSIGN_SELECT_FILTERS = <T,>(q: T): T => {
    type Chainable = {
      gte(col: string, val: string): Chainable;
      not(col: string, op: string, val: unknown): Chainable;
      neq(col: string, val: string): Chainable;
      or(filter: string): Chainable;
    };
    let c = q as unknown as Chainable;
    c = c
      .gte('leads.created_at', MAAND_START_ISO)
      .neq('leads.bron', 'excel_import')
      .neq('leads.bron', 'demo')
      .or('source.is.null,source.not.in.("bulk_export","demo","mirror")')
      .or('source.is.null,source.neq.bulk_assign,batch_id.not.is.null');
    if (leadExclusion) {
      c = (c as unknown as { or(f: string, o: { foreignTable: string }): unknown }).or(
        leadExclusion,
        { foreignTable: 'leads' },
      ) as unknown as Chainable;
    }
    return c as unknown as T;
  };

  const { count: cplAssignCount } = await CPL_ASSIGN_SELECT_FILTERS(
    supabase
      .from('lead_assignments')
      .select('id, leads!inner(id)', { count: 'exact', head: true }),
  );
  const distributionAssignTotal = cplAssignCount || 0;

  // ── Goedgekeurde reclamaties: aftrek voor netto-leveringen ──
  // Alleen reclamaties waarvan de (lead, klant)-toewijzing daadwerkelijk in
  // de noemer-pool zit; een reclamatie op een bulk-verkochte of oudere lead
  // mag de distributie-noemer niet verlagen.
  const approvedRecs = await getApprovedReclamationStats(
    {
      leadCreatedSinceIso: MAAND_START_ISO,
      excludeBulkAndDemo: true,
    },
    supabase,
  );

  let approvedReclamationsInWindow = 0;
  if (approvedRecs.total > 0) {
    type PoolAssignRow = { lead_id: string; customer_id: string; source: string | null; batch_id: string | null };
    const recLeadIds = [...approvedRecs.leadIds];
    const poolAssignRows: PoolAssignRow[] = [];
    const REC_CHUNK = 500;
    for (let i = 0; i < recLeadIds.length; i += REC_CHUNK) {
      const chunk = recLeadIds.slice(i, i + REC_CHUNK);
      const { data } = await CPL_ASSIGN_SELECT_FILTERS(
        supabase
          .from('lead_assignments')
          .select('lead_id, customer_id, source, batch_id, leads!inner(id)'),
      ).in('lead_id', chunk);
      poolAssignRows.push(...((data || []) as unknown as PoolAssignRow[]));
    }
    approvedReclamationsInWindow = countApprovedReclamationsForAssignments(
      poolAssignRows,
      approvedRecs.approvedPairs,
    ).total;
  }

  const netDistributionAssignTotal = Math.max(0, distributionAssignTotal - approvedReclamationsInWindow);

  const avgAssignments =
    totalOurLeads > 0 && netDistributionAssignTotal > 0
      ? Math.round((netDistributionAssignTotal / totalOurLeads) * 100) / 100
      : 0;
  const effectieveCpl =
    netDistributionAssignTotal > 0
      ? Math.round((cplWindowSpend / netDistributionAssignTotal) * 100) / 100
      : 0;

  const totalRevenue = omzet?.totaal ?? 0;
  /* Winst op het dashboard: omzet min advertentiekosten (Meta, zonder de
     pakketadvies- en energiecampagnes). Personeel en AI staan in Winst en verlies. */
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
    // Centrale fallback-video uit app_settings (zie migration 121) zodat
    // ook AMs zonder eigen URL altijd een celebration video krijgen.
    const { data: defaultVideoRows } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'default_celebration_video_url',
        'default_celebration_video_start',
        'default_celebration_video_end',
      ]);
    const defaultMap = new Map<string, string>();
    for (const row of defaultVideoRows || []) {
      if (row?.key && typeof row.value === 'string') defaultMap.set(row.key, row.value);
    }
    const defaultUrl = defaultMap.get('default_celebration_video_url')?.trim() || null;
    const defaultStartRaw = defaultMap.get('default_celebration_video_start');
    const defaultEndRaw = defaultMap.get('default_celebration_video_end');
    const defaultStart = defaultStartRaw && /^\d+$/.test(defaultStartRaw) ? Number(defaultStartRaw) : null;
    const defaultEnd = defaultEndRaw && /^\d+$/.test(defaultEndRaw) ? Number(defaultEndRaw) : null;
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
      const hasOwnUrl = !!am?.celebration_video_url;
      recentPaidBatches.push({
        id: o.id,
        batchId: o.batch_id,
        customer: cb?.customers?.name || '-',
        branch: cb?.branch || '-',
        amount: Number(o.total_price) || 0,
        paidAt: o.paid_at,
        amId,
        amName: am?.name || null,
        celebrationVideoUrl: hasOwnUrl ? am!.celebration_video_url : defaultUrl,
        videoStart: hasOwnUrl ? am!.celebration_video_start : defaultStart,
        videoEnd: hasOwnUrl ? am!.celebration_video_end : defaultEnd,
      });
    }
  }

  /* Leaderboard: dezelfde betaalde omzet als hierboven, per accountmanager
     (src/lib/omzetPerAm.ts), met de uitsluitingen en handmatige regels van
     /admin/am-leaderboard. Zo telt het podium op tot de omzet van de maand. */
  const yearMonth = maandDag.slice(0, 7);
  let excludedBatchIds = new Set<string>();
  let manualLeaderboardLines: ManualLineRow[] = [];
  try {
    [excludedBatchIds, manualLeaderboardLines] = await Promise.all([
      loadLeaderboardExcludedBatchIds(supabase, yearMonth),
      loadLeaderboardManualLines(supabase, yearMonth),
    ]);
  } catch (e) {
    console.warn('[live-stats] leaderboard overrides niet geladen, zonder uitsluitingen:', e);
  }
  const perAm = omzetBron
    ? omzetPerAm(omzetBron.posten, { vanDag: maandDag, totDag: amsterdamYmd(new Date()) }, omzetBron.bronnen, excludedBatchIds)
    : new Map();
  const amRevenue = new Map<string, number>();
  const amBulkRevenue = new Map<string, number>();
  const amBatchCount = new Map<string, number>();
  for (const [amId, r] of perAm) {
    if (!amId) continue;
    amRevenue.set(amId, Math.round((r.totaal - r.bulk) * 100) / 100);
    amBulkRevenue.set(amId, r.bulk);
    amBatchCount.set(amId, r.batches);
  }
  for (const m of manualLeaderboardLines) {
    amRevenue.set(m.admin_user_id, Math.round(((amRevenue.get(m.admin_user_id) || 0) + (Number(m.amount_euro) || 0)) * 100) / 100);
    if (Number(m.counts_as_batch) === 1) amBatchCount.set(m.admin_user_id, (amBatchCount.get(m.admin_user_id) || 0) + 1);
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
  /* Omzet zonder (actieve) accountmanager, zoals een batch of factuur van
     iemand die geen accountmanager is. Stond nergens op het podium, waardoor
     het podium niet optelde tot de maandomzet. */
  const amIds = new Set((allAMs || []).map(am => am.id as string));
  let zonderAm = 0;
  for (const [amId, r] of perAm) if (!amId || !amIds.has(amId)) zonderAm += Number(r.totaal) || 0;
  const amLeaderboardZonderAm = Math.round(zonderAm * 100) / 100;

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
  /* De omzet in die cijfers (batchprijs bij aanmaken) vervangen we door de
     betaalde omzet, zodat "laatste 24 uur" dezelfde definitie heeft als de
     maandomzet. Winst = omzet min de advertentiekosten uit dezelfde functie. */
  const omzetTussen = (van: number, tot: number) =>
    omzetBron ? Math.round(omzetBron.posten.filter(p => { const t = Date.parse(p.moment); return t >= van && t < tot; }).reduce((s, p) => s + p.bedrag, 0) * 100) / 100 : null;
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
        if (key === 'day') {
          const nu = Date.now();
          const dag = omzetTussen(nu - 86_400_000, nu);
          const vorige = omzetTussen(nu - 2 * 86_400_000, nu - 86_400_000);
          const ps = periodStats[key];
          if (dag !== null && vorige !== null) {
            ps.revenue = dag;
            ps.prevRevenue = vorige;
            ps.profit = Math.round((dag - ps.adSpend) * 100) / 100;
            ps.prevProfit = Math.round((vorige - ps.prevAdSpend) * 100) / 100;
          }
        }
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
      cplWindowSpend: Math.round(cplWindowSpend * 100) / 100,
      brutoCpl: Math.round(brutoCpl * 100) / 100,
      effectieveCpl,
      avgAssignments,
      distributionAssignmentTotal: distributionAssignTotal,
      netDistributionAssignmentTotal: netDistributionAssignTotal,
      approvedReclamationsInWindow,
      omzetPerSoort: omzet?.perSoort ?? null,
      omzetFout: omzet === null,
      externeOmzetOntbreekt: omzet?.externOntbreekt ?? false,
      totalProfit: Math.round(totalProfit * 100) / 100,
    },
    aiSpend: await loadAiSpendSummary(supabase),
    recentPaidBatches,
    amLeaderboard,
    amLeaderboardZonderAm,
    /* Najaarsactie: de stand van de pot; een fout mag het dashboard niet breken. */
    actie: await laadActieSamenvatting(supabase).catch(err => {
      console.error('[live-stats] actie', err instanceof Error ? err.message : err);
      return null;
    }),
    timestamp: new Date().toISOString(),
    _liveStatsScope: {
      breakdownLookbackDays: BREAKDOWN_LOOKBACK_DAYS,
      breakdownMaxRows: BREAKDOWN_MAX_ROWS,
      provinceSampleRows: provinceSampleSize,
      branchSampleRows: branchSampleSize,
      provinceBranchCapped,
      spendStartDate: maandDag,
      metaCampaignPagesFetched,
      metaCampaignTruncated,
      batchesListLimit: BATCHES_LIST_LIMIT,
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
