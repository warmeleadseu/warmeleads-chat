import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { magReclameren, isGeldigeReden } from '@/lib/afspraakReclamatie';

/** Reclamaties die de klant zelf indient op geleverde afspraken. */

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.RECLAMATIONS_CREATE)) return forbidden();

  const appointmentId = request.nextUrl.searchParams.get('appointment_id');
  const supabase = createServerClient();

  if (!appointmentId) {
    const { data } = await supabase
      .from('afspraak_reclamaties')
      .select('*, appointments(starts_at, contact_name, city, branch)')
      .eq('customer_id', session.customer.id)
      .order('created_at', { ascending: false })
      .limit(500);
    return NextResponse.json({ reclamaties: data ?? [] });
  }

  const { data: afspraak } = await supabase
    .from('appointments')
    .select('id, starts_at, status, batch_id')
    .eq('id', appointmentId)
    .eq('customer_id', session.customer.id)
    .maybeSingle();

  if (!afspraak) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  const { data: bestaande } = await supabase
    .from('afspraak_reclamaties')
    .select('*')
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  const geschikt = magReclameren(afspraak, bestaande, new Date());

  return NextResponse.json({
    reclamatie: bestaande,
    mag: geschikt.mag,
    blokkade: geschikt.mag ? null : geschikt.reden,
  });
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.RECLAMATIONS_CREATE)) return forbidden();

  const body = await request.json().catch(() => ({}));
  const { appointment_id, reason, description } = body;

  if (!appointment_id || !reason) {
    return NextResponse.json({ error: 'appointment_id en reason zijn verplicht' }, { status: 400 });
  }
  if (!isGeldigeReden(reason)) {
    return NextResponse.json({ error: 'Onbekende reden' }, { status: 400 });
  }

  const supabase = createServerClient();

  /* Alleen op je eigen afspraken. Zonder deze controle kan een klant met een
     gegokt id reclameren op de afspraak van een ander. */
  const { data: afspraak } = await supabase
    .from('appointments')
    .select('id, starts_at, status, batch_id')
    .eq('id', appointment_id)
    .eq('customer_id', session.customer.id)
    .maybeSingle();

  if (!afspraak) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  const { data: bestaande } = await supabase
    .from('afspraak_reclamaties')
    .select('id, status')
    .eq('appointment_id', appointment_id)
    .maybeSingle();

  const geschikt = magReclameren(afspraak, bestaande, new Date());
  if (!geschikt.mag) {
    return NextResponse.json({ error: geschikt.reden }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('afspraak_reclamaties')
    .insert({
      appointment_id,
      customer_id: session.customer.id,
      reason,
      description: description?.trim() || null,
      ingediend_door_portal_user_id: session.portalUser?.id ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Er loopt al een reclamatie op deze afspraak' }, { status: 409 });
    }
    console.error('[portal/afspraak-reclamaties POST]', error.message);
    return NextResponse.json({ error: 'Indienen mislukt' }, { status: 500 });
  }

  return NextResponse.json(data);
}
