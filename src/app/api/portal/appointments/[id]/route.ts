import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { createServerClient } from '@/lib/supabase';
import { validateSlot } from '@/lib/appointmentSlots';
import { controleerToewijzing } from '@/lib/appointmentAssignee';
import { sendAppointmentCancelledEmail } from '@/lib/appointmentEmails';
import { sendAppointmentPush } from '@/lib/pushNotification';
import { bronMagNogWijzigen, type Portaalkoppeling } from '@/lib/portaalkoppelingen';
import { syncAfsprakenBatch } from '@/lib/appointmentBatchSync';
import {
  bereidAfboekingVoor,
  mayTransition,
  isAppointmentStatus,
  STATUS_LABELS,
} from '@/lib/appointmentOutcome';

/**
 * Haalt een afspraak op die deze klant mag zien.
 *
 * Dat is zijn eigen agenda, én de afspraken die hij bij een gekoppeld portaal
 * heeft ingeboekt. Die laatste staan in de agenda van een ander, dus filteren
 * op customer_id alleen zou ze onvindbaar maken voor de partij die ze maakte.
 */
async function loadAppointment(id: string, customerId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .or(`customer_id.eq.${customerId},geboekt_door_customer_id.eq.${customerId}`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Of deze klant deze afspraak mag wijzigen.
 *
 * De eigenaar van de agenda mag altijd. Heeft een ander hem ingeboekt, dan
 * mag die alleen binnen de afspraken van de koppeling: standaard tot de
 * ontvanger hem bevestigt.
 */
async function magWijzigen(
  appt: { customer_id: string; geboekt_door_customer_id?: string | null; koppeling_id?: string | null; bevestigd_at?: string | null; status?: string | null },
  customerId: string,
): Promise<{ ok: true } | { ok: false; reden: string }> {
  if (appt.customer_id === customerId) return { ok: true };
  if (appt.geboekt_door_customer_id !== customerId) return { ok: false, reden: 'Geen toegang' };

  if (!appt.koppeling_id) {
    return { ok: false, reden: 'Deze afspraak hoort bij een klant waar je geen koppeling (meer) mee hebt' };
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from('portaalkoppelingen')
    .select('*')
    .eq('id', appt.koppeling_id)
    .eq('actief', true)
    .maybeSingle();

  if (!data) return { ok: false, reden: 'De koppeling met deze klant is niet meer actief' };
  if (!bronMagNogWijzigen(data as Portaalkoppeling, appt)) {
    return {
      ok: false,
      reden: 'Deze afspraak is al bevestigd door de klant. Neem contact met ze op om hem te wijzigen.',
    };
  }
  return { ok: true };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) return forbidden();
  const { id } = await params;
  const appt = await loadAppointment(id, session.customer.id);
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  if (session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    if (appt.portal_user_id !== session.portalUser.id) {
      return forbidden('Geen toegang');
    }
  }
  return NextResponse.json(appt);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const { id } = await params;
  const appt = await loadAppointment(id, session.customer.id);
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  const toestemming = await magWijzigen(appt, session.customer.id);
  if (!toestemming.ok) return NextResponse.json({ error: toestemming.reden }, { status: 403 });

  if (appt.customer_id === session.customer.id && session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    if (appt.portal_user_id !== session.portalUser.id) {
      return forbidden('Geen toegang');
    }
  }

  const body = await request.json();
  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};

  const allowed = [
    'contact_name', 'contact_phone', 'contact_email', 'street', 'house_number',
    'postcode', 'city', 'notes',
  ];
  for (const k of allowed) if (k in body) updates[k] = body[k];

  // Reschedule?
  if (body.starts_at || body.duration_minutes || body.travel_buffer_minutes != null) {
    const startsAt = new Date(body.starts_at || appt.starts_at);
    const duration = body.duration_minutes ?? appt.duration_minutes;
    const buffer = body.travel_buffer_minutes ?? appt.travel_buffer_minutes;
    if (isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'Ongeldige starts_at' }, { status: 400 });
    }
    /* De adviseur zoals hij ná deze wijziging is. Stond hier eerder altijd de
       oude adviseur, waardoor verplaatsen én herverdelen in één handeling de
       beschikbaarheid van de verkeerde persoon controleerde. De adminroute
       deed dit al goed; nu doen ze hetzelfde. */
    const adviseurNa =
      body.portal_user_id !== undefined ? (body.portal_user_id || null) : appt.portal_user_id;

    const validation = await validateSlot({
      customerId: session.customer.id,
      portalUserId: adviseurNa,
      startsAt,
      durationMinutes: duration,
      bufferMinutes: buffer,
      excludeAppointmentId: appt.id,
    });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason || 'Slot niet beschikbaar' }, { status: 409 });
    }
    updates.starts_at = startsAt.toISOString();
    updates.duration_minutes = duration;
    updates.travel_buffer_minutes = buffer;
    if (appt.status !== 'rescheduled' && body.starts_at && body.starts_at !== appt.starts_at) {
      updates.status = 'scheduled';
    }
  }

  /* Herverdelen. Alleen voor niet-agents: een agent mag zijn afspraak niet aan
     een collega doorschuiven. */
  if (body.portal_user_id !== undefined && (!session.portalUser || session.portalUser.role !== 'agent')) {
    const nieuweAdviseur = body.portal_user_id || null;

    /* Wijzigt alleen de adviseur, dan kwam hier voorheen geen enkele controle
       aan te pas en kon dezelfde persoon twee afspraken op hetzelfde moment
       krijgen. validateSlot is hier niet bruikbaar: die weigert alles in het
       verleden, terwijl een afspraak van gisteren alsnog toewijzen moet kunnen. */
    if (nieuweAdviseur !== appt.portal_user_id) {
      const uitkomst = await controleerToewijzing(supabase, {
        customerId: appt.customer_id,
        afspraak: {
          id: appt.id,
          starts_at: (updates.starts_at as string) || appt.starts_at,
          duration_minutes: (updates.duration_minutes as number) ?? appt.duration_minutes,
          travel_buffer_minutes: (updates.travel_buffer_minutes as number) ?? appt.travel_buffer_minutes,
        },
        nieuweAdviseurId: nieuweAdviseur,
        forceer: body.forceer_toewijzing === true,
      });
      if (!uitkomst.ok) {
        return NextResponse.json(
          { error: uitkomst.conflict, conflict: true, conflicten: uitkomst.conflicten.length },
          { status: 409 },
        );
      }
    }

    updates.portal_user_id = nieuweAdviseur;
  }

  /* Afboeken. De regels staan in appointmentOutcome zodat portaal, admin en
     API het niet ieder net iets anders kunnen doen. */
  if (body.status) {
    const nieuweStatus: unknown = body.status;
    if (!isAppointmentStatus(nieuweStatus)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
    }
    const huidig: unknown = appt.status;
    if (!isAppointmentStatus(huidig) || !mayTransition(huidig, nieuweStatus)) {
      const vanaf = isAppointmentStatus(huidig) ? STATUS_LABELS[huidig] : String(huidig);
      return NextResponse.json(
        { error: `Een afspraak met status "${vanaf}" kan niet naar "${STATUS_LABELS[nieuweStatus]}"` },
        { status: 409 },
      );
    }

    const afboeking = bereidAfboekingVoor({
      status: nieuweStatus,
      outcome: body.outcome,
      outcome_reason: body.outcome_reason,
      deal_value: body.deal_value,
      cancelled_by: body.cancelled_by,
    });
    if (!afboeking.ok) {
      return NextResponse.json({ error: afboeking.fout }, { status: 400 });
    }
    Object.assign(updates, afboeking.velden);

    if (body.cancelled_reason !== undefined) {
      updates.cancelled_reason = body.cancelled_reason || null;
    }
    if (body.outcome_notes !== undefined) {
      updates.outcome_notes = body.outcome_notes || null;
    }
    updates.outcome_by_portal_user_id = session.portalUser?.id ?? null;
  } else if (body.outcome_notes !== undefined) {
    updates.outcome_notes = body.outcome_notes || null;
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('[portal/appointments PATCH]', error);
    return NextResponse.json({ error: 'Bewerken mislukt' }, { status: 500 });
  }

  /* Annuleren geeft een plek terug aan de batch, afboeken houdt hem bezet. */
  if (updates.status) await syncAfsprakenBatch(supabase, appt.batch_id);

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_EDIT)) return forbidden();

  const { id } = await params;
  const appt = await loadAppointment(id, session.customer.id);
  if (!appt) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  if (session.portalUser && session.portalUser.role === 'agent' && !hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL)) {
    if (appt.portal_user_id !== session.portalUser.id) return forbidden('Geen toegang');
  }

  const supabase = createServerClient();
  // Soft-cancel instead of hard delete (keeps history)
  const { error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_reason: 'Geannuleerd via portaal',
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Annuleren mislukt' }, { status: 500 });

  await syncAfsprakenBatch(supabase, appt.batch_id);

  (async () => {
    try {
      const [branchRes, assigneeRes] = await Promise.all([
        supabase.from('branches').select('name').eq('slug', appt.branch).maybeSingle(),
        appt.portal_user_id
          ? supabase.from('portal_users').select('name, email').eq('id', appt.portal_user_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const branchName = (branchRes.data as { name?: string } | null)?.name;
      const assignee = (assigneeRes.data as { name?: string; email?: string } | null) || null;
      await sendAppointmentCancelledEmail(
        {
          name: session.customer.name,
          email: session.customer.email,
          contact_person: session.customer.contact_person,
        },
        { ...appt, branchName, portal_user_name: assignee?.name || null },
        'Geannuleerd via portaal',
      );
      const whenLabel = new Date(appt.starts_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendAppointmentPush(session.customer.id, 'cancelled', {
        contactName: appt.contact_name,
        whenLabel,
        appointmentId: appt.id,
      });
    } catch (e) {
      console.error('[portal/appointments DELETE notify]', e);
    }
  })().catch(() => {});

  return NextResponse.json({ success: true });
}
