import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { controleerLeadToken, leadMagNogReageren } from '@/lib/leadAfspraakToken';
import { computeAvailableSlots, validateSlot } from '@/lib/appointmentSlots';

/**
 * Publieke route voor de lead: zijn eigen afspraak bekijken en erop reageren.
 *
 * Geen sessie, alleen het token uit de link. Daarom staat hier uitsluitend wat
 * de lead zelf al weet (zijn eigen afspraak) en nooit iets over de klant, de
 * batch of andere afspraken.
 */

export const dynamic = 'force-dynamic';

async function haalAfspraak(id: string, token: string) {
  if (!controleerLeadToken(id, token)) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('appointments')
    .select('id, starts_at, duration_minutes, status, branch, contact_name, street, house_number, postcode, city, customer_id, portal_user_id, lead_bevestigd_at, lead_reactie')
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get('t') || '';
  const afspraak = await haalAfspraak(id, token);
  if (!afspraak) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  const supabase = createServerClient();
  const [{ data: klant }, { data: branche }] = await Promise.all([
    supabase.from('customers').select('name').eq('id', afspraak.customer_id).maybeSingle(),
    supabase.from('branches').select('name').eq('slug', afspraak.branch).maybeSingle(),
  ]);

  /* Alleen de velden die de consument aangaan. customer_id en portal_user_id
     blijven bewust achter. */
  return NextResponse.json({
    afspraak: {
      id: afspraak.id,
      starts_at: afspraak.starts_at,
      duration_minutes: afspraak.duration_minutes,
      status: afspraak.status,
      contact_name: afspraak.contact_name,
      adres: [
        [afspraak.street, afspraak.house_number].filter(Boolean).join(' '),
        [afspraak.postcode, afspraak.city].filter(Boolean).join(' '),
      ].filter(Boolean).join(', '),
      bedrijf: klant?.name ?? 'Warme Leads',
      branche: branche?.name ?? afspraak.branch,
      lead_bevestigd_at: afspraak.lead_bevestigd_at,
      lead_reactie: afspraak.lead_reactie,
    },
    mag_reageren: leadMagNogReageren(afspraak),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get('t') || '';
  const afspraak = await haalAfspraak(id, token);
  if (!afspraak) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  if (!leadMagNogReageren(afspraak)) {
    return NextResponse.json(
      { error: 'Deze afspraak kan niet meer worden gewijzigd. Neem telefonisch contact op.' },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const supabase = createServerClient();
  const nu = new Date().toISOString();

  if (body.actie === 'bevestigen') {
    const { error } = await supabase
      .from('appointments')
      .update({ lead_bevestigd_at: nu, lead_reactie: 'bevestigd' })
      .eq('id', id);
    if (error) return NextResponse.json({ error: 'Bevestigen mislukt' }, { status: 500 });
    return NextResponse.json({ ok: true, reactie: 'bevestigd' });
  }

  if (body.actie === 'afzeggen') {
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: nu,
        cancelled_by: 'lead',
        cancelled_reason: typeof body.reden === 'string' && body.reden.trim()
          ? body.reden.trim().slice(0, 500)
          : 'Afgezegd door de klant via de bevestigingslink',
        lead_reactie: 'afgezegd',
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: 'Afzeggen mislukt' }, { status: 500 });
    return NextResponse.json({ ok: true, reactie: 'afgezegd' });
  }

  if (body.actie === 'slots') {
    const van = new Date(body.datum);
    if (Number.isNaN(van.getTime())) {
      return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 });
    }
    van.setHours(0, 0, 0, 0);
    const tot = new Date(van);
    tot.setHours(23, 59, 59, 999);
    const slots = await computeAvailableSlots({
      customerId: afspraak.customer_id,
      portalUserId: afspraak.portal_user_id,
      from: van,
      to: tot,
      durationMinutes: afspraak.duration_minutes,
      step: 30,
      excludeAppointmentId: afspraak.id,
    });
    return NextResponse.json({ slots });
  }

  if (body.actie === 'verzetten') {
    const nieuw = new Date(body.starts_at);
    if (Number.isNaN(nieuw.getTime())) {
      return NextResponse.json({ error: 'Kies een geldig moment' }, { status: 400 });
    }
    const check = await validateSlot({
      customerId: afspraak.customer_id,
      portalUserId: afspraak.portal_user_id,
      startsAt: nieuw,
      durationMinutes: afspraak.duration_minutes,
      excludeAppointmentId: afspraak.id,
    });
    if (!check.valid) {
      return NextResponse.json(
        { error: 'Dat moment is net bezet geraakt. Kies een andere tijd.' },
        { status: 409 },
      );
    }

    /* De lead schuift zijn eigen afspraak op. Anders dan bij het portaal maken
       we hier géén nieuwe rij aan: de link in zijn mailbox moet blijven werken,
       en een tweede rij zou hem naar een afspraak wijzen die niet meer bestaat. */
    const { error } = await supabase
      .from('appointments')
      .update({
        starts_at: nieuw.toISOString(),
        lead_reactie: 'verzet',
        lead_bevestigd_at: nu,
        reminder_sent_at: null,
        lead_reminder_sent_at: null,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: 'Verzetten mislukt' }, { status: 500 });
    return NextResponse.json({ ok: true, reactie: 'verzet', starts_at: nieuw.toISOString() });
  }

  return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 });
}
