import { createServerClient } from '@/lib/supabase';
import { sendGmailEmail } from '@/lib/gmailSmtp';

export interface LeadAppointmentMailPayload {
  id: string;
  branch: string;
  starts_at: string;
  contact_name: string;
  contact_email: string | null;
  street?: string | null;
  house_number?: string | null;
  postcode?: string | null;
  city?: string | null;
}

/** Canonical + bekende aliases voor thuisbatterij. */
export function isThuisbatterijBranch(branch: string | null | undefined): boolean {
  if (!branch) return false;
  const b = branch.toLowerCase().trim().replace(/\s+/g, '_');
  return b === 'thuisbatterij' || b === 'thuisbatterijen' || b === 'batterij';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function addressLine(appt: LeadAppointmentMailPayload): string | null {
  const street = [appt.street, appt.house_number].filter(Boolean).join(' ').trim();
  const city = [appt.postcode, appt.city].filter(Boolean).join(' ').trim();
  const full = [street, city].filter(Boolean).join(', ');
  return full || null;
}

function leadMailLayout(title: string, bodyHtml: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:40px 16px">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="height:5px;background:#0f766e"></td></tr>
<tr><td style="padding:36px 40px 28px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700">Thuisbatterij Afspraken</p>
  <h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;color:#0f172a;font-weight:700">${title}</h1>
  <div style="font-size:16px;line-height:1.7;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${bodyHtml}</div>
</td></tr>
<tr><td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  Vragen of verplaatsen? Reageer gewoon op deze e-mail.<br>
  &copy; ${year} Thuisbatterij Afspraken
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function appointmentHighlight(dateLabel: string, timeLabel: string, address: string | null): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:20px 0;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px">
<tr><td style="padding:18px 20px">
  <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#0f766e;font-weight:700">Jouw afspraak</p>
  <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a">📅 ${escapeHtml(dateLabel)}</p>
  <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#0f172a">🕝 ${escapeHtml(timeLabel)} uur</p>
  ${address ? `<p style="margin:12px 0 0;font-size:14px;color:#475569">${escapeHtml(address)}</p>` : ''}
</td></tr>
</table>`;
}

function confirmationBody(appt: LeadAppointmentMailPayload): { html: string; text: string; subject: string } {
  const name = appt.contact_name?.trim() || 'daar';
  const dateLabel = fmtDate(appt.starts_at);
  const timeLabel = fmtTime(appt.starts_at);
  const address = addressLine(appt);

  const html = leadMailLayout(
    'Je afspraak is bevestigd',
    `<p style="margin:0 0 14px">Bedankt voor je aanvraag, <strong>${escapeHtml(name)}</strong>!</p>
     <p style="margin:0 0 14px">Goed nieuws: jouw afspraak voor een <strong>thuisbatterij-inventarisatie</strong> is succesvol ingepland.</p>
     ${appointmentHighlight(dateLabel, timeLabel, address)}
     <p style="margin:0 0 14px">Een van onze adviseurs komt bij je thuis langs om jouw huidige situatie zorgvuldig in kaart te brengen. Tijdens het bezoek bekijken we onder andere je energieverbruik, de aanwezigheid van zonnepanelen (indien van toepassing), je meterkast en jouw wensen voor de toekomst. Zo kunnen we bepalen welke thuisbatterij het beste bij jouw woning en verbruik past.</p>
     <p style="margin:0 0 14px">Na de inventarisatie ontvang je een <strong>persoonlijk en vrijblijvend advies</strong>, inclusief een aanbod op maat. Uiteraard is er tijdens de afspraak alle ruimte om vragen te stellen over de werking, besparingen, terugverdientijd en eventuele subsidiemogelijkheden.</p>
     <p style="margin:0 0 14px"><strong>Goed om te weten:</strong> de afspraak duurt gemiddeld <strong>45 tot 60 minuten</strong>. Het is prettig als degene die over de woning en de energierekening beslist, tijdens het gesprek aanwezig is.</p>
     <p style="margin:0 0 14px">Enkele dagen vóór de afspraak nemen we nog even contact met je op om de afspraak te bevestigen.</p>
     <p style="margin:0 0 14px">Komt het geplande moment toch niet uit? Reageer dan eenvoudig op deze e-mail. We plannen graag samen een nieuw moment in dat beter past.</p>
     <p style="margin:0">We kijken ernaar uit je binnenkort te ontmoeten!</p>`,
  );

  const text = [
    `Bedankt voor je aanvraag, ${name}!`,
    '',
    'Goed nieuws: jouw afspraak voor een thuisbatterij-inventarisatie is succesvol ingepland.',
    '',
    'Jouw afspraak',
    `📅 ${dateLabel}`,
    `🕝 ${timeLabel} uur`,
    address ? address : null,
    '',
    'Een van onze adviseurs komt bij je thuis langs om jouw huidige situatie zorgvuldig in kaart te brengen. Tijdens het bezoek bekijken we onder andere je energieverbruik, de aanwezigheid van zonnepanelen (indien van toepassing), je meterkast en jouw wensen voor de toekomst. Zo kunnen we bepalen welke thuisbatterij het beste bij jouw woning en verbruik past.',
    '',
    'Na de inventarisatie ontvang je een persoonlijk en vrijblijvend advies, inclusief een aanbod op maat. Uiteraard is er tijdens de afspraak alle ruimte om vragen te stellen over de werking, besparingen, terugverdientijd en eventuele subsidiemogelijkheden.',
    '',
    'Goed om te weten: de afspraak duurt gemiddeld 45 tot 60 minuten. Het is prettig als degene die over de woning en de energierekening beslist, tijdens het gesprek aanwezig is.',
    '',
    'Enkele dagen vóór de afspraak nemen we nog even contact met je op om de afspraak te bevestigen.',
    '',
    'Komt het geplande moment toch niet uit? Reageer dan eenvoudig op deze e-mail. We plannen graag samen een nieuw moment in dat beter past.',
    '',
    'We kijken ernaar uit je binnenkort te ontmoeten!',
  ].filter(Boolean).join('\n');

  return {
    html,
    text,
    subject: `Afspraakbevestiging thuisbatterij — ${dateLabel} om ${timeLabel}`,
  };
}

function reminderBody(appt: LeadAppointmentMailPayload): { html: string; text: string; subject: string } {
  const name = appt.contact_name?.trim() || 'daar';
  const dateLabel = fmtDate(appt.starts_at);
  const timeLabel = fmtTime(appt.starts_at);
  const address = addressLine(appt);

  const html = leadMailLayout(
    'Herinnering: over 3 dagen je afspraak',
    `<p style="margin:0 0 14px">Hallo ${escapeHtml(name)},</p>
     <p style="margin:0 0 14px">Dit is een vriendelijke herinnering: over ongeveer 3 dagen staat je thuisbatterij-afspraak gepland.</p>
     ${appointmentHighlight(dateLabel, timeLabel, address)}
     <p style="margin:0 0 14px">Een adviseur komt dan langs voor een inventarisatie van je situatie, zodat we daarna een passend aanbod op maat kunnen doen.</p>
     <p style="margin:0 0 14px">We nemen van tevoren nog even contact met je op.</p>
     <p style="margin:0">Wil je de afspraak verplaatsen? Reageer dan op deze e-mail.</p>`,
  );

  const text = [
    `Hallo ${name},`,
    '',
    'Dit is een vriendelijke herinnering: over ongeveer 3 dagen staat je thuisbatterij-afspraak gepland.',
    '',
    `Datum: ${dateLabel}`,
    `Tijd: ${timeLabel}`,
    address ? `Adres: ${address}` : null,
    '',
    'Een adviseur komt dan langs voor een inventarisatie van je situatie, zodat we daarna een passend aanbod op maat kunnen doen.',
    '',
    'We nemen van tevoren nog even contact met je op.',
    '',
    'Wil je de afspraak verplaatsen? Reageer dan op deze e-mail.',
  ].filter(Boolean).join('\n');

  return {
    html,
    text,
    subject: `Herinnering: afspraak thuisbatterij op ${dateLabel}`,
  };
}

/**
 * Stuur lead-bevestiging via Gmail als branche thuisbatterij is.
 * Zet lead_confirmation_sent_at bij succes.
 */
export async function maybeSendLeadThuisbatterijConfirmation(
  appt: LeadAppointmentMailPayload,
): Promise<boolean> {
  if (!isThuisbatterijBranch(appt.branch)) return false;
  const to = appt.contact_email?.trim();
  if (!to) {
    console.warn('[lead-thuisbatterij-mail] no contact_email, skip confirmation', appt.id);
    return false;
  }
  const { html, text, subject } = confirmationBody(appt);
  // sendGmailEmail logs a failed email_log row if credentials are missing
  const result = await sendGmailEmail(to, subject, html, {
    type: 'lead_appointment_confirmation',
    toName: appt.contact_name,
    bodyText: text,
    metadata: { appointment_id: appt.id, branch: appt.branch },
  });

  if (!result.ok) return false;

  const supabase = createServerClient();
  await supabase
    .from('appointments')
    .update({ lead_confirmation_sent_at: new Date().toISOString() })
    .eq('id', appt.id);

  return true;
}

/**
 * Stuur 3-dagen lead-reminder via Gmail. Caller markeert lead_reminder_sent_at.
 */
export async function sendLeadThuisbatterijReminderEmail(
  appt: LeadAppointmentMailPayload,
): Promise<boolean> {
  if (!isThuisbatterijBranch(appt.branch)) return false;
  const to = appt.contact_email?.trim();
  if (!to) return false;

  const { html, text, subject } = reminderBody(appt);
  const result = await sendGmailEmail(to, subject, html, {
    type: 'lead_appointment_reminder',
    toName: appt.contact_name,
    bodyText: text,
    metadata: { appointment_id: appt.id, branch: appt.branch },
  });
  return result.ok;
}
