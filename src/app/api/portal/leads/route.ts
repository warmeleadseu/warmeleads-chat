import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized, logImpersonatedWrite } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import {
  agentMayAccessAssignment,
  applyPortalAgentAssignmentScope,
  buildPortalAgentLeadScope,
  type PortalAgentLeadScope,
} from '@/lib/portalAgentLeadScope';
import { repairDemoAssignmentsIfNeeded } from '@/lib/demoPortalLeads';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';
import { buildPhoneSearchIlikeClauses, sanitizePostgrestIlike } from '@/lib/phoneSearch';
import { isValidLeadStatus } from '@/lib/leadStatuses';
import {
  matchesPostcodeArea,
  parseMaxDistanceKm,
  parsePostcodeArea,
  parseProvinceList,
} from '@/lib/portalLeadGeoFilters';
import {
  applyCustomDistanceOrigin,
  enrichPortalLeadDistances,
  resolvePortalGeoFilterContext,
  type PortalRadiusTarget,
} from '@/lib/portalDistanceOrigin';

const PAGE_SIZE = 1000;
const IN_CHUNK = 500;
/** Hard cap on rows read via paginateQuery per customer request (DB safety). */
const PORTAL_PAGINATE_MAX_ROWS = 25_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery<T>(query: any, maxRows = PORTAL_PAGINATE_MAX_ROWS): Promise<{ rows: T[]; truncated: boolean }> {
  const all: T[] = [];
  let offset = 0;
  let truncated = false;
  while (all.length < maxRows) {
    const room = maxRows - all.length;
    const take = Math.min(PAGE_SIZE, room);
    const { data } = await query.range(offset, offset + take - 1);
    if (!data?.length) break;
    all.push(...(data as T[]));
    if (data.length < take) break;
    offset += data.length;
    if (all.length >= maxRows) {
      truncated = true;
      break;
    }
  }
  return { rows: all, truncated };
}

async function attachReclamationFieldsToLeads(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leads: Record<string, unknown>[],
) {
  const ids = leads.map(l => l.id as string).filter(Boolean);
  if (ids.length === 0) return;
  const recByLead: Record<string, { status: string; reason: string }> = {};
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    const { data } = await supabase
      .from('lead_reclamations')
      .select('lead_id, status, reason')
      .eq('customer_id', customerId)
      .in('lead_id', chunk);
    for (const row of data || []) {
      recByLead[row.lead_id as string] = { status: row.status as string, reason: row.reason as string };
    }
  }
  for (const lead of leads) {
    const r = recByLead[lead.id as string];
    if (r) {
      lead.reclamation_status = r.status;
      lead.reclamation_reason = r.reason;
    }
  }
}

interface AssignmentMeta {
  assignment_id: string;
  assigned_at: string;
  distance_km: number | null;
  status: string | null;
  notities: string | null;
  portal_user_id: string | null;
  portal_user_name: string | null;
}

async function getCustomerDemoInfo(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<{ demoMode: boolean; branches: string[] }> {
  const { data } = await supabase
    .from('customers')
    .select('demo_mode, branches, signup_source')
    .eq('id', customerId)
    .single();
  const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, customerId);
  const demoMode = shouldUseDemoPortalExperience({
    signup_source: data?.signup_source,
    demo_mode: data?.demo_mode,
    hasPaidCustomerBatch,
  });
  return { demoMode, branches: data?.branches ?? [] };
}

async function getCustomerLeadData(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leadSource: 'all' | 'fresh' | 'bulk' = 'all',
  demoMode = false,
  statusFilter?: string | null,
  agentFilter?: PortalAgentLeadScope | null,
  customerBranches: string[] = [],
): Promise<{ ids: string[]; metaMap: Record<string, AssignmentMeta>; bulkCount: number; partial: boolean; maxPaginateRows: number }> {
  const ids = new Set<string>();
  const metaMap: Record<string, AssignmentMeta> = {};
  let partial = false;
  const selectFields = 'id, lead_id, assigned_at, distance_km, status, notities, portal_user_id';

  type AssignRow = {
    id: string;
    lead_id: string;
    assigned_at: string;
    distance_km: number | null;
    status: string | null;
    notities: string | null;
    portal_user_id: string | null;
  };
  const pushRow = (a: AssignRow) => {
    ids.add(a.lead_id);
    if (!metaMap[a.lead_id]) {
      metaMap[a.lead_id] = {
        assignment_id: a.id,
        assigned_at: a.assigned_at,
        distance_km: a.distance_km,
        status: a.status,
        notities: a.notities,
        portal_user_id: a.portal_user_id,
        portal_user_name: null,
      };
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyAgentScope = (q: any) => applyPortalAgentAssignmentScope(q, agentFilter);

  if (demoMode) {
    let q = supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'demo').order('assigned_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    q = applyAgentScope(q);
    let demoRes = await paginateQuery<AssignRow>(q);
    partial ||= demoRes.truncated;
    let demoLeads = demoRes.rows;

    // Re-seed / repair demo assignments when none visible with status=all (empty seed, branch mismatch, etc.)
    if (demoLeads.length === 0 && (!statusFilter || statusFilter === 'all')) {
      await repairDemoAssignmentsIfNeeded(supabase, customerId, customerBranches);
      let retryQ = supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'demo').order('assigned_at', { ascending: false });
      retryQ = applyAgentScope(retryQ);
      const retryRes = await paginateQuery<AssignRow>(retryQ);
      partial ||= retryRes.truncated;
      demoLeads = retryRes.rows;
    }

    demoLeads.forEach(pushRow);
    return { ids: Array.from(ids), metaMap, bulkCount: 0, partial, maxPaginateRows: PORTAL_PAGINATE_MAX_ROWS };
  }

  if (leadSource !== 'bulk' && (!agentFilter || agentFilter.viewAll)) {
    let directQuery = supabase.from('leads').select('id').eq('customer_id', customerId);
    if (statusFilter && statusFilter !== 'all') directQuery = directQuery.eq('status', statusFilter);
    const directRes = await paginateQuery<{ id: string }>(directQuery);
    partial ||= directRes.truncated;
    directRes.rows.forEach(l => ids.add(l.id));
  }

  if (leadSource === 'bulk') {
    let q = supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'bulk_export').order('assigned_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    q = applyAgentScope(q);
    const bulkRes = await paginateQuery<AssignRow>(q);
    partial ||= bulkRes.truncated;
    bulkRes.rows.forEach(pushRow);
  } else {
    let assignQuery = supabase
      .from('lead_assignments')
      .select(selectFields)
      .eq('customer_id', customerId)
      .neq('source', 'demo')
      .order('assigned_at', { ascending: false });
    if (leadSource === 'fresh') assignQuery = assignQuery.neq('source', 'bulk_export');
    if (statusFilter && statusFilter !== 'all') assignQuery = assignQuery.eq('status', statusFilter);
    assignQuery = applyAgentScope(assignQuery);
    const assignedRes = await paginateQuery<AssignRow>(assignQuery);
    partial ||= assignedRes.truncated;
    assignedRes.rows.forEach(pushRow);
  }

  const { count: bulkCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('source', 'bulk_export');

  return { ids: Array.from(ids), metaMap, bulkCount: bulkCount || 0, partial, maxPaginateRows: PORTAL_PAGINATE_MAX_ROWS };
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_VIEW)) return forbidden();

  const { customer } = session;
  const supabase = createServerClient();
  const t0 = Date.now();
  const url = request.nextUrl;

  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const sort = url.searchParams.get('sort') || 'received_at';
  const order = url.searchParams.get('order') || 'desc';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '25');
  const branch = url.searchParams.get('branch');
  const leadSource = (url.searchParams.get('lead_source') || 'all') as 'all' | 'fresh' | 'bulk';
  const idsOnly = url.searchParams.get('ids_only') === '1';
  const provinces = parseProvinceList(url.searchParams.get('provincie'));
  const postcodeArea = parsePostcodeArea(url.searchParams.get('postcode_area'));
  const maxDistanceKm = parseMaxDistanceKm(url.searchParams.get('max_distance_km'));
  const distanceOriginPlace = url.searchParams.get('distance_origin_place')?.trim() || '';
  const distanceOriginProvinces = parseProvinceList(url.searchParams.get('distance_origin_province'));

  const { demoMode, branches: customerBranches } = await getCustomerDemoInfo(supabase, customer.id);

  const geoResolved = await resolvePortalGeoFilterContext({
    plaats: url.searchParams.get('plaats'),
    maxDistanceKm,
    distanceOriginPlace,
    distanceOriginProvinces,
  });
  if (!geoResolved.ok) {
    return NextResponse.json({ error: geoResolved.error }, { status: 400 });
  }
  const { plaatsFilter, distanceOrigin: customDistanceOrigin } = geoResolved.ctx;

  // Datumfilter op ontvangstdatum (assigned_at) / custom straal → memory-pad
  const needsMemFilter =
    maxDistanceKm != null
    || !!customDistanceOrigin
    || (postcodeArea?.kind === 'range')
    || (!demoMode && !!(from || to));

  // Agent-scoped filtering (respecteert customers.agents_see_unassigned_leads)
  const agentFilter = buildPortalAgentLeadScope({
    portalUserId: session.portalUser?.id,
    viewAll: !session.portalUser || hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL),
    agentsSeeUnassignedLeads: customer.agents_see_unassigned_leads,
  });

  let { ids: leadIds, metaMap, bulkCount, partial: leadDataPartial, maxPaginateRows } = await getCustomerLeadData(
    supabase,
    customer.id,
    leadSource,
    demoMode,
    status,
    agentFilter,
    customerBranches,
  );

  // Orphaned demo assignments (lead row removed): assignments exist but no matching demo leads
  if (demoMode && leadIds.length > 0) {
    let existingDemo = 0;
    for (let i = 0; i < leadIds.length; i += IN_CHUNK) {
      const chunk = leadIds.slice(i, i + IN_CHUNK);
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .in('id', chunk)
        .eq('bron', 'demo');
      existingDemo += count || 0;
    }
    if (existingDemo === 0) {
      await repairDemoAssignmentsIfNeeded(supabase, customer.id, customerBranches);
      const refreshed = await getCustomerLeadData(supabase, customer.id, leadSource, demoMode, status, agentFilter, customerBranches);
      leadIds = refreshed.ids;
      metaMap = refreshed.metaMap;
      bulkCount = refreshed.bulkCount;
      leadDataPartial = refreshed.partial;
      maxPaginateRows = refreshed.maxPaginateRows;
    }
  }

  // Build portal_user name lookup for "Toegewezen aan" column
  const portalUserIds = new Set<string>();
  Object.values(metaMap).forEach(m => { if (m.portal_user_id) portalUserIds.add(m.portal_user_id); });
  const portalUserNameMap: Record<string, string> = {};
  if (portalUserIds.size > 0) {
    const puIds = Array.from(portalUserIds);
    const { data: puRows } = await supabase.from('portal_users').select('id, name').in('id', puIds);
    (puRows || []).forEach((pu: { id: string; name: string }) => { portalUserNameMap[pu.id] = pu.name; });
    Object.values(metaMap).forEach(m => {
      if (m.portal_user_id) m.portal_user_name = portalUserNameMap[m.portal_user_id] || null;
    });
  }
  // Owner/manager (view-all of assign) can filter by assigned_to agent
  const assignedToParam = url.searchParams.get('assigned_to');
  let filteredLeadIds = leadIds;
  const canFilterAssignee =
    hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL)
    || hasPermission(session, PERMISSIONS.LEADS_ASSIGN);
  if (assignedToParam && assignedToParam !== 'all' && canFilterAssignee) {
    if (assignedToParam === 'unassigned') {
      filteredLeadIds = leadIds.filter(id => !metaMap[id]?.portal_user_id);
    } else {
      filteredLeadIds = leadIds.filter(id => metaMap[id]?.portal_user_id === assignedToParam);
    }
  }

  if (filteredLeadIds.length === 0) {
    console.info('[portal/leads]', { computeMs: Date.now() - t0, partial: leadDataPartial, poolSize: 0, page });
    if (idsOnly) {
      return NextResponse.json({ ids: [], total: 0, partial: leadDataPartial, maxPaginateRows });
    }
    return NextResponse.json({
      leads: [],
      total: 0,
      page,
      totalPages: 0,
      bulkCount,
      partial: leadDataPartial,
      maxPaginateRows,
    });
  }

  const { data: activeTargetsRows } = await supabase
    .from('customer_targets')
    .select('target_type, lat, lng, radius_km, created_at')
    .eq('customer_id', customer.id)
    .eq('is_active', true);
  const activeTargets = (activeTargetsRows || []) as PortalRadiusTarget[];

  const allowedSorts = ['received_at', 'created_at', 'naam_klant', 'email', 'status', 'wervingsdatum', 'plaatsnaam', 'provincie', 'branch', 'distance_km'];
  const col = allowedSorts.includes(sort) ? sort : 'received_at';
  const asc = order === 'asc';
  // received_at is enriched from lead_assignments.assigned_at — not a leads table column
  const dbSortable = col !== 'distance_km' && col !== 'status' && col !== 'received_at';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (branch && branch !== 'all') q = q.eq('branch', branch);
    if (search) {
      const s = sanitizePostgrestIlike(search);
      const parts = [
        `naam_klant.ilike.%${s}%`,
        `email.ilike.%${s}%`,
        ...buildPhoneSearchIlikeClauses('telefoonnummer', search),
        `postcode.ilike.%${s}%`,
        `plaatsnaam.ilike.%${s}%`,
      ];
      q = q.or(parts.join(','));
    }
    if (provinces.length === 1) q = q.eq('provincie', provinces[0]);
    else if (provinces.length > 1) q = q.in('provincie', provinces);
    if (plaatsFilter) {
      q = q.ilike('plaatsnaam', `%${sanitizePostgrestIlike(plaatsFilter)}%`);
    }
    if (postcodeArea?.kind === 'prefix') {
      q = q.ilike('postcode', `${sanitizePostgrestIlike(postcodeArea.prefix)}%`);
    }
    // Datumfilter gebeurt in memory op received_at (zie applyMemFilters)
    return q;
  }

  function applyMemFilters(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    let out = rows;
    if (postcodeArea?.kind === 'range') {
      out = out.filter((l) => matchesPostcodeArea(l.postcode, postcodeArea));
    }
    if (maxDistanceKm != null) {
      out = out.filter((l) => {
        const d = l.distance_km;
        return typeof d === 'number' && d >= 0 && d <= maxDistanceKm;
      });
    }
    if (!demoMode && (from || to)) {
      out = out.filter((l) => {
        const raw = String(l.received_at || l.created_at || l.wervingsdatum || '');
        if (!raw) return false;
        const day = raw.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      });
    }
    return out;
  }

  // Fast path: single chunk allows DB-level sort + pagination
  if (filteredLeadIds.length <= IN_CHUNK && dbSortable && !needsMemFilter) {
    let countQ = supabase.from('leads').select('id', { count: 'exact', head: true }).in('id', filteredLeadIds);
    countQ = applyFilters(countQ);
    const { count: totalCount } = await countQ;
    const total = totalCount || 0;

    const startIdx = (page - 1) * limit;
    let q = supabase.from('leads').select('*').in('id', filteredLeadIds);
    q = applyFilters(q);
    if (idsOnly) {
      q = q.order(col, { ascending: asc });
    } else {
      q = q.order(col, { ascending: asc }).range(startIdx, startIdx + limit - 1);
    }
    const { data, error: fetchError } = await q;
    if (fetchError) {
      return NextResponse.json({ error: 'Kon leads niet ophalen' }, { status: 500 });
    }

    const enrichedLeads = (data || []).map(lead => {
      const meta = metaMap[lead.id as string];
      return {
        ...lead,
        status: meta?.status ?? (lead as Record<string, unknown>).status ?? 'nieuw',
        notities: meta?.notities ?? (lead as Record<string, unknown>).notities ?? '',
        received_at: meta?.assigned_at || lead.created_at,
        distance_km: meta?.distance_km ?? null,
        portal_user_id: meta?.portal_user_id ?? null,
        portal_user_name: meta?.portal_user_name ?? null,
        assignment_id: meta?.assignment_id ?? null,
      };
    });

    await attachReclamationFieldsToLeads(supabase, customer.id, enrichedLeads as Record<string, unknown>[]);
    if (customDistanceOrigin) {
      applyCustomDistanceOrigin(enrichedLeads as Record<string, unknown>[], customDistanceOrigin);
    } else {
      enrichPortalLeadDistances(enrichedLeads as Record<string, unknown>[], activeTargets);
    }

    if (idsOnly) {
      const allIds = enrichedLeads.map((l) => (l as Record<string, unknown>).id as string);
      console.info('[portal/leads]', { computeMs: Date.now() - t0, partial: leadDataPartial, poolSize: filteredLeadIds.length, path: 'ids_only_db_sort' });
      return NextResponse.json({
        ids: allIds,
        total: allIds.length,
        partial: leadDataPartial,
        maxPaginateRows,
        // Custom origin forceert altijd het memory-pad; hier dus altijd null.
        distance_origin_label: null,
      });
    }

    console.info('[portal/leads]', { computeMs: Date.now() - t0, partial: leadDataPartial, poolSize: filteredLeadIds.length, page, path: 'db_sort' });
    return NextResponse.json({
      leads: enrichedLeads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      bulkCount,
      partial: leadDataPartial,
      maxPaginateRows,
      distance_origin_label: null,
    });
  }

  // Multi-chunk path: fetch all matching, enrich, sort, paginate in memory
  const allMatching: Record<string, unknown>[] = [];

  for (let i = 0; i < filteredLeadIds.length; i += IN_CHUNK) {
    const chunk = filteredLeadIds.slice(i, i + IN_CHUNK);
    let q = supabase.from('leads').select('*').in('id', chunk);
    q = applyFilters(q);
    const { data: batchData, error: batchError } = await q;
    if (batchError) {
      return NextResponse.json({ error: 'Kon leads niet ophalen' }, { status: 500 });
    }
    if (batchData) allMatching.push(...batchData);
  }

  const enrichedAll = allMatching.map(lead => {
    const meta = metaMap[lead.id as string];
    return {
      ...lead,
      status: meta?.status ?? (lead as Record<string, unknown>).status ?? 'nieuw',
      notities: meta?.notities ?? (lead as Record<string, unknown>).notities ?? '',
      received_at: meta?.assigned_at || lead.created_at,
      distance_km: meta?.distance_km ?? null,
      portal_user_id: meta?.portal_user_id ?? null,
      portal_user_name: meta?.portal_user_name ?? null,
      assignment_id: meta?.assignment_id ?? null,
    };
  });

  if (customDistanceOrigin) {
    applyCustomDistanceOrigin(enrichedAll, customDistanceOrigin);
  } else {
    enrichPortalLeadDistances(enrichedAll, activeTargets);
  }
  const geoFiltered = applyMemFilters(enrichedAll);

  geoFiltered.sort((a, b) => {
    if (col === 'distance_km') {
      const va = (a.distance_km as number | null) ?? Infinity;
      const vb = (b.distance_km as number | null) ?? Infinity;
      const cmp = va - vb;
      return asc ? cmp : -cmp;
    }
    if (col === 'received_at' || col === 'created_at' || col === 'wervingsdatum') {
      const ta = new Date(String((a as Record<string, unknown>)[col] || 0)).getTime();
      const tb = new Date(String((b as Record<string, unknown>)[col] || 0)).getTime();
      const cmp = ta - tb;
      return asc ? cmp : -cmp;
    }
    const va = ((a as Record<string, unknown>)[col] as string) ?? '';
    const vb = ((b as Record<string, unknown>)[col] as string) ?? '';
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return asc ? cmp : -cmp;
  });

  const totalCount = geoFiltered.length;
  const startIdx = (page - 1) * limit;
  const enrichedLeads = geoFiltered.slice(startIdx, startIdx + limit);

  await attachReclamationFieldsToLeads(supabase, customer.id, enrichedLeads as Record<string, unknown>[]);

  if (idsOnly) {
    const allIds = geoFiltered.map((l) => (l as Record<string, unknown>).id as string);
    console.info('[portal/leads]', { computeMs: Date.now() - t0, partial: leadDataPartial, poolSize: filteredLeadIds.length, path: 'ids_only_mem_sort' });
    return NextResponse.json({
      ids: allIds,
      total: totalCount,
      partial: leadDataPartial,
      maxPaginateRows,
      distance_origin_label: customDistanceOrigin?.label ?? null,
    });
  }

  console.info('[portal/leads]', { computeMs: Date.now() - t0, partial: leadDataPartial, poolSize: filteredLeadIds.length, page, path: 'mem_sort' });
  return NextResponse.json({
    leads: enrichedLeads,
    total: totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
    bulkCount,
    partial: leadDataPartial,
    distance_origin_label: customDistanceOrigin?.label ?? null,
    maxPaginateRows,
  });
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_EDIT)) return forbidden();

  const { customer } = session;

  // Agent-scope: zonder leads.view_all alleen eigen (+ optioneel niet-toegewezen) leads.
  const agentScope = buildPortalAgentLeadScope({
    portalUserId: session.portalUser?.id,
    viewAll: !session.portalUser || hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL),
    agentsSeeUnassignedLeads: customer.agents_see_unassigned_leads,
  });

  try {
    const { id, status, notities } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is verplicht' }, { status: 400 });
    }

    if (status !== undefined && !isValidLeadStatus(status)) {
      return NextResponse.json({ error: `Ongeldige status: ${status}` }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: assignment } = await supabase
      .from('lead_assignments')
      .select('id, status, portal_user_id')
      .eq('lead_id', id)
      .eq('customer_id', customer.id)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignment && !agentMayAccessAssignment(assignment, agentScope)) {
      return NextResponse.json({ error: 'Geen toegang tot deze lead' }, { status: 403 });
    }

    if (!assignment) {
      const { data: directLead } = await supabase
        .from('leads')
        .select('id')
        .eq('id', id)
        .eq('customer_id', customer.id)
        .maybeSingle();

      if (!directLead) {
        return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 });
      }

      const updates: Record<string, unknown> = {};
      if (status !== undefined) updates.status = status;
      if (notities !== undefined) updates.notities = notities;
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Geen wijzigingen opgegeven' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[portal/leads PUT] update failed:', error.message, { leadId: id, customerId: customer.id, updates });
        return NextResponse.json({ error: 'Kon lead niet bijwerken' }, { status: 500 });
      }
      await logImpersonatedWrite(session, 'lead_update', 'lead', id, updates);
      return NextResponse.json({ lead: data });
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notities !== undefined) updates.notities = notities;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Geen wijzigingen opgegeven' }, { status: 400 });
    }

    const previousStatus = (assignment as { status?: string | null }).status ?? null;
    const { error: assignError } = await supabase
      .from('lead_assignments')
      .update(updates)
      .eq('id', assignment.id);

    if (assignError) {
      console.error('[portal/leads PUT] assignment update failed:', assignError.message, { leadId: id, customerId: customer.id, updates });
      return NextResponse.json({ error: 'Kon lead niet bijwerken' }, { status: 500 });
    }

    await logImpersonatedWrite(session, 'lead_update', 'lead', id, { ...updates, previousStatus });

    // NB: geen CAPI-event op statuswijzigingen. WarmeLeads optimaliseert op
    // lead-volume + CPL per branche, niet op klant-side conversie.

    const { data: updatedAssignment } = await supabase
      .from('lead_assignments')
      .select('status, notities')
      .eq('id', assignment.id)
      .single();

    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({
      lead: leadData ? {
        ...leadData,
        status: updatedAssignment?.status ?? leadData.status,
        notities: updatedAssignment?.notities ?? leadData.notities,
      } : null,
    });
  } catch (err) {
    console.error('[portal/leads PUT] unexpected error:', err);
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
