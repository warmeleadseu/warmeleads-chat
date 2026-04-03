import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = 'WarmeLeads <noreply@warmeleads.eu>';

interface Customer {
  id: string;
  name: string;
  email: string;
  contact_person?: string;
}

interface LeadInfo {
  naam_klant: string;
  email?: string;
  telefoonnummer?: string;
  postcode?: string;
  huisnummer?: string;
  plaatsnaam?: string;
  provincie?: string;
  branch?: string;
  wervingsdatum?: string;
  notities?: string;
}

interface BatchInfo {
  id: string;
  branch: string;
  batch_size: number;
  leads_delivered: number;
  completed_at?: string;
}

interface WeeklyStats {
  totalLeads: number;
  newLeadsThisWeek: number;
  assignedThisWeek: number;
  activeCustomers: number;
  activeBatches: number;
  completedBatches: number;
  topBranches: { name: string; count: number }[];
}

function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A1A2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:24px 32px;text-align:center">
    <span style="font-size:24px;font-weight:700;color:#F97316;letter-spacing:-.5px">WarmeLeads</span>
  </td></tr>
  <tr><td style="background:#16213E;border-radius:12px;padding:32px;border:1px solid rgba(249,115,22,.15)">
    <h1 style="margin:0 0 20px;font-size:20px;color:#fff;font-weight:600">${title}</h1>
    <div style="color:#CBD5E1;font-size:15px;line-height:1.6">${content}</div>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;color:#64748B;font-size:12px">
    &copy; ${new Date().getFullYear()} WarmeLeads &middot; warmeleads.eu
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function badge(text: string): string {
  return `<span style="display:inline-block;background:rgba(249,115,22,.15);color:#F97316;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600">${text}</span>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${label}</td>
    <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${value || '-'}</td>
  </tr>`;
}

function dataTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">${rows}</table>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) {
      console.warn('[email] RESEND_API_KEY not configured, skipping send');
      return false;
    }
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[email] send failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] unexpected error:', err);
    return false;
  }
}

export async function sendLeadNotification(
  customer: Customer,
  lead: LeadInfo,
): Promise<boolean> {
  const content = `
    <p>Hallo ${customer.contact_person || customer.name},</p>
    <p>Er is een nieuwe lead voor je binnengekomen${lead.branch ? ` in de branche ${badge(lead.branch)}` : ''}:</p>
    ${dataTable(
      row('Naam', lead.naam_klant) +
      row('E-mail', lead.email || '') +
      row('Telefoon', lead.telefoonnummer || '') +
      row('Postcode', lead.postcode || '') +
      row('Huisnummer', lead.huisnummer || '') +
      row('Plaats', lead.plaatsnaam || '') +
      row('Provincie', lead.provincie || '') +
      row('Datum', lead.wervingsdatum || '')
    )}
    ${lead.notities ? `<p style="margin-top:12px;padding:12px;background:rgba(249,115,22,.08);border-radius:8px;color:#E2E8F0;font-size:14px"><strong style="color:#F97316">Notities:</strong> ${lead.notities}</p>` : ''}
    <p style="margin-top:20px">
      <a href="https://warmeleads.eu/portal" style="display:inline-block;background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk in portaal &rarr;</a>
    </p>`;

  return sendEmail(
    customer.email,
    `Nieuwe lead: ${lead.naam_klant}`,
    layout('Nieuwe Lead Ontvangen', content),
  );
}

export async function sendBatchCompletionNotification(
  adminEmail: string,
  customerName: string,
  batchInfo: BatchInfo,
): Promise<boolean> {
  const content = `
    <p>Een batch is zojuist voltooid:</p>
    ${dataTable(
      row('Klant', customerName) +
      row('Branche', batchInfo.branch) +
      row('Batch ID', batchInfo.id.slice(0, 8)) +
      row('Grootte', `${batchInfo.leads_delivered} / ${batchInfo.batch_size} leads`) +
      row('Voltooid op', batchInfo.completed_at || new Date().toLocaleDateString('nl-NL'))
    )}
    <p style="margin-top:16px">Ga naar het admin-paneel om een eventuele vervolg-batch aan te maken.</p>
    <p style="margin-top:20px">
      <a href="https://warmeleads.eu/admin/verdeling" style="display:inline-block;background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar verdeling &rarr;</a>
    </p>`;

  return sendEmail(
    adminEmail,
    `Batch voltooid: ${customerName} – ${batchInfo.branch}`,
    layout('Batch Voltooid', content),
  );
}

export async function sendWeeklyReport(
  adminEmail: string,
  stats: WeeklyStats,
): Promise<boolean> {
  const branchRows = stats.topBranches
    .map(b => `<tr>
      <td style="padding:6px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${b.name}</td>
      <td style="padding:6px 12px;color:#F97316;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">${b.count}</td>
    </tr>`)
    .join('');

  const content = `
    <p>Hier is je wekelijkse samenvatting:</p>
    ${dataTable(
      row('Totaal leads', String(stats.totalLeads)) +
      row('Nieuwe leads deze week', String(stats.newLeadsThisWeek)) +
      row('Toegewezen deze week', String(stats.assignedThisWeek)) +
      row('Actieve klanten', String(stats.activeCustomers)) +
      row('Actieve batches', String(stats.activeBatches)) +
      row('Voltooide batches', String(stats.completedBatches))
    )}
    ${stats.topBranches.length > 0 ? `
      <h2 style="margin:24px 0 12px;font-size:16px;color:#F97316;font-weight:600">Top Branches</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
        <tr style="background:rgba(249,115,22,.1)">
          <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Branche</th>
          <th style="padding:8px 12px;text-align:right;color:#F97316;font-size:13px;font-weight:600">Leads</th>
        </tr>
        ${branchRows}
      </table>` : ''}
    <p style="margin-top:20px">
      <a href="https://warmeleads.eu/admin" style="display:inline-block;background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar dashboard &rarr;</a>
    </p>`;

  const weekNr = getISOWeek(new Date());
  return sendEmail(
    adminEmail,
    `WarmeLeads weekrapport – week ${weekNr}`,
    layout(`Weekrapport – Week ${weekNr}`, content),
  );
}

export async function sendDailyLeadDigest(
  customer: Customer,
  leads: LeadInfo[],
): Promise<boolean> {
  if (leads.length === 0) return true;

  const leadRows = leads
    .map(l => `<tr>
      <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${l.naam_klant}</td>
      <td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${l.plaatsnaam || '-'}</td>
      <td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${l.telefoonnummer || '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)">${l.branch ? badge(l.branch) : '-'}</td>
    </tr>`)
    .join('');

  const content = `
    <p>Hallo ${customer.contact_person || customer.name},</p>
    <p>Hier zijn je leads van vandaag: ${badge(String(leads.length) + (leads.length === 1 ? ' lead' : ' leads'))}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
      <tr style="background:rgba(249,115,22,.1)">
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Naam</th>
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Plaats</th>
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Telefoon</th>
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Branche</th>
      </tr>
      ${leadRows}
    </table>
    <p style="margin-top:20px">
      <a href="https://warmeleads.eu/portal" style="display:inline-block;background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk details in portaal &rarr;</a>
    </p>`;

  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return sendEmail(
    customer.email,
    `Dagelijkse leads – ${today}`,
    layout('Dagelijks Lead Overzicht', content),
  );
}

interface FeedbackItem {
  leadName: string;
  customerName: string;
  branch: string;
  rating: string;
  comment: string | null;
  createdAt: string;
}

const RATING_LABELS: Record<string, { label: string; color: string }> = {
  goed_contact: { label: 'Goed contact gehad', color: '#10B981' },
  onbereikbaar: { label: 'Onbereikbaar', color: '#F59E0B' },
  niet_geinteresseerd: { label: 'Niet geïnteresseerd', color: '#64748B' },
  fout_nummer: { label: 'Fout nummer', color: '#EF4444' },
  verkocht: { label: 'Verkocht!', color: '#8B5CF6' },
};

export async function sendFeedbackDigest(
  adminEmail: string,
  feedbackItems: FeedbackItem[],
): Promise<boolean> {
  if (feedbackItems.length === 0) return true;

  const feedbackRows = feedbackItems
    .map(f => {
      const r = RATING_LABELS[f.rating] || { label: f.rating, color: '#94A3B8' };
      return `<tr>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${f.leadName}</td>
        <td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${f.customerName}</td>
        <td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${f.branch || '-'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)">
          <span style="display:inline-block;background:${r.color}20;color:${r.color};padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600">${r.label}</span>
        </td>
        ${f.comment ? `<td style="padding:8px 12px;color:#94A3B8;font-size:13px;font-style:italic;border-bottom:1px solid rgba(255,255,255,.05)">${f.comment}</td>` : `<td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)">-</td>`}
      </tr>`;
    })
    .join('');

  const ratingCounts: Record<string, number> = {};
  for (const f of feedbackItems) {
    ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
  }
  const summaryBadges = Object.entries(ratingCounts)
    .map(([key, count]) => {
      const r = RATING_LABELS[key] || { label: key, color: '#94A3B8' };
      return `<span style="display:inline-block;background:${r.color}20;color:${r.color};padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;margin:2px 4px 2px 0">${r.label}: ${count}</span>`;
    })
    .join('');

  const content = `
    <p>Er ${feedbackItems.length === 1 ? 'is' : 'zijn'} ${badge(String(feedbackItems.length))} nieuwe feedback${feedbackItems.length === 1 ? '' : 's'} binnengekomen van klanten:</p>
    <div style="margin:12px 0">${summaryBadges}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
      <tr style="background:rgba(249,115,22,.1)">
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Lead</th>
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Klant</th>
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Branche</th>
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Feedback</th>
        <th style="padding:8px 12px;text-align:left;color:#F97316;font-size:13px;font-weight:600">Opmerking</th>
      </tr>
      ${feedbackRows}
    </table>
    <p style="margin-top:20px">
      <a href="https://warmeleads.eu/admin" style="display:inline-block;background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar dashboard &rarr;</a>
    </p>`;

  const today = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return sendEmail(
    adminEmail,
    `Feedback overzicht – ${today} (${feedbackItems.length} nieuwe)`,
    layout('Dagelijks Feedback Overzicht', content),
  );
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
