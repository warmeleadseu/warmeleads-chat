import { NextRequest, NextResponse } from 'next/server';
import {
  META_SPEND_START_DATE,
  META_SPEND_START_ISO,
  fetchSpendRowsSince,
  splitSpend,
  clampToSpendStart,
} from '@/lib/metaCpl';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { getPeriodStart, parseDashboardPeriod } from '@/lib/adminDashboardPeriod';
import {
  getApprovedReclamationStats,
  countApprovedReclamationsForAssignments,
} from '@/lib/reclamationStats';
import { batchRevenueForCosts } from '@/lib/batchRevenue';

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

  /* Alles vóór de boekhoudstart (1 mei 2026) telt nergens in mee, dus ophalen
     hoeft ook niet verder terug. De latere van de twee datums wint. */
  const costsSinceIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - COSTS_LOOKBACK_DAYS);
    const iso = d.toISOString();
    return iso > META_SPEND_START_ISO ? iso : META_SPEND_START_ISO;
  })();

  interface LeadRow {
    id: string;
    branch: string;
    bron: string;
    meta_campaign_id: string | null;
    wervingsdatum: string | null;
    lead_cost: number | null;
    created_at: string;
  }
  interface AssignRow {
    id: string;
    lead_id: string;
    customer_id: string;
    batch_id: string | null;
    assigned_at: string;
    source: string;
  }

  async function fetchLeadsBounded(): Promise<{ rows: LeadRow[]; truncated: boolean }> {
    const rows: LeadRow[] = [];
    let truncated = false;
    let offset = 0;
    for (let p = 0; p < COSTS_LEADS_MAX_PAGES; p++) {
      const { data } = await supabase
        .from('leads')
        .select('id, branch, bron, meta_campaign_id, wervingsdatum, lead_cost, created_at')
        .neq('bron', 'excel_import')
        .neq('bron', 'demo')
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
        .select('id, lead_id, customer_id, batch_id, assigned_at, source')
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

  /* ── Wave 1: fetch batches + lastSync + bulk-prijzen + paginated leads & assignments ── */
  const [batchesRes, lastSyncRes, bulkCustRes, leadBundle, assignBundle] = await Promise.all([
    supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, leads_delivered, price_per_lead, total_price, status, leads_per_week, created_at, is_paid, batch_kind, customers(name)')
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
    supabase
      .from('customers')
      .select('id, name, bulk_price_per_lead')
      .not('bulk_price_per_lead', 'is', null),
    fetchLeadsBounded(),
    fetchAssignmentsBounded(),
  ]);

  const allLeads = leadBundle.rows;
  const allAssignments = assignBundle.rows;
  const leadsTruncated = leadBundle.truncated;
  const assignmentsTruncated = assignBundle.truncated;

  const period = parseDashboardPeriod(request.nextUrl.searchParams.get('period'));
  const periodStart = getPeriodStart(period);
  /* Boekhouding begint op 1 mei 2026: een jaar- of kwartaalvenster dat eerder
     begint, telt pas vanaf die datum. Geldt voor spend, leads én uitdelingen,
     zodat teller en noemer altijd over hetzelfde venster gaan. */
  const periodStartIso =
    periodStart.toISOString() < META_SPEND_START_ISO ? META_SPEND_START_ISO : periodStart.toISOString();
  const periodStartDateStr = clampToSpendStart(periodStartIso);

  const assignmentsInPeriod = allAssignments.filter(a => a.assigned_at >= periodStartIso);

  const leadBronById = new Map(allLeads.map(l => [l.id, l.bron]));

  /**
   * Bulk en demo/test: buiten Meta-CPL en buiten ad-kostentoewijzing.
   * `bulk_assign` telt alleen mee als de toewijzing aan een betaalde batch
   * hangt (echte levering); losse bulk_assigns zijn bulkverkoop.
   */
  const leadCampaignById = new Map(allLeads.map(l => [l.id, l.meta_campaign_id]));

  function isCplPoolAssignment(a: AssignRow): boolean {
    const src = a.source || 'distribution';
    if (src === 'bulk_export' || src === 'demo') return false;
    if (src === 'bulk_assign' && !a.batch_id) return false;
    const bron = leadBronById.get(a.lead_id);
    if (bron === 'demo') return false;
    const campagne = leadCampaignById.get(a.lead_id);
    if (campagne && excludedCampaignIds.has(campagne)) return false;
    return true;
  }

  const assignmentsForCpl = assignmentsInPeriod.filter(isCplPoolAssignment);

  /* Noemer voor de CPL: alle echte leads in de periode. Leads zonder
     campagne-attributie tellen mee (73% van de instroom); leads uit
     uitgesloten pakketadvies/energie-campagnes niet. allLeads is al
     gefilterd op bron != excel_import/demo. */
  const cplLeadsInPeriod = allLeads.filter(
    l =>
      l.created_at >= periodStartIso &&
      (!l.meta_campaign_id || !excludedCampaignIds.has(l.meta_campaign_id)),
  );
  const leadsWithMetaInPeriod = cplLeadsInPeriod.filter(
    (l): l is LeadRow & { meta_campaign_id: string } => !!l.meta_campaign_id,
  );

  const allBatches = batchesRes.data || [];
  const lastSync = lastSyncRes.data;
  const bulkCustomers = bulkCustRes.data || [];

  const batchById = new Map(allBatches.map((b: { id: string }) => [b.id, b]));
  const leadIdToBranch = new Map(allLeads.map(l => [l.id, l.branch]));

  function branchForAssignment(a: AssignRow): string | null {
    if (a.batch_id) {
      const bch = batchById.get(a.batch_id) as { branch?: string } | undefined;
      return bch?.branch ?? null;
    }
    return leadIdToBranch.get(a.lead_id) ?? null;
  }

  // ── Batch start dates per branch ──
  const branchStartDate = new Map<string, string>();
  for (const b of allBatches) {
    const batchDate = b.created_at ? b.created_at.split('T')[0] : today;
    const existing = branchStartDate.get(b.branch);
    if (!existing || batchDate < existing) branchStartDate.set(b.branch, batchDate);
  }
  const globalStartDate = branchStartDate.size > 0 ? [...branchStartDate.values()].sort()[0] : today;

  // ── Campaign mapping from all tracked leads in sample (nodig voor spend-fetch) ──
  const leadsWithCampaignAll = allLeads.filter(
    (l): l is LeadRow & { meta_campaign_id: string } => !!l.meta_campaign_id && l.bron !== 'demo',
  );
  const campaignBranchMap = new Map<string, string>();
  for (const l of leadsWithCampaignAll) {
    if (!campaignBranchMap.has(l.meta_campaign_id)) {
      campaignBranchMap.set(l.meta_campaign_id, l.branch);
    }
  }
  const totalOurLeads = cplLeadsInPeriod.length;

  /* ── Wave 2: alle spend sinds de boekhoudstart, gepagineerd ──
     Eén definitie voor de hele boekhouding, zie src/lib/metaCpl.ts. De oude
     aanpak (per 200 campagne-ids een query) kapte elke query stil op 1000
     rijen af én miste campagnes zonder attributed leads. */
  interface SpendRow { campaign_id: string; date: string; spend: string; leads_count: number }
  const spendFetch = await fetchSpendRowsSince(supabase, META_SPEND_START_DATE);
  const spendTotals = splitSpend(spendFetch.rows);
  const allSpendRows = spendTotals.rows as unknown as SpendRow[];
  const excludedCampaignIds = new Set(spendTotals.excludedCampaignIds);

  /* ── Compute all aggregates (pure CPU, no more DB calls) ── */

  let totalAdSpend = 0;
  let rollingWeekSpend = 0;
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const row of allSpendRows) {
    const spend = parseFloat(row.spend) || 0;
    if (row.date >= periodStartDateStr && row.date <= today) {
      totalAdSpend += spend;
    }
    if (row.date >= weekAgo) rollingWeekSpend += spend;
  }

  const brutoCpl = totalOurLeads > 0
    ? Math.round((totalAdSpend / totalOurLeads) * 100) / 100
    : null;

  /** Alleen distributie-/batch-toewijzingen (geen bulk-export, geen demo). */
  const totalAssignmentCount = assignmentsForCpl.length;
  const uniqueAssignedLeads = new Set(assignmentsForCpl.map(a => a.lead_id)).size;
  const totalAssignments = totalAssignmentCount;

  // ── Goedgekeurde reclamaties: aftrek voor netto-leveringen ──
  //
  // Bruto CPL telt alle binnenkomende leads (ongewijzigd: spend / leads).
  // Eff. CPL trekt elke goedgekeurde reclamatie af van de assignment-pool:
  // de Meta-spend voor die lead is wel gemaakt, maar de levering telt niet
  // als omzet — we leveren een gratis vervanglead.
  //
  // We matchen op (lead_id, customer_id) zodat een lead die naar méérdere
  // klanten is uitgedeeld maar door één klant gereclameerd is, slechts
  // één keer wordt afgetrokken.
  const approvedRecs = await getApprovedReclamationStats(
    { excludeBulkAndDemo: true },
    supabase,
  );
  const recAgg = countApprovedReclamationsForAssignments(
    assignmentsForCpl,
    approvedRecs.approvedPairs,
    branchForAssignment,
  );
  const approvedReclamationsInPeriod = recAgg.total;
  const netAssignmentCount = Math.max(0, totalAssignmentCount - approvedReclamationsInPeriod);

  /** Hoe vaak gemiddeld uitgedeeld per geworven Meta-lead in deze periode (netto, excl. goedgekeurde reclamaties). */
  const avgAssignments =
    totalOurLeads > 0 && netAssignmentCount > 0
      ? Math.round((netAssignmentCount / totalOurLeads) * 100) / 100
      : 0;

  /** Advertentiekosten per relevante toewijzing (bulk/demo vallen buiten de pool, goedgekeurde reclamaties tellen niet als levering). */
  const costPerAssignment = netAssignmentCount > 0 ? totalAdSpend / netAssignmentCount : 0;

  const effectieveCpl =
    netAssignmentCount > 0
      ? Math.round((totalAdSpend / netAssignmentCount) * 100) / 100
      : null;

  // ── Branch-level costs ──
  const branchLeads = new Map<string, number>();
  const branchSpend = new Map<string, number>();

  for (const l of leadsWithMetaInPeriod) {
    branchLeads.set(l.branch, (branchLeads.get(l.branch) || 0) + 1);
  }

  for (const row of allSpendRows) {
    const branch = campaignBranchMap.get(row.campaign_id);
    if (!branch) continue; // spend zonder herleidbare branche telt wel in de totalen, niet in deze tabel
    if (row.date < periodStartDateStr || row.date > today) continue;
    branchSpend.set(branch, (branchSpend.get(branch) || 0) + (parseFloat(row.spend) || 0));
  }

  const branchAssignmentsCount = new Map<string, number>();
  for (const a of assignmentsForCpl) {
    const br = branchForAssignment(a);
    if (!br) continue;
    branchAssignmentsCount.set(br, (branchAssignmentsCount.get(br) || 0) + 1);
  }

  const branchCosts: Record<string, {
    spend: number;
    count: number;
    avgCpl: number;
    effectieveCpl: number;
    assignments: number;
    netAssignments: number;
    approvedReclamations: number;
  }> = {};
  for (const [branch, count] of branchLeads) {
    const spend = branchSpend.get(branch) || 0;
    const avgCpl = count > 0 ? Math.round((spend / count) * 100) / 100 : 0;
    const branchTot = branchAssignmentsCount.get(branch) || 0;
    const branchRec = recAgg.byBranch.get(branch) || 0;
    const netBr = Math.max(0, branchTot - branchRec);
    const effectieveBr =
      netBr > 0 ? Math.round((spend / netBr) * 100) / 100 : avgCpl;
    branchCosts[branch] = {
      spend: Math.round(spend * 100) / 100,
      count,
      avgCpl,
      effectieveCpl: effectieveBr,
      assignments: branchTot,
      netAssignments: netBr,
      approvedReclamations: branchRec,
    };
  }

  // ── Batch-level financials ──
  interface BatchFinancial {
    id: string; customer: string; branch: string; batchSize: number; delivered: number;
    pricePerLead: number; status: string; revenue: number; cost: number; profit: number;
    marginPct: number; leadsWithCost: number; startDate: string;
  }

  const batchFinancials: BatchFinancial[] = [];
  const batchAssignments = new Map<string, { lead_ids: string[] }>();
  for (const a of assignmentsForCpl) {
    if (!a.batch_id) continue;
    if (!batchAssignments.has(a.batch_id)) batchAssignments.set(a.batch_id, { lead_ids: [] });
    batchAssignments.get(a.batch_id)!.lead_ids.push(a.lead_id);
  }

  for (const b of allBatches) {
    const ba = batchAssignments.get(b.id);
    const n = ba?.lead_ids.length ?? 0;
    if (n === 0) continue;

    // Reguliere batches betalen per geleverde lead → revenue schaalt met n.
    // Niche-onderzoeksbatches betalen één eenmalig pakketbedrag (`total_price`)
    // bij bestelling: elke extra geleverde lead voegt geen extra omzet toe, en
    // het pakket telt alleen mee in de periode waarin de batch is aangemaakt
    // (anders dubbeltelling in elke latere maandweergave met leveringen).
    const oneTimeCountsInPeriod = b.created_at ? b.created_at >= periodStartIso : true;
    const revenue = batchRevenueForCosts(
      b as { batch_kind?: string; price_per_lead?: number | null; total_price?: number | null },
      n,
      oneTimeCountsInPeriod,
    );
    if (revenue <= 0) continue;

    const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
    const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
    const startDate = b.created_at ? b.created_at.split('T')[0] : today;

    let cost = 0;
    let leadsWithCost = 0;
    if (ba) {
      for (const _lid of ba.lead_ids) {
        cost += costPerAssignment;
        leadsWithCost++;
      }
    }

    const profit = revenue - cost;
    const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    batchFinancials.push({
      id: b.id,
      customer: custName,
      branch: b.branch,
      batchSize: b.batch_size,
      delivered: n,
      pricePerLead: b.price_per_lead,
      status: b.status,
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      marginPct,
      leadsWithCost,
      startDate,
    });
  }

  // ── Customer margins: batch (met ad-kosten uit CPL-pool) vs bulk (omzet apart, geen Meta-ad-kosten) ──
  const bulkPriceMap = new Map<string, { price: number; name: string }>();
  for (const c of bulkCustomers) {
    bulkPriceMap.set(c.id, { price: Number(c.bulk_price_per_lead), name: c.name });
  }

  const customerMargins: Record<string, { name: string; revenue: number; cost: number; margin: number; leads: number; marginPct: number }> = {};
  let batchRevenue = 0;
  let bulkRevenue = 0;
  const bulkByCustomer: Record<string, { name: string; count: number; revenue: number }> = {};

  for (const a of assignmentsInPeriod) {
    const src = a.source || 'distribution';
    if (src === 'demo') continue;

    if (src === 'bulk_export') {
      const bp = bulkPriceMap.get(a.customer_id);
      if (!bp) continue;
      if (!customerMargins[a.customer_id]) {
        customerMargins[a.customer_id] = { name: bp.name, revenue: 0, cost: 0, margin: 0, leads: 0, marginPct: 0 };
      }
      const cm = customerMargins[a.customer_id];
      cm.revenue += bp.price;
      cm.leads += 1;
      bulkRevenue += bp.price;
      if (!bulkByCustomer[a.customer_id]) bulkByCustomer[a.customer_id] = { name: bp.name, count: 0, revenue: 0 };
      bulkByCustomer[a.customer_id].count++;
      bulkByCustomer[a.customer_id].revenue += bp.price;
      continue;
    }

    if (a.batch_id) {
      const b = batchById.get(a.batch_id) as {
        price_per_lead?: number;
        total_price?: number;
        batch_kind?: string;
        customers?: unknown;
        customer_id: string;
      } | undefined;
      if (!b) continue;
      if (leadBronById.get(a.lead_id) === 'demo') continue;
      const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
      const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
      if (!customerMargins[b.customer_id]) {
        customerMargins[b.customer_id] = { name: custName, revenue: 0, cost: 0, margin: 0, leads: 0, marginPct: 0 };
      }
      const cm = customerMargins[b.customer_id];

      // Per assignment: lead-count + advertentiekosten altijd doortellen.
      // Revenue echter alleen voor reguliere lead-batches (per geleverde lead).
      // Niche-onderzoek wordt eenmalig afgerekend → revenue zit in `total_price`
      // en wordt na deze loop één keer per batch aan de omzet toegevoegd.
      cm.leads += 1;
      if (isCplPoolAssignment(a)) cm.cost += costPerAssignment;
      if (b.batch_kind !== 'niche_research' && b.price_per_lead) {
        cm.revenue += Number(b.price_per_lead);
        batchRevenue += Number(b.price_per_lead);
      }
      continue;
    }

    const bp = bulkPriceMap.get(a.customer_id);
    if (!bp) continue;
    if (!customerMargins[a.customer_id]) {
      customerMargins[a.customer_id] = { name: bp.name, revenue: 0, cost: 0, margin: 0, leads: 0, marginPct: 0 };
    }
    const cm = customerMargins[a.customer_id];
    cm.revenue += bp.price;
    cm.leads += 1;
    bulkRevenue += bp.price;
    if (!bulkByCustomer[a.customer_id]) bulkByCustomer[a.customer_id] = { name: bp.name, count: 0, revenue: 0 };
    bulkByCustomer[a.customer_id].count++;
    bulkByCustomer[a.customer_id].revenue += bp.price;
  }

  // Niche-onderzoeksbatches: eenmalige `total_price` als revenue voor batches
  // die in deze periode zijn besteld (i.p.v. per geleverde lead schalen).
  // Zonder deze tak telde elke binnenkomende lead in de batch nogmaals
  // €1.000 als omzet — terwijl de klant maar één keer betaalt.
  for (const b of allBatches) {
    if ((b as { batch_kind?: string }).batch_kind !== 'niche_research') continue;
    if (!b.total_price) continue;
    if (!b.created_at || b.created_at < periodStartIso) continue;
    const cust = b.customers as unknown as { name: string } | { name: string }[] | null;
    const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name || 'Onbekend';
    if (!customerMargins[b.customer_id]) {
      customerMargins[b.customer_id] = { name: custName, revenue: 0, cost: 0, margin: 0, leads: 0, marginPct: 0 };
    }
    const cm = customerMargins[b.customer_id];
    cm.revenue += Number(b.total_price);
    batchRevenue += Number(b.total_price);
  }

  for (const cm of Object.values(customerMargins)) {
    cm.margin = Math.round((cm.revenue - cm.cost) * 100) / 100;
    cm.marginPct = cm.revenue > 0 ? Math.round(((cm.revenue - cm.cost) / cm.revenue) * 100) : 0;
  }

  // ── Totals ──
  const totalRevenue = batchRevenue + bulkRevenue;
  const totalProfit = totalRevenue - totalAdSpend;
  const roi = totalAdSpend > 0 ? Math.round(((totalRevenue - totalAdSpend) / totalAdSpend) * 100) : 0;

  // ── Daily trend (binnen periode, max. ~45 dagen voor leesbaarheid) ──
  const trendCutoff = (() => {
    const d = new Date(periodStart);
    const cap = new Date(now);
    cap.setDate(cap.getDate() - 45);
    return d > cap ? d.toISOString().split('T')[0] : cap.toISOString().split('T')[0];
  })();
  const dailyTrend: Record<string, { spend: number; leads: number }> = {};
  for (const row of allSpendRows) {
    if (row.date < trendCutoff || row.date > today) continue;
    if (row.date < periodStartDateStr) continue;
    if (!dailyTrend[row.date]) dailyTrend[row.date] = { spend: 0, leads: 0 };
    dailyTrend[row.date].spend += parseFloat(row.spend) || 0;
    dailyTrend[row.date].leads += row.leads_count || 0;
  }

  console.info('[admin/costs]', {
    computeMs: Date.now() - t0,
    period,
    periodStartDateStr,
    leadsRows: allLeads.length,
    assignRows: allAssignments.length,
    leadsTruncated,
    assignmentsTruncated,
  });

  const periodSpendRounded = Math.round(totalAdSpend * 100) / 100;
  const rollingWeekSpendRounded = Math.round(rollingWeekSpend * 100) / 100;

  return NextResponse.json({
    period,
    periodStart: periodStartDateStr,
    periodSpend: periodSpendRounded,
    rollingWeekSpend: rollingWeekSpendRounded,
    weekSpend: rollingWeekSpendRounded,
    monthSpend: periodSpendRounded,
    totalSpend: periodSpendRounded,
    monthBrutoCpl: brutoCpl,
    effectieveCpl,
    avgAssignments,
    approvedReclamations: approvedReclamationsInPeriod,
    netAssignments: netAssignmentCount,
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
      period,
      periodStart: periodStartDateStr,
      lookbackDays: COSTS_LOOKBACK_DAYS,
      leadsSampled: allLeads.length,
      assignmentsSampled: allAssignments.length,
      leadsTruncated,
      assignmentsTruncated,
      maxLeadPages: COSTS_LEADS_MAX_PAGES,
      maxAssignmentPages: COSTS_ASSIGN_MAX_PAGES,
      batchesCappedAt: 2500,
      note:
        'CPL en ad-kosten: alleen distributie-toewijzingen (geen bulk_export, geen demo). Leads: geen excel_import of demo. Effectieve CPL trekt goedgekeurde reclamaties af van de toewijzings-noemer (spend telt altijd mee, gereclameerde lead niet als netto-levering). Lookback begrensd; oude data kan ontbreken.',
    },
  });
}
