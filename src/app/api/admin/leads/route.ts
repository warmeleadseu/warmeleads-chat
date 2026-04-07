import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { enrichLeadAddress, enrichLeadsAddress } from '@/lib/pdok';
import { distributeLead, distributeLeads } from '@/lib/distribution';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { calculateQualityScore } from '@/lib/leadQuality';
import { logAudit } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl.searchParams;
  const branch = url.get('branch');
  const customerId = url.get('customer_id');
  const status = url.get('status');
  const province = url.get('province');
  const source = url.get('source');
  const dateFrom = url.get('date_from');
  const dateTo = url.get('date_to');
  const search = url.get('search');
  const phoneValid = url.get('phone_valid');
  const page = parseInt(url.get('page') || '1');
  const perPage = Math.min(parseInt(url.get('per_page') || '25'), 200);
  const sortBy = url.get('sort_by') || 'created_at';
  const sortDir = url.get('sort_dir') === 'asc' ? true : false;

  const supabase = createServerClient();
  let query = supabase
    .from('leads')
    .select('*, customers(id, name)', { count: 'exact' });

  if (branch) {
    const vals = branch.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('branch', vals[0]);
    else if (vals.length > 1) query = query.in('branch', vals);
  }
  if (customerId) {
    const vals = customerId.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('customer_id', vals[0]);
    else if (vals.length > 1) query = query.in('customer_id', vals);
  }
  if (status) {
    const vals = status.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('status', vals[0]);
    else if (vals.length > 1) query = query.in('status', vals);
  }
  if (province) {
    const vals = province.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('provincie', vals[0]);
    else if (vals.length > 1) query = query.in('provincie', vals);
  }
  if (source) {
    const vals = source.split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('bron', vals[0]);
    else if (vals.length > 1) query = query.in('bron', vals);
  }
  if (phoneValid === 'false') query = query.eq('phone_valid', false);
  if (phoneValid === 'true') query = query.eq('phone_valid', true);
  if (dateFrom) query = query.gte('wervingsdatum', dateFrom);
  if (dateTo) query = query.lte('wervingsdatum', dateTo);
  if (search) {
    query = query.or(`naam_klant.ilike.%${search}%,email.ilike.%${search}%,telefoonnummer.ilike.%${search}%,postcode.ilike.%${search}%`);
  }

  const allowedSorts = [
    'created_at', 'naam_klant', 'email', 'status', 'wervingsdatum', 'plaatsnaam', 'provincie', 'branch',
  ];
  const col = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
  query = query.order(col, { ascending: sortDir });

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Leads fetch error:', error);
    return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
  }

  const leads = data || [];
  if (leads.length > 0) {
    const leadIds = leads.map((l: { id: string }) => l.id);
    const { data: assignments } = await supabase
      .from('lead_assignments')
      .select('lead_id, customer_id, customers(name), distance_km')
      .in('lead_id', leadIds);

    const assignMap: Record<string, { count: number; customers: string[] }> = {};
    (assignments || []).forEach((a: any) => {
      if (!assignMap[a.lead_id]) assignMap[a.lead_id] = { count: 0, customers: [] };
      assignMap[a.lead_id].count++;
      if (a.customers?.name) assignMap[a.lead_id].customers.push(a.customers.name);
    });

    leads.forEach((l: any) => {
      l.assignment_count = assignMap[l.id]?.count || 0;
      l.assigned_customers = assignMap[l.id]?.customers || [];
    });
  }

  return NextResponse.json({ leads, total: count || 0, page, perPage });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    const supabase = createServerClient();

    if (Array.isArray(body.leads)) {
      const enriched = await enrichLeadsAddress(body.leads);
      let profanitySkipped = 0;
      const clean = enriched.filter((l: any) => {
        l.phone_valid = isPhoneValid(l.telefoonnummer);
        if (checkLeadProfanity(l).blocked) { profanitySkipped++; return false; }
        l.quality_score = calculateQualityScore(l);
        return true;
      });
      if (clean.length === 0) {
        return NextResponse.json({ success: true, count: 0, profanitySkipped });
      }
      const { data, error } = await supabase.from('leads').insert(clean).select();
      if (error) {
        console.error('Bulk insert error:', error);
        return NextResponse.json({ error: 'Import mislukt', details: error.message }, { status: 500 });
      }
      const withCoords = (data || []).filter((l: { lat?: number; lng?: number }) => l.lat && l.lng);
      if (withCoords.length > 0) {
        try { await distributeLeads(withCoords); } catch { /* non-blocking */ }
      }
      logAudit({ adminId: admin.id, adminName: admin.name, action: 'import_leads', entityType: 'lead', details: { count: data?.length || 0, profanitySkipped } });
      return NextResponse.json({ success: true, count: data?.length || 0, profanitySkipped });
    }

    const enriched = await enrichLeadAddress(body);
    enriched.phone_valid = isPhoneValid(enriched.telefoonnummer);

    const profanity = checkLeadProfanity(enriched as Record<string, unknown>);
    if (profanity.blocked) {
      return NextResponse.json({ error: `Lead bevat ongepaste taal in veld "${profanity.field}"` }, { status: 422 });
    }

    const quality_score = calculateQualityScore(enriched);

    const { data, error } = await supabase.from('leads').insert({ ...enriched, quality_score }).select().single();
    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: 'Lead aanmaken mislukt', details: error.message }, { status: 500 });
    }
    if (data.lat && data.lng) {
      try { await distributeLead({ id: data.id, branch: data.branch, lat: data.lat, lng: data.lng }); } catch { /* non-blocking */ }
    }
    logAudit({ adminId: admin.id, adminName: admin.name, action: 'create_lead', entityType: 'lead', entityId: data.id, details: { naam: data.naam_klant, branch: data.branch } });
    return NextResponse.json({ success: true, lead: data });
  } catch (err) {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 });

    if (updates.telefoonnummer !== undefined) {
      updates.phone_valid = isPhoneValid(updates.telefoonnummer);
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true, lead: data });
  } catch (err) {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs zijn verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase.from('leads').delete().in('id', ids);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
    }
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err) {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}
