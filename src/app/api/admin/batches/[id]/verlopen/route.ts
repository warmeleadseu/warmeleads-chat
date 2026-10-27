import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { beheerderNaam } from '@/lib/factuurBetaling';
import { laatBatchVerlopen, zetBatchTerug } from '@/lib/offerteVerloop';

/**
 * Een onbetaalde batch laten verlopen (met zijn open facturen), of een
 * verlopen batch terugzetten op "wacht op betaling". Er wordt niets
 * verwijderd.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const actie = body?.actie;
  if (actie !== 'verlopen' && actie !== 'terugzetten') {
    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: batch } = await supabase
    .from('customer_batches')
    .select('id, customer_id, status, is_paid')
    .eq('id', id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id')
      .eq('id', batch.customer_id)
      .eq('account_manager_id', admin.id)
      .maybeSingle();
    if (!myCust) return forbidden();
  }

  const door = { id: admin.id, naam: beheerderNaam(admin) };
  if (actie === 'verlopen') {
    if (batch.is_paid || batch.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Alleen een batch die op betaling wacht kan verlopen' }, { status: 400 });
    }
    const r = await laatBatchVerlopen(supabase, id, { door, reden: 'met de hand' });
    if (!r.ok) return NextResponse.json({ error: 'Verlopen mislukt' }, { status: 409 });
    return NextResponse.json({ ok: true, facturen: r.facturen });
  }

  if (batch.status !== 'expired') {
    return NextResponse.json({ error: 'Alleen een verlopen batch kan terug' }, { status: 400 });
  }
  const r = await zetBatchTerug(supabase, id, { door, reden: 'met de hand' });
  if (!r.ok) return NextResponse.json({ error: 'Terugzetten mislukt' }, { status: 409 });
  return NextResponse.json({ ok: true, facturen: r.facturen });
}
