import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { validateSlot } from '@/lib/appointmentSlots';

/**
 * Een afspraak verzetten naar een nieuw moment.
 *
 * Bewust géén datumwijziging op de bestaande rij. De oude afspraak blijft staan
 * met status 'rescheduled' en de nieuwe wijst er via `rescheduled_from_id` naar
 * terug. Daardoor is achteraf te zien dat een lead drie keer heeft uitgesteld
 * voordat hij afzegde, wat met het oude gedrag (simpelweg de datum opschuiven)
 * onzichtbaar was.
 */

/** Velden die een opvolger erft van de afspraak die hij vervangt. */
const OVERERFDE_VELDEN = [
  'customer_id', 'branch', 'lead_id', 'lead_assignment_id', 'batch_id',
  'portal_user_id', 'contact_name', 'contact_phone', 'contact_email',
  'street', 'house_number', 'postcode', 'city', 'notes',
] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: appt } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .eq('customer_id', session.customer.id)
    .maybeSingle();
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  if (
    session.portalUser &&
    session.portalUser.role === 'agent' &&
    !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL) &&
    appt.portal_user_id !== session.portalUser.id
  ) {
    return forbidden('Geen toegang');
  }

  if (appt.status === 'rescheduled') {
    return NextResponse.json(
      { error: 'Deze afspraak is al verzet. Verzet de opvolger.' },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const startsAt = new Date(body.starts_at);
  if (!body.starts_at || Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: 'Geef een geldig nieuw moment op' }, { status: 400 });
  }

  const duration = Number(body.duration_minutes ?? appt.duration_minutes);
  const buffer = Number(body.travel_buffer_minutes ?? appt.travel_buffer_minutes);
  const portalUserId = body.portal_user_id !== undefined ? body.portal_user_id : appt.portal_user_id;

  /* De oude afspraak uitsluiten van de bezettingscontrole: hij verdwijnt zo
     toch uit de agenda, dus hij mag zijn eigen opvolger niet blokkeren. */
  const validation = await validateSlot({
    customerId: session.customer.id,
    portalUserId,
    startsAt,
    durationMinutes: duration,
    bufferMinutes: buffer,
    excludeAppointmentId: appt.id,
  });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.reason || 'Slot niet beschikbaar' }, { status: 409 });
  }

  const nieuweRij: Record<string, unknown> = {};
  for (const veld of OVERERFDE_VELDEN) nieuweRij[veld] = appt[veld];
  Object.assign(nieuweRij, {
    portal_user_id: portalUserId,
    starts_at: startsAt.toISOString(),
    duration_minutes: duration,
    travel_buffer_minutes: buffer,
    status: 'scheduled',
    source: appt.source,
    rescheduled_from_id: appt.id,
    created_by_portal_user_id: session.portalUser?.id ?? null,
  });

  const { data: nieuw, error: insErr } = await supabase
    .from('appointments')
    .insert(nieuweRij)
    .select('*')
    .single();

  if (insErr || !nieuw) {
    console.error('[portal/appointments verzetten] insert', insErr);
    return NextResponse.json({ error: 'Verzetten mislukt' }, { status: 500 });
  }

  /* Pas de oude rij sluiten als de opvolger er staat. Andersom zou een
     mislukte insert de afspraak uit de agenda laten verdwijnen zonder dat er
     iets voor in de plaats komt. */
  const { error: updErr } = await supabase
    .from('appointments')
    .update({
      status: 'rescheduled',
      cancelled_reason: typeof body.reden === 'string' && body.reden.trim() ? body.reden.trim() : null,
    })
    .eq('id', appt.id);

  if (updErr) {
    console.error('[portal/appointments verzetten] oude rij sluiten', updErr);
    await supabase.from('appointments').delete().eq('id', nieuw.id);
    return NextResponse.json({ error: 'Verzetten mislukt' }, { status: 500 });
  }

  return NextResponse.json({ appointment: nieuw, vervangt: appt.id });
}
