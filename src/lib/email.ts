import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabase';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = 'WarmeLeads <noreply@warmeleads.eu>';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';

export interface EmailLogOptions {
  type: string;
  toName?: string;
  metadata?: Record<string, unknown>;
}

async function logEmail(
  to: string,
  subject: string,
  html: string,
  status: 'sent' | 'failed',
  options?: EmailLogOptions,
  error?: string,
) {
  try {
    const supabase = createServerClient();
    const { error: dbError } = await supabase.from('email_log').insert({
      type: options?.type || 'unknown',
      to_email: to,
      to_name: options?.toName || null,
      subject,
      html,
      status,
      error: error || null,
      metadata: options?.metadata || {},
    });
    if (dbError) {
      console.error('[email-log] insert error:', dbError.message, dbError.code);
    }
  } catch (e) {
    console.error('[email-log] failed to log:', e);
  }
}

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

interface UnpaidBatchReminderInfo {
  id: string;
  branch: string;
  branch_name?: string;
  batch_size: number;
  price_per_lead: number | null;
  total_price: number | null;
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
  const logoUrl = `${BASE_URL}/warmeleads-logo-2026.png`;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9">
              <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px">
              <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">${title}</h1>
              <div style="font-size:15px;color:#475569;line-height:1.7">${content}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function badge(text: string): string {
  return `<span style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">${text}</span>`;
}

function statusBadge(text: string, color: 'green' | 'blue' | 'orange' | 'purple' | 'red'): string {
  const colors = {
    green: { bg: '#ecfdf5', border: '#d1fae5', text: '#059669' },
    blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
    orange: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
    purple: { bg: '#faf5ff', border: '#e9d5ff', text: '#7c3aed' },
    red: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  };
  const c = colors[color];
  return `<span style="display:inline-block;background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.3px">${text}</span>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px">${label}</td>
    <td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${value || '-'}</td>
  </tr>`;
}

function dataTable(rows: string, headerLabel?: string): string {
  const header = headerLabel
    ? `<tr><td colspan="2" style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0"><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">${headerLabel}</span></td></tr>`
    : '';
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">${header}<tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table></td></tr></table>`;
}

function cta(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px">
    <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">${text}</a>
    </td></tr>
  </table>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  logOptions?: EmailLogOptions,
): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) {
      console.warn('[email] RESEND_API_KEY not configured, skipping send');
      logEmail(to, subject, html, 'failed', logOptions, 'RESEND_API_KEY not configured').catch(() => {});
      return false;
    }
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[email] send failed:', error);
      logEmail(to, subject, html, 'failed', logOptions, String(error.message || error)).catch(() => {});
      return false;
    }
    logEmail(to, subject, html, 'sent', logOptions).catch(() => {});
    return true;
  } catch (err) {
    console.error('[email] unexpected error:', err);
    logEmail(to, subject, html, 'failed', logOptions, String(err)).catch(() => {});
    return false;
  }
}

export async function sendLeadNotification(
  customer: Customer,
  lead: LeadInfo,
): Promise<boolean> {
  const greeting = customer.contact_person || customer.name;
  const content = `
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 8px">Er is een nieuwe lead voor je binnengekomen${lead.branch ? `: ${badge(lead.branch)}` : ''}.</p>
    ${dataTable(
      row('Naam', `<strong style="color:#0f172a">${lead.naam_klant}</strong>`) +
      row('E-mail', lead.email ? `<a href="mailto:${lead.email}" style="color:#3B2F75;text-decoration:none;font-weight:600">${lead.email}</a>` : '') +
      row('Telefoon', lead.telefoonnummer ? `<a href="tel:${lead.telefoonnummer}" style="color:#3B2F75;text-decoration:none;font-weight:600">${lead.telefoonnummer}</a>` : '') +
      row('Postcode', lead.postcode || '') +
      row('Huisnummer', lead.huisnummer || '') +
      row('Plaats', lead.plaatsnaam || '') +
      row('Provincie', lead.provincie || '') +
      row('Datum', lead.wervingsdatum || ''),
      'Leadgegevens',
    )}
    ${lead.notities ? `<div style="margin:16px 0;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:14px;color:#92400e"><strong style="color:#b45309">Notities:</strong> ${lead.notities}</div>` : ''}
    ${cta('Bekijk in portaal &rarr;', `${BASE_URL}/portal`)}`;

  return sendEmail(
    customer.email,
    `Nieuwe lead: ${lead.naam_klant}`,
    layout('Nieuwe Lead Ontvangen', content),
    { type: 'lead_notification', toName: greeting, metadata: { customer_id: customer.id, lead_name: lead.naam_klant, branch: lead.branch } },
  );
}

export async function sendBatchCompletionNotification(
  adminEmail: string,
  customerName: string,
  batchInfo: BatchInfo,
): Promise<boolean> {
  const content = `
    <p style="margin:0 0 20px">${statusBadge('&#10003; VOLTOOID', 'green')}</p>
    <p style="margin:0 0 8px">Een batch is zojuist voltooid:</p>
    ${dataTable(
      row('Klant', `<strong style="color:#0f172a">${customerName}</strong>`) +
      row('Branche', batchInfo.branch) +
      row('Batch ID', batchInfo.id.slice(0, 8)) +
      row('Grootte', `<strong style="color:#0f172a">${batchInfo.leads_delivered} / ${batchInfo.batch_size}</strong> leads`) +
      row('Voltooid op', batchInfo.completed_at || new Date().toLocaleDateString('nl-NL')),
      'Batchgegevens',
    )}
    <p style="margin:16px 0 0;font-size:14px;color:#64748b">Ga naar het admin-paneel om een eventuele vervolg-batch aan te maken.</p>
    ${cta('Naar verdeling &rarr;', `${BASE_URL}/admin/verdeling`)}`;

  return sendEmail(
    adminEmail,
    `Batch voltooid: ${customerName} – ${batchInfo.branch}`,
    layout('Batch Voltooid', content),
    { type: 'batch_completed_admin', metadata: { batch_id: batchInfo.id, customer_name: customerName } },
  );
}

export async function sendWeeklyReport(
  adminEmail: string,
  stats: WeeklyStats,
): Promise<boolean> {
  const branchRows = stats.topBranches
    .map(b => `<tr>
      <td style="padding:10px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${b.name}</td>
      <td style="padding:10px 20px;font-size:14px;color:#3B2F75;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9">${b.count}</td>
    </tr>`)
    .join('');

  const content = `
    <p style="margin:0 0 8px">Hier is je wekelijkse samenvatting:</p>
    ${dataTable(
      row('Totaal leads', `<strong style="color:#0f172a">${stats.totalLeads}</strong>`) +
      row('Nieuwe leads deze week', `<strong style="color:#059669">${stats.newLeadsThisWeek}</strong>`) +
      row('Toegewezen deze week', `<strong style="color:#0f172a">${stats.assignedThisWeek}</strong>`) +
      row('Actieve klanten', String(stats.activeCustomers)) +
      row('Actieve batches', String(stats.activeBatches)) +
      row('Voltooide batches', String(stats.completedBatches)),
      'Statistieken',
    )}
    ${stats.topBranches.length > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <tr><td colspan="2" style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0"><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Top branches</span></td></tr>
        ${branchRows}
      </table>` : ''}
    ${cta('Naar dashboard &rarr;', `${BASE_URL}/admin`)}`;

  const weekNr = getISOWeek(new Date());
  return sendEmail(
    adminEmail,
    `WarmeLeads weekrapport – week ${weekNr}`,
    layout(`Weekrapport – Week ${weekNr}`, content),
    { type: 'weekly_report', metadata: { week: weekNr } },
  );
}

export async function sendDailyLeadDigest(
  customer: Customer,
  leads: LeadInfo[],
): Promise<boolean> {
  if (leads.length === 0) return true;

  const leadRows = leads
    .map(l => `<tr>
      <td style="padding:10px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${l.naam_klant}</td>
      <td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">${l.plaatsnaam || '-'}</td>
      <td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">${l.telefoonnummer || '-'}</td>
      <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f1f5f9">${l.branch ? badge(l.branch) : '-'}</td>
    </tr>`)
    .join('');

  const greeting = customer.contact_person || customer.name;
  const content = `
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 8px">Hier zijn je leads van vandaag: ${badge(String(leads.length) + (leads.length === 1 ? ' lead' : ' leads'))}</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <tr style="background-color:#f8fafc">
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Naam</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Plaats</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Telefoon</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Branche</th>
      </tr>
      ${leadRows}
    </table>
    ${cta('Bekijk details in portaal &rarr;', `${BASE_URL}/portal`)}`;

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  return sendEmail(
    customer.email,
    `Dagelijkse leads – ${today}`,
    layout('Dagelijks Lead Overzicht', content),
    { type: 'daily_digest', toName: greeting, metadata: { customer_id: customer.id, lead_count: leads.length } },
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

const RATING_LABELS: Record<string, { label: string; bg: string; border: string; color: string }> = {
  goed_contact: { label: 'Goed contact gehad', bg: '#ecfdf5', border: '#d1fae5', color: '#059669' },
  onbereikbaar: { label: 'Onbereikbaar', bg: '#fffbeb', border: '#fde68a', color: '#d97706' },
  niet_geinteresseerd: { label: 'Niet geïnteresseerd', bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' },
  fout_nummer: { label: 'Fout nummer', bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
  verkocht: { label: 'Verkocht!', bg: '#faf5ff', border: '#e9d5ff', color: '#7c3aed' },
};

export async function sendFeedbackDigest(
  adminEmail: string,
  feedbackItems: FeedbackItem[],
): Promise<boolean> {
  if (feedbackItems.length === 0) return true;

  const feedbackRows = feedbackItems
    .map(f => {
      const r = RATING_LABELS[f.rating] || { label: f.rating, bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' };
      return `<tr>
        <td style="padding:10px 14px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${f.leadName}</td>
        <td style="padding:10px 14px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">${f.customerName}</td>
        <td style="padding:10px 14px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">${f.branch || '-'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">
          <span style="display:inline-block;background:${r.bg};border:1px solid ${r.border};color:${r.color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${r.label}</span>
        </td>
        <td style="padding:10px 14px;font-size:13px;color:#94a3b8;font-style:italic;border-bottom:1px solid #f1f5f9">${f.comment || '-'}</td>
      </tr>`;
    })
    .join('');

  const ratingCounts: Record<string, number> = {};
  for (const f of feedbackItems) {
    ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
  }
  const summaryBadges = Object.entries(ratingCounts)
    .map(([key, count]) => {
      const r = RATING_LABELS[key] || { label: key, bg: '#f8fafc', border: '#e2e8f0', color: '#64748b' };
      return `<span style="display:inline-block;background:${r.bg};border:1px solid ${r.border};color:${r.color};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;margin:2px 4px 2px 0">${r.label}: ${count}</span>`;
    })
    .join('');

  const content = `
    <p style="margin:0 0 8px">Er ${feedbackItems.length === 1 ? 'is' : 'zijn'} ${badge(String(feedbackItems.length))} nieuwe feedback${feedbackItems.length === 1 ? '' : 's'} binnengekomen:</p>
    <div style="margin:16px 0">${summaryBadges}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <tr style="background-color:#f8fafc">
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Lead</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Klant</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Branche</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Feedback</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Opmerking</th>
      </tr>
      ${feedbackRows}
    </table>
    ${cta('Naar dashboard &rarr;', `${BASE_URL}/admin`)}`;

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  return sendEmail(
    adminEmail,
    `Feedback overzicht – ${today} (${feedbackItems.length} nieuwe)`,
    layout('Dagelijks Feedback Overzicht', content),
    { type: 'feedback_digest', metadata: { count: feedbackItems.length } },
  );
}

export async function sendBatchMilestoneEmail(
  customer: Customer,
  batch: BatchInfo & { branch_name?: string },
  milestone: '80pct' | 'completed' | 'reminder',
): Promise<boolean> {
  const branchLabel = batch.branch_name || batch.branch;
  const greeting = customer.contact_person || customer.name;
  const pct = batch.batch_size > 0 ? Math.round((batch.leads_delivered / batch.batch_size) * 100) : 0;
  const orderUrl = `${BASE_URL}/portal/bestellen?batch=${batch.id}`;

  const titles: Record<string, string> = {
    '80pct': `Je batch ${branchLabel} is voor ${pct}% voltooid`,
    completed: `Je batch ${branchLabel} is voltooid!`,
    reminder: `Je mist momenteel leads in ${branchLabel}`,
  };

  const milestoneBadges: Record<string, string> = {
    '80pct': statusBadge(`${pct}% VOLTOOID`, 'orange'),
    completed: statusBadge('&#10003; VOLTOOID', 'green'),
    reminder: statusBadge('GEEN ACTIEVE BATCH', 'red'),
  };

  const bodies: Record<string, string> = {
    '80pct': `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
      <p style="margin:0 0 8px">Je batch <strong style="color:#0f172a">${branchLabel}</strong> is al voor <strong style="color:#3B2F75">${pct}%</strong> voltooid (${batch.leads_delivered} van ${batch.batch_size} leads geleverd).</p>
      <p style="margin:0">Bestel nu een vervolg batch zodat je geen leads mist zodra deze batch vol is.</p>`,
    completed: `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
      <p style="margin:0 0 8px">Je batch <strong style="color:#0f172a">${branchLabel}</strong> is volledig voltooid! Alle <strong style="color:#3B2F75">${batch.batch_size}</strong> leads zijn geleverd.</p>
      <p style="margin:0">Wil je blijven groeien? Bestel direct een nieuwe batch en ontvang weer verse leads.</p>`,
    reminder: `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
      <p style="margin:0 0 8px">Het is nu een paar dagen geleden dat je batch <strong style="color:#0f172a">${branchLabel}</strong> is voltooid. Momenteel ontvang je geen nieuwe leads in dit segment.</p>
      <p style="margin:0">Bestel een nieuwe batch om weer leads te ontvangen.</p>`,
  };

  const content = `
    <p style="margin:0 0 20px">${milestoneBadges[milestone]}</p>
    ${bodies[milestone]}
    ${cta('Nieuwe batch bestellen &rarr;', orderUrl)}`;

  const milestoneTypes: Record<string, string> = { '80pct': 'batch_80pct', completed: 'batch_completed', reminder: 'batch_reminder' };
  return sendEmail(
    customer.email,
    titles[milestone],
    layout(titles[milestone], content),
    { type: milestoneTypes[milestone] || 'batch_milestone', toName: greeting, metadata: { customer_id: customer.id, batch_id: batch.id, milestone } },
  );
}

export async function sendUnpaidBatchReminderEmail(
  customer: Customer,
  batch: UnpaidBatchReminderInfo,
): Promise<boolean> {
  const branchLabel = batch.branch_name || batch.branch;
  const greeting = customer.contact_person || customer.name;
  const portalUrl = `${BASE_URL}/portal`;
  const subtotal = Number(batch.total_price || 0);
  const btwAmount = Math.round(subtotal * 0.21 * 100) / 100;
  const totalInclBtw = subtotal + btwAmount;

  const pricingRows = batch.price_per_lead
    ? row('Prijs per lead (excl. BTW)', `&euro;${Number(batch.price_per_lead).toFixed(2)}`) +
      row('Subtotaal excl. BTW', `&euro;${subtotal.toFixed(2)}`) +
      row('BTW 21%', `&euro;${btwAmount.toFixed(2)}`) +
      `<tr>
        <td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:none">Totaal incl. BTW</td>
        <td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:none">&euro;${totalInclBtw.toFixed(2)}</td>
      </tr>`
    : row('Prijs', 'Bekijk bedrag in je portaal');

  const content = `
    <p style="margin:0 0 20px">${statusBadge('BATCH WACHT OP BETALING', 'red')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 8px">Je batch <strong style="color:#0f172a">${branchLabel}</strong> staat voor je klaar, maar is nog niet betaald.</p>
    <p style="margin:0 0 8px">Zodra je betaalt, start de levering direct en ontvang je nieuwe leads in je portaal.</p>
    ${dataTable(
      row('Branche', `<strong style="color:#0f172a">${branchLabel}</strong>`) +
      row('Batch grootte', `<strong style="color:#0f172a">${batch.batch_size}</strong> leads`) +
      pricingRows,
      'Openstaande batch',
    )}
    ${cta('Batch betalen in je portaal &rarr;', portalUrl)}
    <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Na betaling gaat je batch direct live.</p>`;

  return sendEmail(
    customer.email,
    `Herinnering: je batch ${branchLabel} wacht op betaling`,
    layout('Batch betaling herinnering', content),
    {
      type: 'batch_payment_reminder',
      toName: greeting,
      metadata: {
        customer_id: customer.id,
        batch_id: batch.id,
        branch: batch.branch,
      },
    },
  );
}

export async function sendOrderConfirmationEmail(
  customer: Customer,
  order: { branch: string; branch_name?: string; batch_size: number; total_price: number; price_per_lead?: number },
): Promise<boolean> {
  const branchLabel = order.branch_name || order.branch;
  const greeting = customer.contact_person || customer.name;
  const subtotal = Number(order.total_price);
  const btwAmount = Math.round(subtotal * 0.21 * 100) / 100;
  const totalInclBtw = subtotal + btwAmount;

  const content = `
    <p style="margin:0 0 20px">${statusBadge('&#10003; BEVESTIGD', 'green')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 8px">Bedankt voor je bestelling! Je nieuwe batch is aangemaakt en leads worden automatisch toegewezen.</p>
    ${dataTable(
      row('Branche', `<strong style="color:#0f172a">${branchLabel}</strong>`) +
      row('Batch grootte', `<strong style="color:#0f172a">${order.batch_size}</strong> leads`) +
      (order.price_per_lead ? row('Prijs per lead (excl. BTW)', `&euro;${Number(order.price_per_lead).toFixed(2)}`) : '') +
      row('Subtotaal excl. BTW', `&euro;${subtotal.toFixed(2)}`) +
      row('BTW 21%', `&euro;${btwAmount.toFixed(2)}`) +
      `<tr>
        <td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:none">Totaal incl. BTW</td>
        <td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:none">&euro;${totalInclBtw.toFixed(2)}</td>
      </tr>`,
      'Bestelgegevens',
    )}
    ${cta('Bekijk in portaal &rarr;', `${BASE_URL}/portal`)}`;

  return sendEmail(
    customer.email,
    `Bevestiging: nieuwe batch ${branchLabel} (${order.batch_size} leads)`,
    layout('Bestelling Bevestigd', content),
    { type: 'order_confirmation', toName: customer.contact_person || customer.name, metadata: { customer_id: customer.id, branch: order.branch, batch_size: order.batch_size } },
  );
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
