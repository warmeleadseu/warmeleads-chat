import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';

/**
 * De ontvangende klant bevestigt een afspraak die een gekoppeld portaal voor
 * hem heeft ingepland.
 *
 * Vanaf dat moment kan de boekende partij hem niet meer verzetten of
 * annuleren: de installateur heeft er zijn dag omheen gepland.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, customer_id, geboekt_door_customer_id, bevestigd_at, status')
    .eq('id', id)
    .maybeSingle();

  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  /* Alleen de eigenaar van de agenda bevestigt. De boeker zijn eigen boeking
     laten bevestigen zou de hele bescherming zinloos maken. */
  if (appt.customer_id !== session.customer.id) {
    return forbidden('Alleen de ontvangende klant kan bevestigen');
  }
  if (!appt.geboekt_door_customer_id) {
    return NextResponse.json(
      { error: 'Deze afspraak is niet door een andere partij ingepland' },
      { status: 400 },
    );
  }
  if (appt.bevestigd_at) {
    return NextResponse.json({ error: 'Deze afspraak is al bevestigd' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ bevestigd_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[portal/appointments bevestigen]', error.message);
    return NextResponse.json({ error: 'Bevestigen mislukt' }, { status: 500 });
  }
  return NextResponse.json(data);
}
