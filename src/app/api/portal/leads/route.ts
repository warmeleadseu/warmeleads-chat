import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

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

async function getCustomerLeadData(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leadSource: 'all' | 'fresh' | 'bulk' = 'all',
): Promise<{ ids: string[]; assignedAtMap: Record<string, string>; distanceMap: Record<string, number | null>; bulkCount: number }> {
  const ids = new Set<string>();
  const assignedAtMap: Record<string, string> = {};
  const distanceMap: Record<string, number | null> = {};

  if (leadSource !== 'bulk') {
    const directLeads = await paginateQuery<{ id: string }>(
      supabase.from('leads').select('id').eq('customer_id', customerId),
    );
    directLeads.forEach(l => ids.add(l.id));
  }

  if (leadSource === 'bulk') {
    const bulkLeads = await paginateQuery<{ lead_id: string; assigned_at: string; distance_km: number | null }>(
      supabase.from('lead_assignments').select('lead_id, assigned_at, distance_km').eq('customer_id', customerId).eq('source', 'bulk_export'),
    );
    bulkLeads.forEach(a => {
      ids.add(a.lead_id);
      assignedAtMap[a.lead_id] = a.assigned_at;
      distanceMap[a.lead_id] = a.distance_km;
    });
  } else {
    let assignQuery = supabase
      .from('lead_assignments')
      .select('lead_id, assigned_at, distance_km')
      .eq('customer_id', customerId);
    if (leadSource === 'fresh') assignQuery = assignQuery.neq('source', 'bulk_export');
    const assignedLeads = await paginateQuery<{ lead_id: string; assigned_at: string; distance_km: number | null }>(assignQuery);
    assignedLeads.forEach(a => {
      ids.add(a.lead_id);
      assignedAtMap[a.lead_id] = a.assigned_at;
      distanceMap[a.lead_id] = a.distance_km;
    });
  }

  const { count: bulkCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('source', 'bulk_export');

  return { ids: Array.from(ids), assignedAtMap, distanceMap, bulkCount: bulkCount || 0 };
}

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

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

  const { ids: leadIds, assignedAtMap, distanceMap, bulkCount } = await getCustomerLeadData(supabase, customer.id, leadSource);
  if (leadIds.length === 0) {
    return NextResponse.json({ leads: [], total: 0, page, totalPages: 0, bulkCount });
  }

  const allowedSorts = ['created_at', 'naam_klant', 'email', 'status', 'wervingsdatum', 'plaatsnaam', 'provincie', 'branch', 'distance_km'];
  const col = allowedSorts.includes(sort) ? sort : 'created_at';
  const asc = order === 'asc';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFilters(q: any) {
    if (status && status !== 'all') q = q.eq('status', status);
    if (branch && branch !== 'all') q = q.eq('branch', branch);
    if (search) {
      q = q.or(`naam_klant.ilike.%${search}%,email.ilike.%${search}%,telefoonnummer.ilike.%${search}%,postcode.ilike.%${search}%,plaatsnaam.ilike.%${search}%`);
    }
    if (from) q = q.gte('wervingsdatum', from);
    if (to) q = q.lte('wervingsdatum', to);
    return q;
  }

  let totalCount = 0;
  const allMatching: Record<string, unknown>[] = [];

  for (let i = 0; i < leadIds.length; i += IN_CHUNK) {
    const chunk = leadIds.slice(i, i + IN_CHUNK);
    let q = supabase.from('leads').select('*', { count: 'exact' }).in('id', chunk);
    q = applyFilters(q);
    const { data: batchData, count: batchCount, error: batchError } = await q;
    if (batchError) {
      return NextResponse.json({ error: 'Kon leads niet ophalen' }, { status: 500 });
    }
    totalCount += batchCount || 0;
    if (batchData) allMatching.push(...batchData);
  }

  const enrichedAll = allMatching.map(lead => ({
    ...lead,
    received_at: assignedAtMap[lead.id as string] || lead.created_at,
    distance_km: distanceMap[lead.id as string] ?? null,
  }));

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
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  try {
    const { id, status, notities } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is verplicht' }, { status: 400 });
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Ongeldige status: ${status}` }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: directLead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', id)
      .eq('customer_id', customer.id)
      .maybeSingle();

    let hasAccess = !!directLead;
    if (!hasAccess) {
      const { count } = await supabase
        .from('lead_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', id)
        .eq('customer_id', customer.id);
      hasAccess = (count || 0) > 0;
    }

    if (!hasAccess) {
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
  } catch (err) {
    console.error('[portal/leads PUT] unexpected error:', err);
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
