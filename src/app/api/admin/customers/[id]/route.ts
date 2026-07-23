import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { enrichCustomersWithCounts } from '@/lib/adminCustomerEnrichment';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Ongeldig klant-id' }, { status: 400 });
  }

  const supabase = createServerClient();

  let q = supabase.from('customers').select('*').eq('id', id);
  if (admin.role === 'accountmanager') {
    q = q.eq('account_manager_id', admin.id);
  }

  const { data: row, error } = await q.maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Klant ophalen mislukt' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }

  const [enriched] = await enrichCustomersWithCounts(supabase, [row as Record<string, unknown> & { id: string; password_hash?: string | null }]);

  return NextResponse.json({ customer: enriched });
}
