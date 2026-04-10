import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

async function getCustomerLeadData(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leadSource: 'all' | 'fresh' | 'bulk' = 'all',
): Promise<{ ids: string[]; assignedAtMap: Record<string, string>; bulkCount: number }> {
  const ids = new Set<string>();
  const assignedAtMap: Record<string, string> = {};

  if (leadSource !== 'bulk') {
    const { data: directLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('customer_id', customerId);
    (directLeads || []).forEach(l => ids.add(l.id));
  }

  if (leadSource === 'bulk') {
    const { data: bulkLeads } = await supabase
      .from('lead_assignments')
      .select('lead_id, assigned_at')
      .eq('customer_id', customerId)
      .eq('source', 'bulk_export');
    (bulkLeads || []).forEach(a => {
      ids.add(a.lead_id);
      assignedAtMap[a.lead_id] = a.assigned_at;
    });
  } else {
    let assignQuery = supabase
      .from('lead_assignments')
      .select('lead_id, assigned_at')
      .eq('customer_id', customerId);
    if (leadSource === 'fresh') assignQuery = assignQuery.neq('source', 'bulk_export');
    const { data: assignedLeads } = await assignQuery;
    (assignedLeads || []).forEach(a => {
      ids.add(a.lead_id);
      assignedAtMap[a.lead_id] = a.assigned_at;
    });
  }

  const { count: bulkCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('source', 'bulk_export');

  return { ids: Array.from(ids), assignedAtMap, bulkCount: bulkCount || 0 };
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

  const { ids: leadIds, assignedAtMap, bulkCount } = await getCustomerLeadData(supabase, customer.id, leadSource);
  if (leadIds.length === 0) {
    return NextResponse.json({ leads: [], total: 0, page, totalPages: 0, bulkCount });
  }

  const allowedSorts = ['created_at', 'naam_klant', 'email', 'status', 'wervingsdatum', 'plaatsnaam', 'provincie', 'branch'];
  const col = allowedSorts.includes(sort) ? sort : 'created_at';

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .in('id', leadIds);

  if (status && status !== 'all') query = query.eq('status', status);
  if (branch && branch !== 'all') query = query.eq('branch', branch);
  if (search) {
    query = query.or(`naam_klant.ilike.%${search}%,email.ilike.%${search}%,telefoonnummer.ilike.%${search}%,postcode.ilike.%${search}%,plaatsnaam.ilike.%${search}%`);
  }
  if (from) query = query.gte('wervingsdatum', from);
  if (to) query = query.lte('wervingsdatum', to);

  query = query.order(col, { ascending: order === 'asc' });
  query = query.range((page - 1) * limit, page * limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Kon leads niet ophalen' }, { status: 500 });
  }

  const enrichedLeads = (data || []).map(lead => ({
    ...lead,
    received_at: assignedAtMap[lead.id] || lead.created_at,
  }));

  return NextResponse.json({
    leads: enrichedLeads,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
    bulkCount,
  });
}

export async function PUT(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  try {
    const { id, status, notities } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { ids: leadIds } = await getCustomerLeadData(supabase, customer.id, 'all');
    if (!leadIds.includes(id)) {
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
      return NextResponse.json({ error: 'Kon lead niet bijwerken' }, { status: 500 });
    }

    return NextResponse.json({ lead: data });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
