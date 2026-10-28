import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized, logImpersonatedWrite } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { doorloopStatus, zetDoorlopend } from '@/lib/doorlopen';

/**
 * Doorlopend op factuur in het portaal: de stand bekijken, zelf aanzetten
 * (vanaf een betaalde batch, zonder achterstallige factuur) en altijd weer
 * uitzetten. Alleen voor wie mag bestellen.
 */

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const status = await doorloopStatus(createServerClient(), session.customer.id);
  if (!status) return NextResponse.json({ error: 'Account niet gevonden' }, { status: 404 });
  return NextResponse.json(
    { ...status, magWijzigen: hasPermission(session, PERMISSIONS.ORDERS_CREATE) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return forbidden();
  const body = await request.json().catch(() => ({}));
  if (typeof body?.aan !== 'boolean') return NextResponse.json({ error: 'Kies aan of uit' }, { status: 400 });

  await logImpersonatedWrite(session, body.aan ? 'doorlopend_aan' : 'doorlopend_uit', 'customer', session.customer.id);
  const supabase = createServerClient();
  const r = await zetDoorlopend(supabase, session.customer.id, body.aan, { soort: 'klant', naam: `Klant (${session.customer.name})` });
  if (!r.ok) return NextResponse.json({ error: r.fout }, { status: 409 });
  const status = await doorloopStatus(supabase, session.customer.id);
  return NextResponse.json({ ...status, magWijzigen: true });
}
