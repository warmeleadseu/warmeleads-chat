import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import {
  deliverAppointmentConfirmation,
  loadEventForConfirmation,
  type ConfirmationSkipReason,
} from '@/lib/email/deliverAppointmentConfirmation';

export const runtime = 'nodejs';

function skipMessage(reason: ConfirmationSkipReason | undefined): string {
  switch (reason) {
    case 'admin_email_not_warmeleads':
      return 'Je e-mailadres is geen @warmeleads.eu-adres; je kunt geen bevestiging versturen.';
    case 'no_linked_recipient':
      return 'Koppel een klant of prospect aan deze afspraak om een bevestiging te kunnen sturen.';
    case 'no_recipient_email':
      return 'Bij de gekoppelde klant of prospect is geen e-mailadres bekend.';
    case 'event_not_found':
      return 'Afspraak niet gevonden.';
    default:
      return 'Versturen van de bevestiging mislukt.';
  }
}

/**
 * Verstuurt de afspraakbevestiging naar de gekoppelde klant of prospect nadat
 * de accountmanager de preview heeft geakkordeerd.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const event = await loadEventForConfirmation(supabase, params.id);
  if (!event) {
    return NextResponse.json({ error: skipMessage('event_not_found') }, { status: 404 });
  }

  const { data: ownerRow } = await supabase
    .from('team_calendar_events')
    .select('created_by')
    .eq('id', params.id)
    .single();
  const isOwner = ownerRow?.created_by === admin.id;
  const canManage = admin.role === 'admin' || admin.role === 'superadmin';
  if (!isOwner && !canManage) return forbidden();

  const result = await deliverAppointmentConfirmation(supabase, {
    event,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || skipMessage(result.skipped_reason) },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, recipient_email: result.recipient_email });
}
