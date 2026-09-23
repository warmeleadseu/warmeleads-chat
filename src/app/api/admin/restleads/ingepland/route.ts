import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

/**
 * Wat staat er nog in de leveringswachtrij?
 *
 * Zonder dit scherm is de wachtrij een zwarte doos: je klikt op uitdelen, de
 * helft gaat pas over twaalf uur weg, en je kunt nergens zien of dat gebeurd
 * is of waarom niet.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const toonAfgehandeld = request.nextUrl.searchParams.get('historie') === '1';
  const supabase = createServerClient();

  let q = supabase
    .from('geplande_leadleveringen')
    .select('id, lead_id, customer_id, gepland_voor, status, laatste_reden, reden, geleverd_op, created_at, leads(naam_klant, plaatsnaam, postcode, branch), customers:customer_id(name)')
    .order('gepland_voor', { ascending: true })
    .limit(500);

  if (!toonAfgehandeld) q = q.eq('status', 'gepland');
  else q = q.gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString());

  const { data, error } = await q;
  if (error) {
    console.error('[admin/restleads/ingepland]', error.message);
    return NextResponse.json({ error: 'Wachtrij ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ rijen: data ?? [] });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan dit annuleren' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });

  const supabase = createServerClient();

  /* Alleen wat nog niet geleverd is. Een al geleverde rij annuleren zou
     suggereren dat de toewijzing wordt teruggedraaid, en dat gebeurt niet. */
  const { data, error } = await supabase
    .from('geplande_leadleveringen')
    .update({ status: 'overgeslagen', laatste_reden: 'Handmatig geannuleerd' })
    .eq('id', id)
    .eq('status', 'gepland')
    .select('id');

  if (error) return NextResponse.json({ error: 'Annuleren mislukt' }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Deze levering is al afgehandeld' }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
