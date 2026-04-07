import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

const DIMENSIONS = ['branch', 'customer_id', 'status', 'province', 'source'] as const;

const DB_COL: Record<string, string> = {
  branch: 'branch',
  customer_id: 'customer_id',
  status: 'status',
  province: 'provincie',
  source: 'bron',
};

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl.searchParams;
  const phoneValid = url.get('phone_valid');
  const dateFrom = url.get('date_from');
  const dateTo = url.get('date_to');
  const search = url.get('search');

  const dimFilters: Record<string, string[]> = {};
  for (const dim of DIMENSIONS) {
    const raw = url.get(dim === 'province' ? 'province' : dim === 'source' ? 'source' : dim);
    if (raw) dimFilters[dim] = raw.split(',').filter(Boolean);
  }

  const supabase = createServerClient();

  let query = supabase
    .from('leads')
    .select('branch, customer_id, status, provincie, bron')
    .limit(50000);

  if (phoneValid === 'false') query = query.eq('phone_valid', false);
  if (phoneValid === 'true') query = query.eq('phone_valid', true);
  if (dateFrom) query = query.gte('wervingsdatum', dateFrom);
  if (dateTo) query = query.lte('wervingsdatum', dateTo);
  if (search) {
    query = query.or(
      `naam_klant.ilike.%${search}%,email.ilike.%${search}%,telefoonnummer.ilike.%${search}%,postcode.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Facets ophalen mislukt' }, { status: 500 });

  const rows = data || [];

  function computeFacet(dim: string) {
    const col = DB_COL[dim];
    let filtered = rows;
    for (const [otherDim, values] of Object.entries(dimFilters)) {
      if (otherDim === dim || values.length === 0) continue;
      const otherCol = DB_COL[otherDim];
      filtered = filtered.filter((row: Record<string, unknown>) => values.includes(String(row[otherCol] ?? '')));
    }
    const counts: Record<string, number> = {};
    filtered.forEach((row: Record<string, unknown>) => {
      const val = String(row[col] ?? '');
      if (val) counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }

  const facets: Record<string, Record<string, number>> = {};
  for (const dim of DIMENSIONS) {
    facets[dim] = computeFacet(dim);
  }

  return NextResponse.json({ facets });
}
