import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const branch = request.nextUrl.searchParams.get('branch');
  const field = request.nextUrl.searchParams.get('field');

  if (!branch || !field) {
    return NextResponse.json({ error: 'branch en field zijn verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const STANDARD_COLUMNS = new Set([
    'quality_score', 'phone_valid', 'status', 'provincie', 'plaatsnaam', 'land', 'bron',
    'zonnepanelen', 'dynamisch_contract', 'stroomverbruik', 'budget', 'reden_thuisbatterij',
    'type_airco', 'koelen_verwarmen', 'hoeveel_ruimtes', 'zakelijk', 'koop_of_huur',
    'boorwerkzaamheden_toegestaan',
  ]);

  const isStandardColumn = STANDARD_COLUMNS.has(field);

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('branch', branch)
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const valueSet = new Set<string>();

  for (const lead of (leads || []) as Record<string, unknown>[]) {
    let val: string | null = null;

    if (isStandardColumn) {
      const raw = lead[field];
      if (raw != null && raw !== '') val = String(raw);
    } else {
      const cf = lead.custom_fields as Record<string, string> | null;
      if (cf && cf[field] != null && cf[field] !== '') val = String(cf[field]);
    }

    if (val) valueSet.add(val);
  }

  const values = Array.from(valueSet).sort((a, b) => {
    const numA = parseFloat(a.replace(/[^0-9.,\-]/g, '').replace(',', '.'));
    const numB = parseFloat(b.replace(/[^0-9.,\-]/g, '').replace(',', '.'));
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b, 'nl');
  });

  return NextResponse.json({ values });
}
