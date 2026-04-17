import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

const PAGE_SIZE = 1000;
const IN_CHUNK = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery<T>(query: any): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return all;
}

interface AssignmentMeta {
  assigned_at: string;
  distance_km: number | null;
  status: string | null;
  notities: string | null;
  portal_user_id: string | null;
  portal_user_name: string | null;
}

async function getCustomerDemoMode(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('customers')
    .select('demo_mode')
    .eq('id', customerId)
    .single();
  return data?.demo_mode ?? false;
}

async function getCustomerLeadData(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leadSource: 'all' | 'fresh' | 'bulk' = 'all',
  demoMode = false,
  statusFilter?: string | null,
  agentFilter?: { portalUserId: string; viewAll: boolean } | null,
): Promise<{ ids: string[]; metaMap: Record<string, AssignmentMeta>; bulkCount: number }> {
  const ids = new Set<string>();
  const metaMap: Record<string, AssignmentMeta> = {};
  const selectFields = 'lead_id, assigned_at, distance_km, status, notities, portal_user_id';

  type AssignRow = { lead_id: string; assigned_at: string; distance_km: number | null; status: string | null; notities: string | null; portal_user_id: string | null };
  const pushRow = (a: AssignRow) => {
    ids.add(a.lead_id);
    if (!metaMap[a.lead_id]) {
      metaMap[a.lead_id] = { assigned_at: a.assigned_at, distance_km: a.distance_km, status: a.status, notities: a.notities, portal_user_id: a.portal_user_id, portal_user_name: null };
    }
  };

  // Agent scope filter: only their leads + unassigned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyAgentScope = (q: any) => {
    if (agentFilter && !agentFilter.viewAll) {
      return q.or(`portal_user_id.eq.${agentFilter.portalUserId},portal_user_id.is.null`);
    }
    return q;
  };

  if (demoMode) {
    let q = supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'demo').order('assigned_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    q = applyAgentScope(q);
    const demoLeads = await paginateQuery<AssignRow>(q);
    demoLeads.forEach(pushRow);
    return { ids: Array.from(ids), metaMap, bulkCount: 0 };
  }

  if (leadSource !== 'bulk' && (!agentFilter || agentFilter.viewAll)) {
    let directQuery = supabase.from('leads').select('id').eq('customer_id', customerId);
    if (statusFilter && statusFilter !== 'all') directQuery = directQuery.eq('status', statusFilter);
    const directLeads = await paginateQuery<{ id: string }>(directQuery);
    directLeads.forEach(l => ids.add(l.id));
  }

  if (leadSource === 'bulk') {
    let q = supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'bulk_export').order('assigned_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    q = applyAgentScope(q);
    const bulkLeads = await paginateQuery<AssignRow>(q);
    bulkLeads.forEach(pushRow);
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
    const assignedLeads = await paginateQuery<AssignRow>(assignQuery);
    assignedLeads.forEach(pushRow);
  }

  const { count: bulkCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('source', 'bulk_export');

  return { ids: Array.from(ids), metaMap, bulkCount: bulkCount || 0 };
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_VIEW)) return forbidden();

  const { customer } = session;
  const supabase = createServerClient();
  const url = request.nextUrl;

  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const sort = url.searchParams.get('sort') || 'created_at';
  const order = url.searchParams.get('order') || 'desc';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '25');
  const branch = url.searchParams.get('branch');
  const leadSource = (url.searchParams.get('lead_source') || 'all') as 'all' | 'fresh' | 'bulk';

  const demoMode = await getCustomerDemoMode(supabase, customer.id);

  // Agent-scoped filtering
  const agentFilter = session.portalUser && !hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL)
    ? { portalUserId: session.portalUser.id, viewAll: false }
    : null;

  const { ids: leadIds, metaMap, bulkCount } = await getCustomerLeadData(supabase, customer.id, leadSource, demoMode, status, agentFilter);

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
  // Owner/manager can filter by assigned_to agent
  const assignedToParam = url.searchParams.get('assigned_to');
  let filteredLeadIds = leadIds;
  if (assignedToParam && hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL)) {
    if (assignedToParam === 'unassigned') {
      filteredLeadIds = leadIds.filter(id => !metaMap[id]?.portal_user_id);
    } else {
      filteredLeadIds = leadIds.filter(id => metaMap[id]?.portal_user_id === assignedToParam);
    }
  }

  if (filteredLeadIds.length === 0) {
    return NextResponse.json({ leads: [], total: 0, page, totalPages: 0, bulkCount });
  }

  const allowedSorts = ['created_at', 'naam_klant', 'email', 'status', 'wervingsdatum', 'plaatsnaam', 'provincie', 'branch', 'distance_km'];
  const col = allowedSorts.includes(sort) ? sort : 'created_at';
  const asc = order === 'asc';
  const dbSortable = col !== 'distance_km' && col !== 'status';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (branch && branch !== 'all') q = q.eq('branch', branch);
    if (search) {
      q = q.or(`naam_klant.ilike.%${search}%,email.ilike.%${search}%,telefoonnummer.ilike.%${search}%,postcode.ilike.%${search}%,plaatsnaam.ilike.%${search}%`);
    }
    if (from) q = q.gte('wervingsdatum', from);
    if (to) q = q.lte('wervingsdatum', to);
    return q;
  }

  // Fast path: single chunk allows DB-level sort + pagination
  if (filteredLeadIds.length <= IN_CHUNK && dbSortable) {
    let countQ = supabase.from('leads').select('id', { count: 'exact', head: true }).in('id', filteredLeadIds);
    countQ = applyFilters(countQ);
    const { count: totalCount } = await countQ;
    const total = totalCount || 0;

    const startIdx = (page - 1) * limit;
    let q = supabase.from('leads').select('*').in('id', filteredLeadIds);
    q = applyFilters(q);
    q = q.order(col, { ascending: asc }).range(startIdx, startIdx + limit - 1);
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
      };
    });

    return NextResponse.json({
      leads: enrichedLeads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      bulkCount,
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
    };
  });

  enrichedAll.sort((a, b) => {
    if (col === 'distance_km') {
      const va = (a.distance_km as number | null) ?? Infinity;
      const vb = (b.distance_km as number | null) ?? Infinity;
      const cmp = va - vb;
      return asc ? cmp : -cmp;
    }
    const va = ((a as Record<string, unknown>)[col] as string) ?? '';
    const vb = ((b as Record<string, unknown>)[col] as string) ?? '';
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return asc ? cmp : -cmp;
  });

  const totalCount = enrichedAll.length;
  const startIdx = (page - 1) * limit;
  const enrichedLeads = enrichedAll.slice(startIdx, startIdx + limit);

  return NextResponse.json({
    leads: enrichedLeads,
    total: totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
    bulkCount,
  });
}

const VALID_STATUSES = ['nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'verkocht', 'afgewezen'];

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_EDIT)) return forbidden();

  const { customer } = session;

  try {
    const { id, status, notities } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is verplicht' }, { status: 400 });
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Ongeldige status: ${status}` }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: assignment } = await supabase
      .from('lead_assignments')
      .select('id')
      .eq('lead_id', id)
      .eq('customer_id', customer.id)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
      return NextResponse.json({ lead: data });
    }

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (notities !== undefined) updates.notities = notities;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Geen wijzigingen opgegeven' }, { status: 400 });
    }

    const { error: assignError } = await supabase
      .from('lead_assignments')
      .update(updates)
      .eq('id', assignment.id);

    if (assignError) {
      console.error('[portal/leads PUT] assignment update failed:', assignError.message, { leadId: id, customerId: customer.id, updates });
      return NextResponse.json({ error: 'Kon lead niet bijwerken' }, { status: 500 });
    }

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
