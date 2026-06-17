import { createServerClient } from '@/lib/supabase';
import { ALLOWED_FROM_DOMAIN } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import {
  renderAppointmentConfirmation,
  sendAppointmentConfirmation,
  type AppointmentVisitType,
} from './appointmentConfirmation';

export type ConfirmationSkipReason =
  | 'admin_email_not_warmeleads'
  | 'no_linked_recipient'
  | 'no_recipient_email'
  | 'event_not_found';

export interface ConfirmationResult {
  ok: boolean;
  recipient_email?: string | null;
  error?: string;
  skipped_reason?: ConfirmationSkipReason;
}

interface EventForConfirmation {
  id: string;
  title: string;
  description: string | null;
  event_type: AppointmentVisitType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  customer_id: string | null;
  prospect_id: string | null;
}

interface ResolvedRecipient {
  email: string | null;
  name: string | null;
  company: string | null;
}

const SELECT_EVENT =
  'id, title, description, event_type, starts_at, ends_at, all_day, location, customer_id, prospect_id';

/**
 * Haalt het team-agenda-event op dat we willen bevestigen. Geeft `null` terug
 * als het niet bestaat.
 */
export async function loadEventForConfirmation(
  supabase: ReturnType<typeof createServerClient>,
  eventId: string,
): Promise<EventForConfirmation | null> {
  const { data } = await supabase
    .from('team_calendar_events')
    .select(SELECT_EVENT)
    .eq('id', eventId)
    .single();
  return (data as EventForConfirmation | null) ?? null;
}

/**
 * Bepaalt de ontvanger (e-mail, contactpersoon, bedrijfsnaam) op basis van de
 * aan het event gekoppelde klant of prospect. Spiegelt de logica van de
 * videocall-uitnodiging zodat beide flows hetzelfde gedrag tonen.
 */
export async function resolveConfirmationRecipient(
  supabase: ReturnType<typeof createServerClient>,
  event: Pick<EventForConfirmation, 'customer_id' | 'prospect_id'>,
): Promise<ResolvedRecipient | null> {
  if (event.customer_id) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, contact_person')
      .eq('id', event.customer_id)
      .single();
    if (!data) return null;
    return {
      email: data.email || null,
      name: data.contact_person || null,
      company: data.name || null,
    };
  }
  if (event.prospect_id) {
    const { data } = await supabase
      .from('prospects')
      .select('id, company_name, email, contact_person')
      .eq('id', event.prospect_id)
      .single();
    if (!data) return null;
    return {
      email: data.email || null,
      name: data.contact_person || null,
      company: data.company_name || null,
    };
  }
  return null;
}

export interface ConfirmationPreview {
  subject: string;
  html: string;
  to: { email: string; name: string };
  recipientCompany: string | null;
}

/**
 * Bouwt de preview van de afspraakbevestiging voor een bestaand event, zonder
 * iets te versturen. Geeft een `skipped_reason` terug als er geen geldige
 * ontvanger of afzender is.
 */
export async function buildConfirmationPreview(
  supabase: ReturnType<typeof createServerClient>,
  args: { event: EventForConfirmation; admin: { id: string; name: string; email: string } },
): Promise<{ ok: true; preview: ConfirmationPreview } | { ok: false; result: ConfirmationResult }> {
  const fromDomain = args.admin.email.split('@')[1]?.toLowerCase();
  if (fromDomain !== ALLOWED_FROM_DOMAIN) {
    return {
      ok: false,
      result: {
        ok: false,
        skipped_reason: 'admin_email_not_warmeleads',
        error: `Verzenden alleen toegestaan vanaf @${ALLOWED_FROM_DOMAIN}`,
      },
    };
  }

  const recipient = await resolveConfirmationRecipient(supabase, args.event);
  if (!recipient) {
    return { ok: false, result: { ok: false, skipped_reason: 'no_linked_recipient' } };
  }
  if (!recipient.email) {
    return { ok: false, result: { ok: false, skipped_reason: 'no_recipient_email' } };
  }

  const { subject, html } = renderAppointmentConfirmation({
    admin: args.admin,
    recipient: { email: recipient.email, name: recipient.name, company: recipient.company },
    event: {
      id: args.event.id,
      title: args.event.title,
      event_type: args.event.event_type,
      starts_at: args.event.starts_at,
      ends_at: args.event.ends_at,
      all_day: args.event.all_day,
      location: args.event.location,
      description: args.event.description,
    },
    customerId: args.event.customer_id,
    prospectId: args.event.prospect_id,
  });

  return {
    ok: true,
    preview: {
      subject,
      html,
      to: { email: recipient.email, name: recipient.name || recipient.company || recipient.email },
      recipientCompany: recipient.company,
    },
  };
}

/**
 * Verstuurt de afspraakbevestiging naar de gekoppelde klant of prospect en
 * werkt de event-rij bij met `confirmation_sent_at` + de email_log-koppeling.
 */
export async function deliverAppointmentConfirmation(
  supabase: ReturnType<typeof createServerClient>,
  args: { event: EventForConfirmation; admin: { id: string; name: string; email: string } },
): Promise<ConfirmationResult> {
  const built = await buildConfirmationPreview(supabase, args);
  if (!built.ok) return built.result;

  const recipient = await resolveConfirmationRecipient(supabase, args.event);
  if (!recipient?.email) {
    return { ok: false, skipped_reason: 'no_recipient_email' };
  }

  const result = await sendAppointmentConfirmation({
    admin: args.admin,
    recipient: { email: recipient.email, name: recipient.name, company: recipient.company },
    event: {
      id: args.event.id,
      title: args.event.title,
      event_type: args.event.event_type,
      starts_at: args.event.starts_at,
      ends_at: args.event.ends_at,
      all_day: args.event.all_day,
      location: args.event.location,
      description: args.event.description,
    },
    customerId: args.event.customer_id,
    prospectId: args.event.prospect_id,
  });

  if (result.ok) {
    await supabase
      .from('team_calendar_events')
      .update({
        confirmation_sent_at: new Date().toISOString(),
        confirmation_email_log_id: result.emailLogId || null,
      })
      .eq('id', args.event.id);
    logAudit({
      adminId: args.admin.id,
      adminName: args.admin.name,
      action: 'calendar.appointment_confirmation_sent',
      entityType: 'team_calendar_event',
      entityId: args.event.id,
      details: { recipient_email: recipient.email, event_type: args.event.event_type },
    }).catch(() => {});
  }

  return {
    ok: result.ok,
    recipient_email: recipient.email,
    error: result.error,
  };
}
