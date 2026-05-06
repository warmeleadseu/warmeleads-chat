import { sendAsAdmin } from './sendAsAdmin';

export interface VideocallInviteInput {
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
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    description?: string | null;
    meeting_url: string;
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
 * Detecteert het video-platform op basis van de URL zodat we de mail
 * provider-bewust kunnen formuleren ("Google Meet" / "Zoom" / etc).
 */
export function detectMeetingProvider(url: string): {
  key: 'google_meet' | 'zoom' | 'teams' | 'whereby' | 'jitsi' | 'other';
  label: string;
} {
  const u = url.toLowerCase();
  if (u.includes('meet.google.com')) return { key: 'google_meet', label: 'Google Meet' };
  if (u.includes('zoom.us') || u.includes('zoom.com')) return { key: 'zoom', label: 'Zoom' };
  if (u.includes('teams.microsoft.com') || u.includes('teams.live.com'))
    return { key: 'teams', label: 'Microsoft Teams' };
  if (u.includes('whereby.com')) return { key: 'whereby', label: 'Whereby' };
  if (u.includes('meet.jit.si') || u.includes('jitsi')) return { key: 'jitsi', label: 'Jitsi Meet' };
  return { key: 'other', label: 'Videocall' };
}

function renderHtml(input: VideocallInviteInput): { subject: string; html: string; text: string } {
  const { admin, recipient, event } = input;
  const greeting = recipient.name?.split(' ')[0] || recipient.company || '';
  const dateLabel = formatDutchDate(event.starts_at);
  const timeRange = event.all_day
    ? 'Hele dag'
    : `${formatDutchTime(event.starts_at)} – ${formatDutchTime(event.ends_at)} (NL-tijd)`;
  const provider = detectMeetingProvider(event.meeting_url);

  const subject = event.all_day
    ? `Videocall met ${admin.name} op ${formatDutchDate(event.starts_at)}`
    : `Videocall met ${admin.name} op ${formatDutchDate(event.starts_at)} om ${formatDutchTime(event.starts_at)}`;

  const safeTitle = escapeHtml(event.title);
  const safeDescription = event.description ? escapeHtml(event.description).replace(/\n/g, '<br>') : '';
  const safeAdminName = escapeHtml(admin.name);
  const safeUrl = escapeHtml(event.meeting_url);
  const safeProvider = escapeHtml(provider.label);

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#6366F1 35%,#8B5CF6 70%,#E74C8C 100%);border-radius:14px 14px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:36px 40px 12px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;color:#6366F1;text-transform:uppercase">Uitnodiging videocall</p>
          <h1 style="margin:0 0 18px;font-size:22px;font-weight:800;line-height:1.25;color:#0f172a">${safeTitle}</h1>
          ${greeting ? `<p style="margin:0 0 8px;font-size:15px;color:#0f172a">Hallo ${escapeHtml(greeting)},</p>` : ''}
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#475569">
            ${safeAdminName} heeft een videocall met je ingepland. Klik op het afgesproken moment
            op de knop hieronder om direct mee te doen.
          </p>
        </td></tr>
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:0 40px 8px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e0e7ff;background:#eef2ff;border-radius:12px;overflow:hidden">
            <tr><td style="padding:18px 22px">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#4338ca;text-transform:uppercase">Wanneer</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#1e1b4b">${escapeHtml(dateLabel)}</p>
              <p style="margin:2px 0 0;font-size:14px;color:#4338ca">${escapeHtml(timeRange)}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:18px 40px 0;text-align:center">
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto">
            <tr><td style="border-radius:12px;background:linear-gradient(135deg,#6366F1 0%,#4F46E5 100%);box-shadow:0 8px 24px rgba(79,70,229,0.25)">
              <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:16px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px">
                Deelnemen aan de videocall
              </a>
            </td></tr>
          </table>
          <p style="margin:14px 0 0;font-size:12px;color:#94a3b8">Of kopieer deze link in je browser:<br>
            <a href="${safeUrl}" style="color:#4F46E5;text-decoration:none;font-weight:600;word-break:break-all">${safeUrl}</a>
          </p>
        </td></tr>
        ${safeDescription ? `
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:24px 40px 0">
          <div style="border-left:3px solid #c7d2fe;background:#f8fafc;padding:14px 18px;border-radius:0 10px 10px 0">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.6px;color:#64748b;text-transform:uppercase">Bericht</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#334155">${safeDescription}</p>
          </div>
        </td></tr>` : ''}
        <tr><td style="background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:24px 40px 28px">
          <p style="margin:0;font-size:13px;line-height:1.65;color:#64748b">
            We bellen via ${safeProvider} — werkt direct in elke moderne browser, op je telefoon en op je laptop.
          </p>
          <p style="margin:14px 0 0;font-size:13px;color:#64748b">
            Vragen vooraf? Reply gerust op deze mail of bel ${safeAdminName} direct.
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
    `${admin.name} heeft een videocall met je ingepland.`,
    '',
    `Onderwerp: ${event.title}`,
    `Wanneer: ${dateLabel} · ${timeRange}`,
    '',
    `Deelnemen aan de videocall:`,
    event.meeting_url,
    '',
    event.description ? `Bericht: ${event.description}\n` : '',
    `We bellen via ${provider.label} — werkt in elke moderne browser.`,
    '',
    `${admin.name} · WarmeLeads`,
    'warmeleads.eu',
  ]
    .filter(line => line !== null && line !== undefined)
    .join('\n');

  return { subject, html, text };
}

/**
 * Verstuurt een videocall-uitnodiging vanuit het AM-mailadres met Reply-To
 * naar de AM. We classificeren dit als 'all' (transactionele scope) en
 * bypassen opt-outs: het is een directe afspraak, geen marketing-uiting.
 */
export async function sendVideocallInvite(input: VideocallInviteInput) {
  const { subject, html, text } = renderHtml(input);
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
    templateKey: 'team_calendar_videocall_invite',
    templateOptions: {
      event_id: input.event.id,
      meeting_url: input.event.meeting_url,
      meeting_provider: detectMeetingProvider(input.event.meeting_url).key,
      starts_at: input.event.starts_at,
    },
    metadata: { event_id: input.event.id },
  });
}
