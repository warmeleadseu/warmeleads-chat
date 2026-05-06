import { createServerClient } from '@/lib/supabase';
import { ALLOWED_FROM_DOMAIN } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { sendVideocallInvite } from './videocallInvite';

export interface InviteResult {
  ok: boolean;
  recipient_email?: string | null;
  error?: string;
  skipped_reason?: string;
}

export interface DeliverInviteArgs {
  eventId: string;
  admin: { id: string; name: string; email: string };
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  meetingUrl: string;
  customerId: string | null;
  prospectId: string | null;
}

/**
 * Stuurt een videocall-uitnodiging naar de aan een team-agenda-event
 * gekoppelde klant of prospect, en updatet de event-rij met
 * `meeting_invite_sent_at` + de email_log-koppeling.
 */
export async function deliverVideocallInvite(
  supabase: ReturnType<typeof createServerClient>,
  args: DeliverInviteArgs,
): Promise<InviteResult> {
  const fromDomain = args.admin.email.split('@')[1]?.toLowerCase();
  if (fromDomain !== ALLOWED_FROM_DOMAIN) {
    return {
      ok: false,
      skipped_reason: 'admin_email_not_warmeleads',
      error: `Verzenden alleen toegestaan vanaf @${ALLOWED_FROM_DOMAIN}`,
    };
  }

  let recipientEmail: string | null = null;
  let recipientName: string | null = null;
  let recipientCompany: string | null = null;
  if (args.customerId) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, contact_person')
      .eq('id', args.customerId)
      .single();
    if (data) {
      recipientEmail = data.email || null;
      recipientName = data.contact_person || null;
      recipientCompany = data.name || null;
    }
  } else if (args.prospectId) {
    const { data } = await supabase
      .from('prospects')
      .select('id, company_name, email, contact_person')
      .eq('id', args.prospectId)
      .single();
    if (data) {
      recipientEmail = data.email || null;
      recipientName = data.contact_person || null;
      recipientCompany = data.company_name || null;
    }
  } else {
    return { ok: false, skipped_reason: 'no_linked_recipient' };
  }

  if (!recipientEmail) {
    return { ok: false, skipped_reason: 'no_recipient_email' };
  }

  const result = await sendVideocallInvite({
    admin: args.admin,
    recipient: {
      email: recipientEmail,
      name: recipientName,
      company: recipientCompany,
    },
    event: {
      id: args.eventId,
      title: args.title,
      starts_at: args.startsAt,
      ends_at: args.endsAt,
      all_day: args.allDay,
      description: args.description,
      meeting_url: args.meetingUrl,
    },
    customerId: args.customerId,
    prospectId: args.prospectId,
  });

  if (result.ok) {
    await supabase
      .from('team_calendar_events')
      .update({
        meeting_invite_sent_at: new Date().toISOString(),
        meeting_invite_email_log_id: result.emailLogId || null,
      })
      .eq('id', args.eventId);
    logAudit({
      adminId: args.admin.id,
      adminName: args.admin.name,
      action: 'calendar.videocall_invite_sent',
      entityType: 'team_calendar_event',
      entityId: args.eventId,
      details: { recipient_email: recipientEmail, meeting_url: args.meetingUrl },
    }).catch(() => {});
  }

  return {
    ok: result.ok,
    recipient_email: recipientEmail,
    error: result.error,
  };
}
