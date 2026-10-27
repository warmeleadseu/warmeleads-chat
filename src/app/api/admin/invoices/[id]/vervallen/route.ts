import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { beheerderNaam } from '@/lib/factuurBetaling';
import { laatBatchVerlopen, laatFactuurVervallen, zetFactuurTerug } from '@/lib/offerteVerloop';

/**
 * Een open factuur laten vervallen, of een vervallen factuur weer openzetten.
 * Hoort de factuur bij een batch die op betaling wacht, dan verloopt die batch
 * mee (en gaat hij bij terugzetten weer mee open).
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
  if (actie !== 'vervallen' && actie !== 'terugzetten') {
    return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status, customer_id, batch_id')
    .eq('id', id)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id')
      .eq('id', invoice.customer_id)
      .eq('account_manager_id', admin.id)
      .maybeSingle();
    if (!myCust) return forbidden();
  }

  const door = { id: admin.id, naam: beheerderNaam(admin) };

  if (actie === 'vervallen') {
    if (invoice.status !== 'open') {
      return NextResponse.json({ error: 'Alleen een openstaande factuur kan vervallen' }, { status: 400 });
    }
    if (invoice.batch_id) {
      const { data: batch } = await supabase
        .from('customer_batches')
        .select('status, is_paid')
        .eq('id', invoice.batch_id)
        .maybeSingle();
      if (batch?.status === 'pending_payment' && !batch.is_paid) {
        const r = await laatBatchVerlopen(supabase, invoice.batch_id, { door, reden: 'factuur met de hand vervallen' });
        if (r.ok) return NextResponse.json({ ok: true, batch_verlopen: true });
      }
    }
    const ok = await laatFactuurVervallen(supabase, id, { door, reden: 'met de hand' });
    if (!ok) return NextResponse.json({ error: 'Vervallen mislukt' }, { status: 409 });
    return NextResponse.json({ ok: true, batch_verlopen: false });
  }

  if (invoice.status !== 'expired') {
    return NextResponse.json({ error: 'Alleen een vervallen factuur kan terug' }, { status: 400 });
  }
  const ok = await zetFactuurTerug(supabase, id, { door, reden: 'met de hand' });
  if (!ok) return NextResponse.json({ error: 'Terugzetten mislukt' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
