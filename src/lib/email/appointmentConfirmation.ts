import { sendAsAdmin } from './sendAsAdmin';

export type AppointmentVisitType =
  | 'customer_visit'
  | 'prospect_visit'
  | 'internal'
  | 'external_event'
  | 'vacation'
  | 'other';

export interface AppointmentConfirmationInput {
  /** AM die afzendt; bepaalt de from-line en reply-to. */
  admin: { id: string; name: string; email: string };
  recipient: {
    email: string;
    name?: string | null;
    /** Bedrijfsnaam (klant of prospect) om in de aanhef te tonen. */
    company?: string | null;
  };
  event: {
    id: string;
    title: string;
    event_type: AppointmentVisitType;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    location?: string | null;
    description?: string | null;
  };
  /** prospect_id of customer_id voor email_log-koppeling. */
  prospectId?: string | null;
  customerId?: string | null;
}

const TZ = 'Europe/Amsterdam';

function formatDutchDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
}

function formatDutchTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Bouwt de afspraakbevestiging (subject + HTML + tekst) zonder te versturen,
 * zodat dezelfde functie zowel de preview als de daadwerkelijke verzending
 * voedt en de AM exact ziet wat de klant/prospect ontvangt.
 */
export function renderAppointmentConfirmation(
  input: AppointmentConfirmationInput,
): { subject: string; html: string; text: string } {
  const { admin, recipient, event } = input;
  const greeting = recipient.name?.split(' ')[0] || recipient.company || '';
  const dateLabel = formatDutchDate(event.starts_at);
  const timeRange = event.all_day
    ? 'Hele dag'
    : `${formatDutchTime(event.starts_at)} tot ${formatDutchTime(event.ends_at)} (NL-tijd)`;

  const subject = event.all_day
    ? `Bevestiging afspraak met ${admin.name} op ${dateLabel}`
    : `Bevestiging afspraak met ${admin.name} op ${dateLabel} om ${formatDutchTime(event.starts_at)}`;

  const safeTitle = escapeHtml(event.title);
  const safeAdminName = escapeHtml(admin.name);
  const safeLocation = event.location ? escapeHtml(event.location) : '';
  const safeDescription = event.description
    ? escapeHtml(event.description).replace(/\n/g, '<br>')
    : '';

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#6366F1 35%,#8B5CF6 70%,#E74C8C 100%);border-radius:14px 14px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:36px 40px 12px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;color:#8B5CF6;text-transform:uppercase">Bevestiging afspraak</p>
          <h1 style="margin:0 0 18px;font-size:22px;font-weight:800;line-height:1.25;color:#0f172a">${safeTitle}</h1>
          ${greeting ? `<p style="margin:0 0 8px;font-size:15px;color:#0f172a">Hallo ${escapeHtml(greeting)},</p>` : ''}
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#475569">
            ${safeAdminName} heeft een afspraak met je ingepland. Hieronder vind je de details.
            Klopt er iets niet of wil je verzetten? Reply gerust op deze mail.
          </p>
        </td></tr>
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:0 40px 8px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #ede9fe;background:#f5f3ff;border-radius:12px;overflow:hidden">
            <tr><td style="padding:18px 22px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#6d28d9;text-transform:uppercase">Wanneer</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#3b0764">${escapeHtml(dateLabel)}</p>
              <p style="margin:2px 0 0;font-size:14px;color:#6d28d9">${escapeHtml(timeRange)}</p>
              ${
                safeLocation
                  ? `<p style="margin:14px 0 4px;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#6d28d9;text-transform:uppercase">Waar</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#3b0764">${safeLocation}</p>`
                  : ''
              }
            </td></tr>
          </table>
        </td></tr>
        ${
          safeDescription
            ? `
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:20px 40px 0">
          <div style="border-left:3px solid #ddd6fe;background:#f8fafc;padding:14px 18px;border-radius:0 10px 10px 0">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#64748b;text-transform:uppercase">Toelichting</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#334155">${safeDescription}</p>
          </div>
        </td></tr>`
            : ''
        }
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:24px 40px 28px">
          <p style="margin:0;font-size:13px;line-height:1.65;color:#64748b">
            Tot dan! Vragen vooraf? Reply gerust op deze mail of bel ${safeAdminName} direct.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:18px 40px">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
            ${safeAdminName} · WarmeLeads<br>
            <a href="https://www.warmeleads.eu" style="color:#94a3b8;text-decoration:none">warmeleads.eu</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    greeting ? `Hallo ${greeting},` : '',
    '',
    `${admin.name} heeft een afspraak met je ingepland. Hieronder de details.`,
    '',
    `Onderwerp: ${event.title}`,
    `Wanneer: ${dateLabel} · ${timeRange}`,
    event.location ? `Waar: ${event.location}` : '',
    '',
    event.description ? `Toelichting: ${event.description}\n` : '',
    `Klopt er iets niet of wil je verzetten? Reply gerust op deze mail.`,
    '',
    `${admin.name} · WarmeLeads`,
    'warmeleads.eu',
  ]
    .filter(line => line !== null && line !== undefined)
    .join('\n');

  return { subject, html, text };
}

/**
 * Verstuurt de afspraakbevestiging vanuit het AM-mailadres met Reply-To naar
 * de AM. Scope 'all' (transactioneel) en bypassOptOut: het is een directe
 * afspraakbevestiging, geen marketing-uiting.
 */
export async function sendAppointmentConfirmation(input: AppointmentConfirmationInput) {
  const { subject, html, text } = renderAppointmentConfirmation(input);
  return sendAsAdmin({
    admin: input.admin,
    to: input.recipient.email,
    toName: input.recipient.name || input.recipient.company || undefined,
    subject,
    html,
    text,
    scope: 'all',
    bypassOptOut: true,
    prospectId: input.prospectId ?? null,
    customerId: input.customerId ?? null,
    templateKey: 'team_calendar_appointment_confirmation',
    templateOptions: {
      event_id: input.event.id,
      event_type: input.event.event_type,
      starts_at: input.event.starts_at,
    },
    metadata: { event_id: input.event.id },
  });
}
