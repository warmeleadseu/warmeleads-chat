import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

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
  const page = parseInt(url.get('page') || '1');
  const perPage = Math.min(parseInt(url.get('per_page') || '25'), 200);
  const sortBy = url.get('sort_by') || 'created_at';
  const sortDir = url.get('sort_dir') === 'asc' ? true : false;

  const supabase = createServerClient();
  let query = supabase
    .from('leads')
    .select('*, customers(id, name)', { count: 'exact' });

  if (branch && branch !== 'all') query = query.eq('branch', branch);
  if (customerId && customerId !== 'all') query = query.eq('customer_id', customerId);
  if (status && status !== 'all') query = query.eq('status', status);
  if (province && province !== 'all') query = query.eq('provincie', province);
  if (source && source !== 'all') query = query.eq('bron', source);
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

  return NextResponse.json({ leads: data || [], total: count || 0, page, perPage });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    const supabase = createServerClient();

    if (Array.isArray(body.leads)) {
      const { data, error } = await supabase.from('leads').insert(body.leads).select();
      if (error) {
        console.error('Bulk insert error:', error);
        return NextResponse.json({ error: 'Import mislukt', details: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: data?.length || 0 });
    }

    const { data, error } = await supabase.from('leads').insert(body).select().single();
    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: 'Lead aanmaken mislukt', details: error.message }, { status: 500 });
    }
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
