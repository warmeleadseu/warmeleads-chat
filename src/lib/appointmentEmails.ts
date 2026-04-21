import { sendEmail, type EmailAttachment } from './email';
import { buildICal } from './ical';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';

interface AppointmentPayload {
  id: string;
  branch: string;
  branchName?: string;
  starts_at: string;
  duration_minutes: number;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  street: string | null;
  house_number: string | null;
  postcode: string | null;
  city: string | null;
  notes: string | null;
  portal_user_name?: string | null;
}

interface CustomerInfo {
  name: string;
  email: string;
  contact_person?: string;
}

function fmtDT(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function appointmentLayout(title: string, body: string): string {
  const year = new Date().getFullYear();
  const logoUrl = `${BASE_URL}/warmeleads-logo-2026.png`;
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75,#E74C8C,#FF6B35);border-radius:12px 12px 0 0"></td></tr>
<tr><td style="background:#fff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 40px">
  <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;margin-bottom:24px">
  <h1 style="margin:0 0 20px;font-size:20px;color:#0f172a">${title}</h1>
  <div style="font-size:15px;color:#475569;line-height:1.7">${body}</div>
</td></tr>
<tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;font-size:12px;color:#94a3b8">
  &copy; ${year} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#94a3b8;text-decoration:none">warmeleads.eu</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function appointmentCard(appt: AppointmentPayload): string {
  const when = fmtDT(appt.starts_at);
  const endLocal = new Date(new Date(appt.starts_at).getTime() + appt.duration_minutes * 60_000).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' });
  const loc = [appt.street, appt.house_number, appt.postcode, appt.city].filter(Boolean).join(' ');
  const mapLink = loc ? `<a href="https://maps.google.com/?q=${encodeURIComponent(loc)}" style="color:#3B2F75;text-decoration:none;font-weight:600">${loc}</a>` : '-';
  const rows = [
    `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Datum & tijd</td><td style="padding:6px 0;color:#0f172a;font-weight:600;font-size:14px;text-align:right">${when} &ndash; ${endLocal}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Duur</td><td style="padding:6px 0;color:#0f172a;font-size:14px;text-align:right">${appt.duration_minutes} min</td></tr>`,
    `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Naam klant</td><td style="padding:6px 0;color:#0f172a;font-weight:600;font-size:14px;text-align:right">${appt.contact_name}</td></tr>`,
    appt.contact_phone ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Telefoon</td><td style="padding:6px 0;text-align:right"><a href="tel:${appt.contact_phone}" style="color:#3B2F75;text-decoration:none;font-weight:600">${appt.contact_phone}</a></td></tr>` : '',
    appt.contact_email ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">E-mail</td><td style="padding:6px 0;text-align:right"><a href="mailto:${appt.contact_email}" style="color:#3B2F75;text-decoration:none;font-weight:600">${appt.contact_email}</a></td></tr>` : '',
    loc ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Adres</td><td style="padding:6px 0;text-align:right">${mapLink}</td></tr>` : '',
    appt.branchName ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Branche</td><td style="padding:6px 0;color:#0f172a;font-size:14px;text-align:right">${appt.branchName}</td></tr>` : '',
    appt.portal_user_name ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Adviseur</td><td style="padding:6px 0;color:#0f172a;font-size:14px;text-align:right">${appt.portal_user_name}</td></tr>` : '',
  ].filter(Boolean).join('');
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;background:#fafafa">
    ${rows}
    ${appt.notes ? `<tr><td colspan="2" style="padding-top:12px;color:#64748b;font-size:13px">Opmerkingen:<div style="color:#0f172a;margin-top:4px">${appt.notes}</div></td></tr>` : ''}
  </table>`;
}

function icalAttachment(appt: AppointmentPayload, customer: CustomerInfo, method: 'REQUEST' | 'CANCEL', sequence = 0): EmailAttachment {
  const loc = [appt.street, appt.house_number, appt.postcode, appt.city].filter(Boolean).join(' ');
  const ics = buildICal({
    uid: `appt-${appt.id}@warmeleads.eu`,
    title: `Afspraak: ${appt.contact_name}${appt.branchName ? ' · ' + appt.branchName : ''}`,
    description: appt.notes || `Afspraak met ${appt.contact_name}`,
    location: loc || undefined,
    startsAt: new Date(appt.starts_at),
    durationMinutes: appt.duration_minutes,
    organizer: { name: 'WarmeLeads', email: 'noreply@warmeleads.eu' },
    attendees: [{ name: customer.contact_person || customer.name, email: customer.email }],
    method,
    sequence,
    status: method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
  });
  return {
    filename: 'afspraak.ics',
    content: Buffer.from(ics, 'utf8').toString('base64'),
    contentType: 'text/calendar; method=' + method,
  };
}

export async function sendAppointmentCreatedEmail(
  customer: CustomerInfo,
  appt: AppointmentPayload,
  extraRecipient?: { name: string; email: string },
): Promise<void> {
  const greeting = customer.contact_person || customer.name;
  const html = appointmentLayout(
    'Nieuwe afspraak ingepland',
    `<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
     <p style="margin:0 0 4px">Er is een nieuwe afspraak ingepland in je agenda. De afspraak is ook bijgevoegd als .ics bestand om direct in je agenda te importeren.</p>
     ${appointmentCard(appt)}
     <p style="margin:16px 0 0"><a href="${BASE_URL}/portal/agenda" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#3B2F75,#E74C8C);color:#fff;font-weight:700;border-radius:8px;text-decoration:none">Bekijk in portaal</a></p>`,
  );
  const attachment = icalAttachment(appt, customer, 'REQUEST', 0);
  await sendEmail(customer.email, `Afspraak ingepland: ${appt.contact_name}`, html, {
    type: 'appointment_created',
    toName: greeting,
    metadata: { appointment_id: appt.id },
  }, [attachment]);

  if (extraRecipient && extraRecipient.email !== customer.email) {
    await sendEmail(extraRecipient.email, `Afspraak toegewezen: ${appt.contact_name}`, html, {
      type: 'appointment_assigned',
      toName: extraRecipient.name,
      metadata: { appointment_id: appt.id },
    }, [attachment]);
  }
}

export async function sendAppointmentReminderEmail(
  customer: CustomerInfo,
  appt: AppointmentPayload,
): Promise<void> {
  const greeting = customer.contact_person || customer.name;
  const whenShort = new Date(appt.starts_at).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
  const html = appointmentLayout(
    'Herinnering: afspraak morgen',
    `<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
     <p style="margin:0 0 4px">Morgen (${whenShort}) staat er een afspraak in je agenda.</p>
     ${appointmentCard(appt)}
     <p style="margin:16px 0 0"><a href="${BASE_URL}/portal/agenda" style="color:#3B2F75;font-weight:600">Bekijk in portaal &rarr;</a></p>`,
  );
  await sendEmail(customer.email, `Herinnering: afspraak ${appt.contact_name} morgen`, html, {
    type: 'appointment_reminder',
    toName: greeting,
    metadata: { appointment_id: appt.id },
  });
}

export async function sendAppointmentCancelledEmail(
  customer: CustomerInfo,
  appt: AppointmentPayload,
  reason?: string,
): Promise<void> {
  const greeting = customer.contact_person || customer.name;
  const html = appointmentLayout(
    'Afspraak geannuleerd',
    `<p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
     <p style="margin:0 0 4px">De volgende afspraak is geannuleerd${reason ? `: ${reason}` : ''}.</p>
     ${appointmentCard(appt)}`,
  );
  const attachment = icalAttachment(appt, customer, 'CANCEL', 1);
  await sendEmail(customer.email, `Afspraak geannuleerd: ${appt.contact_name}`, html, {
    type: 'appointment_cancelled',
    toName: greeting,
    metadata: { appointment_id: appt.id },
  }, [attachment]);
}
