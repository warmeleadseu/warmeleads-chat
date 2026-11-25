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
import { berekenBatchWinst } from '@/lib/batchWinst';
import { laadFacturenPerBatch, laadKlantenZonderKostendeel } from '@/lib/batchWinstLaden';
import { batchRegels, klantRegels } from '@/lib/dashboardBatchWinst';
import { telWinstdeling } from '@/lib/winstdeling';
import { laadWinstAfspraken, laadWinstdelingBijPosten, winstdeelVanBatch } from '@/lib/winstdelingLaden';
import { MIRROR_ASSIGNMENT_SOURCE } from '@/lib/masterPortalMirror';
import { telOmzet } from '@/lib/omzetPerMaand';
import { laadOmzetMetAm, OMZET_LADEN_VANAF } from '@/lib/omzetPerMaandLaden';
import { amsterdamYmd } from '@/lib/appointmentSlots';

/** Na zware wijzigingen: Supabase → Query Performance + advisors (indexes i.c.m. costs-vensters). */

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Geen toegang tot kostendata' }, { status: 403 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const today = amsterdamYmd(now);
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
        .order('id')
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
        .order('id')
        .range(offset, offset + PAGE - 1);
      if (!data?.length) break;
      rows.push(...(data as AssignRow[]));
      if (data.length < PAGE) break;
      offset += PAGE;
      if (p === COSTS_ASSIGN_MAX_PAGES - 1) truncated = true;
    }
    return { rows, truncated };
  }

  /** De echte advertentiekosten per lead (migratie 174), zoals in Winst en verlies. */
  async function fetchLeadKosten(): Promise<Map<string, number>> {
    const uit = new Map<string, number>();
    for (let p = 0; p < COSTS_LEADS_MAX_PAGES; p++) {
      const { data, error } = await supabase
        .from('lead_kosten')
        .select('lead_id, kosten')
        .gt('kosten', 0)
        .order('lead_id')
        .range(p * PAGE, p * PAGE + PAGE - 1);
      if (error) throw new Error(`leadkosten: ${error.message}`);
      for (const k of data ?? []) uit.set(k.lead_id as string, Number(k.kosten) || 0);
      if (!data || data.length < PAGE) break;
    }
    return uit;
  }

  /* ── Wave 1: fetch batches + lastSync + bulk-prijzen + paginated leads & assignments ── */
  const [batchesRes, lastSyncRes, leadBundle, assignBundle, leadKosten, zonderKostendeel, afspraken] = await Promise.all([
    supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, price_per_lead, total_price, status, created_at, is_paid, batch_kind, mollie_payment_id, leads_delivered_external, extern_bedrag_excl, customers(name)')
      .in('status', ['active', 'paused', 'completed'])
      .eq('is_paid', true)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase
      .from('meta_ad_spend')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single(),
    fetchLeadsBounded(),
    fetchAssignmentsBounded(),
    fetchLeadKosten(),
    laadKlantenZonderKostendeel(supabase),
    laadWinstAfspraken(supabase),
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

  /* ── Wave 2: alle spend sinds de boekhoudstart, gepagineerd ──
     Eén definitie voor de hele boekhouding, zie src/lib/metaCpl.ts. De oude
     aanpak (per 200 campagne-ids een query) kapte elke query stil op 1000
     rijen af én miste campagnes zonder attributed leads. */
  interface SpendRow { campaign_id: string; date: string; spend: string; leads_count: number }
  const spendFetch = await fetchSpendRowsSince(supabase, META_SPEND_START_DATE);
  const spendTotals = splitSpend(spendFetch.rows);
  const allSpendRows = spendTotals.rows as unknown as SpendRow[];
  const excludedCampaignIds = new Set(spendTotals.excludedCampaignIds);

  const leadBronById = new Map(allLeads.map(l => [l.id, l.bron]));

  /**
   * Bulk en demo/test: buiten Meta-CPL en buiten ad-kostentoewijzing.
   * `bulk_assign` telt alleen mee als de toewijzing aan een betaalde batch
   * hangt (echte levering); losse bulk_assigns zijn bulkverkoop.
   *
   * Let op het verschil met "Leads uitgedeeld" op het periodeoverzicht: die
   * tegel meet uitsluitend verse verdeling (zie src/lib/leadMetrics.ts), terwijl
   * deze pool meet wat er aan betaalde levering tegenover de advertentiekosten
   * staat. Een handmatige toewijzing aan een betaalde batch is wél omzet, maar
   * geen verse verdeling. Beide getallen horen dus te verschillen; ze zijn nu
   * alleen niet langer allebei vervuild met losse bulkverkoop.
   */
  const leadCampaignById = new Map(allLeads.map(l => [l.id, l.meta_campaign_id]));

  function isCplPoolAssignment(a: AssignRow): boolean {
    const src = a.source || 'distribution';
    if (src === 'bulk_export' || src === 'demo') return false;
    if (src === 'bulk_assign' && !a.batch_id) return false;
    /* Masterportaal-kopieën zijn geen levering: ze leveren geen omzet en horen
       dus ook niet in de noemer van de effectieve CPL, die ze kunstmatig
       verlaagde. `distribution.ts` negeert ze om dezelfde reden. */
    if (src === MIRROR_ASSIGNMENT_SOURCE) return false;
    const bron = leadBronById.get(a.lead_id);
    if (bron === 'demo') return false;
    const campagne = leadCampaignById.get(a.lead_id);
    if (campagne && excludedCampaignIds.has(campagne)) return false;
    return true;
  }

  /* Assignments die bij de CPL horen: alle leveringen van de leads die in de
     periode binnenkwamen, ongeacht wanneer geleverd. Dezelfde definitie als de
     liveslide; voorheen telde hier "geleverd in de periode", ook van oudere
     leads, en kwam de verdeelfactor anders uit (1,60x tegen 1,69x). */
  const cplLeadIdsInPeriod = new Set(
    allLeads
      .filter(l => l.created_at >= periodStartIso && (!l.meta_campaign_id || !excludedCampaignIds.has(l.meta_campaign_id)))
      .map(l => l.id),
  );
  const assignmentsForCpl = allAssignments.filter(a => cplLeadIdsInPeriod.has(a.lead_id) && isCplPoolAssignment(a));

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

  /* ── Totalen ──
     Omzet: dezelfde definitie als de liveslide en Winst en verlies
     (src/lib/omzetPerMaand.ts): betaald, op de dag van betalen, met losse
     facturen, creditnota's en externe facturen, zonder interne klanten en
     afspraken. Winst: min de advertentiekosten en min wat er naar een derde
     gaat (src/lib/winstdeling.ts). */
  const omzetBron = await laadOmzetMetAm(supabase, OMZET_LADEN_VANAF);
  const delingen = await laadWinstdelingBijPosten(supabase, omzetBron.posten);
  const omzet = telOmzet(omzetBron.posten, periodStartDateStr, today);
  const winstdeling = telWinstdeling(delingen, periodStartDateStr, today);
  const totalRevenue = omzet.totaal;
  const totalProfit = totalRevenue - totalAdSpend - winstdeling;
  const roi = totalAdSpend > 0 ? Math.round((totalProfit / totalAdSpend) * 100) : 0;

  /* ── Winst per batch en marge per klant, over de leveringen in de periode
     (src/lib/dashboardBatchWinst.ts) ── */
  type BatchRij = {
    id: string; customer_id: string; branch: string; batch_size: number; price_per_lead: number | null; total_price: number | string | null;
    status: string; created_at: string; is_paid: boolean | null; batch_kind: string | null; mollie_payment_id: string | null;
    leads_delivered_external: number | null; extern_bedrag_excl: number | string | null; customers: { name: string } | { name: string }[] | null;
  };
  const batchRijen = allBatches as unknown as BatchRij[];
  const facturenPerBatch = await laadFacturenPerBatch(supabase, batchRijen.map(b => b.id));
  const naamVan = (k: BatchRij['customers']) => (Array.isArray(k) ? k[0]?.name : k?.name) || 'Onbekend';
  const batchFinancials = batchRegels({
    batches: batchRijen.map(b => ({
      id: b.id, customer_id: b.customer_id, klant: naamVan(b.customers), branch: b.branch, batch_kind: b.batch_kind, batch_size: b.batch_size,
      status: b.status, price_per_lead: b.price_per_lead, aangemaakt: amsterdamYmd(new Date(b.created_at)),
      omzet: berekenBatchWinst(b, facturenPerBatch.get(b.id) ?? [], null).omzet,
      winstdeel: winstdeelVanBatch(afspraken, b),
    })),
    leveringen: allAssignments,
    kosten: leadKosten,
    zonderKostendeel,
    periodeStartIso: periodStartIso,
    periodeStartDag: periodStartDateStr,
  });

  const inPeriode = (dag: string) => dag >= periodStartDateStr && dag <= today;
  const losPosten = omzetBron.posten.filter(p => !p.batch_id && inPeriode(p.dag));
  const losDelingen = delingen.filter(p => !p.batch_id && inPeriode(p.dag));
  const klantNamen = new Map(batchRijen.map(b => [b.customer_id, naamVan(b.customers)]));
  const ontbrekend = [...new Set(losPosten.map(p => p.customer_id).filter((id): id is string => !!id && !klantNamen.has(id)))];
  if (ontbrekend.length > 0) {
    const { data } = await supabase.from('customers').select('id, name').in('id', ontbrekend);
    for (const k of data ?? []) klantNamen.set(k.id as string, k.name as string);
  }
  const customerMargins = klantRegels(
    batchFinancials,
    [
      ...losPosten.map(p => ({ customer_id: p.customer_id, bedrag: p.bedrag, winstdeling: 0 })),
      ...losDelingen.map(p => ({ customer_id: p.customer_id, bedrag: 0, winstdeling: p.bedrag })),
    ],
    id => klantNamen.get(id) ?? 'Onbekend',
  );

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
    batchRevenue: omzet.perSoort.leads,
    bulkRevenue: omzet.perSoort.bulk,
    omzetPerSoort: omzet.perSoort,
    winstdeling,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalAdSpend * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    roi,
    leadsWithCost: totalOurLeads,
    uniqueAssignedLeads,
    totalAssignments,
    globalStartDate,
    branchCosts,
    customerMargins,
    batchFinancials,
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
      batchesCappedAt: 1000,
      note:
        'CPL en ad-kosten: alleen distributie-toewijzingen (geen bulk_export, geen demo). Leads: geen excel_import of demo. Effectieve CPL trekt goedgekeurde reclamaties af van de toewijzings-noemer (spend telt altijd mee, gereclameerde lead niet als netto-levering). Lookback begrensd; oude data kan ontbreken.',
    },
  });
}
