import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl.searchParams;
  const branch = url.get('branch');
  const customerId = url.get('customer_id');
  const excludeCustomerId = url.get('exclude_customer_id');
  const assignment = url.get('assignment');
  const status = url.get('status');
  const province = url.get('province');
  const source = url.get('source');
  const phoneValid = url.get('phone_valid');
  const bulkStatus = url.get('bulk_status');
  const dateFrom = url.get('date_from');
  const dateTo = url.get('date_to');
  // Spiegelt de list/count/export-semantiek: bij een datum-range tellen leads
  // met onbekende wervingsdatum standaard mee, tenzij expliciet uitgezet.
  const includeUnknownDate = url.get('include_unknown_date') !== 'false';
  const search = url.get('search');

  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_lead_facets', {
    p_branches: branch ? branch.split(',').filter(Boolean) : null,
    p_customers: customerId ? customerId.split(',').filter(Boolean) : null,
    p_statuses: status ? status.split(',').filter(Boolean) : null,
    p_provinces: province ? province.split(',').filter(Boolean) : null,
    p_sources: source ? source.split(',').filter(Boolean) : null,
    p_phone_valid: phoneValid && phoneValid !== 'all' ? phoneValid : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_search: search || null,
    p_assignment: assignment === 'assigned' || assignment === 'unassigned' ? assignment : null,
    p_exclude_customers: excludeCustomerId ? excludeCustomerId.split(',').filter(Boolean) : null,
    p_bulk_status: bulkStatus === 'never' || bulkStatus === 'once' || bulkStatus === 'multiple' ? bulkStatus : null,
    p_include_unknown_date: includeUnknownDate,
  });

  if (error) {
    console.error('Facets RPC error:', error);
    return NextResponse.json({ error: 'Facets ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ facets: data || {} });
}
