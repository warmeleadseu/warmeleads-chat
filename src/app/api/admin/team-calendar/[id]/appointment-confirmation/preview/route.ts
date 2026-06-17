import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import {
  buildConfirmationPreview,
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
      return 'Preview kon niet worden opgebouwd.';
  }
}

/**
 * Geeft een preview van de afspraakbevestigingsmail terug (subject, html, to)
 * zonder iets te versturen. De accountmanager controleert deze in de
 * EmailPreviewModal voordat hij akkoord geeft.
 */
export async function GET(
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

  // Alleen de eigenaar of een (super)admin mag de afspraak/mail beheren.
  const { data: ownerRow } = await supabase
    .from('team_calendar_events')
    .select('created_by')
    .eq('id', params.id)
    .single();
  const isOwner = ownerRow?.created_by === admin.id;
  const canManage = admin.role === 'admin' || admin.role === 'superadmin';
  if (!isOwner && !canManage) return forbidden();

  const built = await buildConfirmationPreview(supabase, {
    event,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  });

  if (!built.ok) {
    return NextResponse.json(
      { error: built.result.error || skipMessage(built.result.skipped_reason) },
      { status: 422 },
    );
  }

  const { data: sentRow } = await supabase
    .from('team_calendar_events')
    .select('confirmation_sent_at')
    .eq('id', params.id)
    .single();

  return NextResponse.json({
    subject: built.preview.subject,
    html: built.preview.html,
    to: built.preview.to,
    summary: {
      recipient_company: built.preview.recipientCompany,
      already_sent_at: sentRow?.confirmation_sent_at ?? null,
    },
  });
}
