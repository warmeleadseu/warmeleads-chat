import { Resend } from 'resend';
import { herbestelUrl } from './herbestelToken';
import { createServerClient } from '@/lib/supabase';
import { computeInvoiceVat } from '@/lib/invoiceVat';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = 'WarmeLeads <noreply@warmeleads.eu>';
export const EMAIL_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
const BASE_URL = EMAIL_BASE_URL;
export const ALLOWED_FROM_DOMAIN = 'warmeleads.eu';

export interface EmailLogOptions {
  type: string;
  toName?: string;
  metadata?: Record<string, unknown>;
}

export interface DispatchEmailOpts {
  type: string;
  toName?: string;
  metadata?: Record<string, unknown>;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  bodyText?: string;
  attachments?: EmailAttachment[];
  /** Cc-ontvangers. Zichtbaar voor alle ontvangers. */
  cc?: string[];
  /** Bcc-ontvangers. Onzichtbaar voor andere ontvangers. */
  bcc?: string[];
  // AM-context velden (optioneel, voor uitgebreide logging)
  fromAdminId?: string | null;
  prospectId?: string | null;
  customerId?: string | null;
  templateKey?: string | null;
  templateOptions?: Record<string, unknown> | null;
  unsubscribeToken?: string | null;
}

export interface DispatchEmailResult {
  ok: boolean;
  messageId?: string | null;
  emailLogId?: string | null;
  error?: string;
}

type EmailStatus = 'sent' | 'failed' | 'queued' | 'bounced' | 'opt_out';

async function logEmail(
  to: string,
  subject: string,
  html: string,
  status: EmailStatus,
  opts: DispatchEmailOpts,
  error?: string,
  providerMessageId?: string | null,
): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data, error: dbError } = await supabase
      .from('email_log')
      .insert({
        type: opts.type || 'unknown',
        to_email: to,
        to_name: opts.toName || null,
        subject,
        html,
        status,
        error: error || null,
        metadata: opts.metadata || {},
        reply_to: opts.replyTo || null,
        body_text: opts.bodyText || null,
        from_admin_id: opts.fromAdminId || null,
        prospect_id: opts.prospectId || null,
        customer_id: opts.customerId || null,
        template_key: opts.templateKey || null,
        template_options: opts.templateOptions || null,
        unsubscribe_token: opts.unsubscribeToken || null,
        provider_message_id: providerMessageId || null,
        cc_emails: opts.cc && opts.cc.length > 0 ? opts.cc : null,
        bcc_emails: opts.bcc && opts.bcc.length > 0 ? opts.bcc : null,
      })
      .select('id')
      .single();
    if (dbError) {
      console.error('[email-log] insert error:', dbError.message, dbError.code);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error('[email-log] failed to log:', e);
    return null;
  }
}

/**
 * Lager-niveau dispatcher: stuurt een mail via Resend en logt het volledig in
 * email_log. Geeft messageId + email_log id terug. sendEmail() en sendAsAdmin()
 * zijn dunne wrappers hieromheen.
 */
export async function dispatchEmail(
  to: string,
  subject: string,
  html: string,
  opts: DispatchEmailOpts,
): Promise<DispatchEmailResult> {
  try {
    const resend = getResend();
    if (!resend) {
      console.warn('[email] RESEND_API_KEY not configured, skipping send');
      const id = await logEmail(to, subject, html, 'failed', opts, 'RESEND_API_KEY not configured');
      return { ok: false, emailLogId: id, error: 'RESEND_API_KEY not configured' };
    }

    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: opts.from || FROM,
      to,
      subject,
      html,
    };
    if (opts.replyTo) (payload as { replyTo?: string }).replyTo = opts.replyTo;
    if (opts.bodyText) (payload as { text?: string }).text = opts.bodyText;
    if (opts.cc && opts.cc.length > 0) (payload as { cc?: string[] }).cc = opts.cc;
    if (opts.bcc && opts.bcc.length > 0) (payload as { bcc?: string[] }).bcc = opts.bcc;
    if (opts.headers && Object.keys(opts.headers).length > 0) {
      (payload as { headers?: Record<string, string> }).headers = opts.headers;
    }
    if (opts.attachments && opts.attachments.length > 0) {
      payload.attachments = opts.attachments.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));
    }

    const { data, error } = await resend.emails.send(payload);
    if (error) {
      console.error('[email] send failed:', error);
      const id = await logEmail(to, subject, html, 'failed', opts, String(error.message || error));
      return { ok: false, emailLogId: id, error: String(error.message || error) };
    }
    const messageId = (data as { id?: string } | null)?.id ?? null;
    const id = await logEmail(to, subject, html, 'sent', opts, undefined, messageId);
    return { ok: true, messageId, emailLogId: id };
  } catch (err) {
    console.error('[email] unexpected error:', err);
    const id = await logEmail(to, subject, html, 'failed', opts, String(err));
    return { ok: false, emailLogId: id, error: String(err) };
  }
}

interface Customer {
  id: string;
  name: string;
  email: string;
  contact_person?: string;
  country?: string | null;
  vat_id?: string | null;
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

export function layout(title: string, content: string): string {
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

export function cta(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px">
    <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">${text}</a>
    </td></tr>
  </table>`;
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64 or utf8 string
  contentType?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  logOptions?: EmailLogOptions,
  attachments?: EmailAttachment[],
): Promise<boolean> {
  const result = await dispatchEmail(to, subject, html, {
    type: logOptions?.type || 'unknown',
    toName: logOptions?.toName,
    metadata: logOptions?.metadata,
    attachments,
  });
  return result.ok;
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

export interface FeedbackItem {
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
  const portalUrl = `${BASE_URL}/portal/bestellen?batch=${batch.id}`;
  /* Eén klik, zonder inloggen: de meeste klanten zitten niet dagelijks in het portaal. */
  let orderUrl = portalUrl;
  try {
    orderUrl = herbestelUrl(batch.id, milestone === '80pct' ? '80' : milestone === 'completed' ? '100' : 'herinnering', { siteUrl: BASE_URL });
  } catch { /* geen servergeheim: dan via het portaal */ }

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
    ${cta('Opnieuw bestellen &rarr;', orderUrl)}
    <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Zelfde voorwaarden, je kiest alleen het aantal. Liever iets aanpassen? <a href="${portalUrl}" style="color:#3B2F75">Bestel via je portaal</a>.</p>`;

  const milestoneTypes: Record<string, string> = { '80pct': 'batch_80pct', completed: 'batch_completed', reminder: 'batch_reminder' };
  return sendEmail(
    customer.email,
    titles[milestone],
    layout(titles[milestone], content),
    { type: milestoneTypes[milestone] || 'batch_milestone', toName: greeting, metadata: { customer_id: customer.id, batch_id: batch.id, milestone } },
  );
}

export type UnpaidBatchReminderEmailContent = {
  subject: string;
  html: string;
  to: { email: string; name: string };
  type: 'batch_payment_reminder';
  metadata: Record<string, unknown>;
  summary: {
    branch_label: string;
    batch_size: number;
    total_incl_btw: number;
    vat_mode: 'reverse_charge_be' | 'domestic_nl';
    has_payment_link: boolean;
  };
};

/** Opties voor de herinnering: betaallink, en bij de automatische reeks de stap en tot wanneer het aanbod geldt. */
export type UnpaidBatchReminderOptions = {
  directCheckoutUrl?: string | null;
  geldigTot?: Date | null;
  laatste?: boolean;
  stap?: number;
};

export function buildUnpaidBatchReminderEmailContent(
  customer: Customer,
  batch: UnpaidBatchReminderInfo,
  options?: UnpaidBatchReminderOptions,
): UnpaidBatchReminderEmailContent {
  const branchLabel = batch.branch_name || batch.branch;
  const greeting = customer.contact_person || customer.name;
  const portalAccountInvoicesUrl = `${BASE_URL}/portal/account?tab=invoices`;
  const subtotal = Number(batch.total_price || 0);
  const vat = computeInvoiceVat({
    subtotalExclBtw: subtotal,
    country: customer.country,
    customerVatId: customer.vat_id,
  });
  const btwAmount = vat.btw_amount;
  const totalInclBtw = vat.total_incl_btw;
  const isReverseRem = vat.vat_mode === 'reverse_charge_be';
  const btwRowLabel = isReverseRem ? 'BTW (verlegd)' : 'BTW 21%';
  const totalRowLabel = isReverseRem ? 'Totaal' : 'Totaal incl. BTW';
  const exclSuffix = isReverseRem ? '' : ' (excl. BTW)';
  const subtotalLabel = isReverseRem ? 'Subtotaal' : 'Subtotaal excl. BTW';

  const pricingRows = batch.price_per_lead
    ? row(`Prijs per lead${exclSuffix}`, `&euro;${Number(batch.price_per_lead).toFixed(2)}`) +
      row(subtotalLabel, `&euro;${subtotal.toFixed(2)}`) +
      row(btwRowLabel, `&euro;${btwAmount.toFixed(2)}`) +
      `<tr>
        <td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:none">${totalRowLabel}</td>
        <td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:none">&euro;${totalInclBtw.toFixed(2)}</td>
      </tr>`
    : row('Prijs', 'Bekijk bedrag in je portaal');

  const content = `
    <p style="margin:0 0 20px">${statusBadge('BATCH WACHT OP BETALING', 'red')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 8px">Je batch <strong style="color:#0f172a">${branchLabel}</strong> staat voor je klaar, maar is nog niet betaald.</p>
    <p style="margin:0 0 8px">Zodra je betaalt, start de levering direct en ontvang je nieuwe leads in je portaal.</p>
    ${options?.geldigTot
      ? `<p style="margin:0 0 8px">Dit aanbod is geldig tot en met <strong style="color:#0f172a">${options.geldigTot.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })}</strong>.</p>`
      : ''}
    ${dataTable(
      row('Branche', `<strong style="color:#0f172a">${branchLabel}</strong>`) +
      row('Batch grootte', `<strong style="color:#0f172a">${batch.batch_size}</strong> leads`) +
      pricingRows,
      'Openstaande batch',
    )}
    ${options?.directCheckoutUrl
      ? `${cta('Direct online betalen (Mollie) &rarr;', options.directCheckoutUrl)}`
      : ''}
    ${cta('Factuur openen in je portaal &rarr;', portalAccountInvoicesUrl)}
    <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Na betaling gaat je batch direct live.</p>`;

  return {
    subject: options?.laatste
      ? `Laatste herinnering: je batch ${branchLabel} wacht op betaling`
      : `Herinnering: je batch ${branchLabel} wacht op betaling`,
    html: layout('Batch betaling herinnering', content),
    to: { email: customer.email, name: greeting },
    type: 'batch_payment_reminder',
    metadata: {
      customer_id: customer.id,
      batch_id: batch.id,
      branch: batch.branch,
      ...(options?.stap ? { stap: options.stap, automatisch: true } : {}),
    },
    summary: {
      branch_label: branchLabel,
      batch_size: batch.batch_size,
      total_incl_btw: totalInclBtw,
      vat_mode: isReverseRem ? 'reverse_charge_be' : 'domestic_nl',
      has_payment_link: !!options?.directCheckoutUrl,
    },
  };
}

export async function sendUnpaidBatchReminderEmail(
  customer: Customer,
  batch: UnpaidBatchReminderInfo,
  options?: UnpaidBatchReminderOptions,
): Promise<boolean> {
  const c = buildUnpaidBatchReminderEmailContent(customer, batch, options);
  return sendEmail(c.to.email, c.subject, c.html, {
    type: c.type,
    toName: c.to.name,
    metadata: c.metadata,
  });
}

/** Na 21 dagen zonder betaling: het aanbod is verlopen, met een weg terug. */
export async function sendOfferteVerlopenEmail(
  customer: Customer,
  batch: UnpaidBatchReminderInfo,
  alsnogUrl: string,
): Promise<boolean> {
  const branchLabel = batch.branch_name || batch.branch;
  const greeting = customer.contact_person || customer.name;
  const titel = `Je aanbod voor ${branchLabel} is verlopen`;
  const content = `
    <p style="margin:0 0 20px">${statusBadge('AANBOD VERLOPEN', 'orange')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 8px">Je batch van <strong style="color:#0f172a">${batch.batch_size} ${branchLabel}-leads</strong> is niet betaald en daarom verlopen. De factuur vervalt, je hoeft niets te doen.</p>
    <p style="margin:0">Wil je toch leads ontvangen? Met de knop hieronder bestel je hem alsnog, en de levering start direct na betaling.</p>
    ${cta('Alsnog bestellen &rarr;', alsnogUrl)}
    <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Vragen? Beantwoord deze mail, dan nemen we contact met je op.</p>`;
  return sendEmail(customer.email, titel, layout(titel, content), {
    type: 'batch_offerte_verlopen',
    toName: greeting,
    metadata: { customer_id: customer.id, batch_id: batch.id, branch: batch.branch },
  });
}

/**
 * Herbestelsignaal voor de accountmanager: de batch van een klant is bijna op
 * (80%) of al een paar dagen klaar, en er is nog geen vervolg besteld.
 */
export async function sendHerbestelSignaalEmail(
  to: { email: string; name?: string | null },
  info: {
    soort: 'bijna_op' | 'klaar'; klant: string; contactpersoon?: string | null; telefoon?: string | null;
    klantEmail?: string | null; branche: string; geleverd: number; grootte: number; batchId: string; customerId: string;
  },
): Promise<boolean> {
  const titel = info.soort === 'bijna_op'
    ? `${info.klant}: batch ${info.branche} bijna op, nog geen vervolg`
    : `Bel ${info.klant}: batch ${info.branche} is klaar en er is niets nabesteld`;
  const uitleg = info.soort === 'bijna_op'
    ? 'De klant kreeg net de mail met de knop om opnieuw te bestellen. Een belletje nu voorkomt dat de levering stilvalt.'
    : 'De batch is een paar dagen klaar en de klant heeft niet opnieuw besteld. Hij ontvangt nu geen leads meer. Bel om te horen hoe het ging en of er een vervolg komt.';
  const content = `
    <p style="margin:0 0 20px">${statusBadge(info.soort === 'bijna_op' ? 'BIJNA OP' : 'GEEN VERVOLG', info.soort === 'bijna_op' ? 'orange' : 'red')}</p>
    <p style="margin:0 0 16px">${uitleg}</p>
    ${dataTable(
      row('Klant', `<strong style="color:#0f172a">${info.klant}</strong>`) +
      row('Contactpersoon', info.contactpersoon || '-') +
      row('Telefoon', info.telefoon || '-') +
      row('E-mail', info.klantEmail || '-') +
      row('Batch', `${info.branche}: ${info.geleverd} van ${info.grootte} geleverd`),
      'Herbestellen',
    )}
    ${cta('Batch openen in het CRM &rarr;', `${BASE_URL}/admin/batches?batch=${info.batchId}`)}`;
  return sendEmail(to.email, titel, layout(titel, content), {
    type: info.soort === 'bijna_op' ? 'am_herbestel_bijna_op' : 'am_herbestel_klaar',
    toName: to.name ?? undefined,
    metadata: { customer_id: info.customerId, batch_id: info.batchId },
  });
}

/** Dag 14 zonder betaling: de accountmanager belt de klant. */
export async function sendBetaalBelactieEmail(
  to: { email: string; name?: string | null },
  info: {
    klant: string; contactpersoon?: string | null; telefoon?: string | null; klantEmail?: string | null;
    branche: string; aantal: number; bedragExcl: number; dagen: number; verlooptOp: Date; batchId: string; customerId: string;
  },
): Promise<boolean> {
  const titel = `Bel ${info.klant}: batch wacht ${info.dagen} dagen op betaling`;
  const content = `
    <p style="margin:0 0 20px">${statusBadge('BELACTIE', 'red')}</p>
    <p style="margin:0 0 16px">${info.klant} heeft na drie herinneringen nog niet betaald. Een belletje helpt vaak: zit er iets in de weg, of wil de klant iets aanpassen?</p>
    ${dataTable(
      row('Klant', `<strong style="color:#0f172a">${info.klant}</strong>`) +
      row('Contactpersoon', info.contactpersoon || '-') +
      row('Telefoon', info.telefoon || '-') +
      row('E-mail', info.klantEmail || '-') +
      row('Batch', `${info.aantal} ${info.branche}-leads`) +
      row('Bedrag excl. btw', `&euro;${info.bedragExcl.toFixed(2)}`) +
      row('Verloopt op', info.verlooptOp.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' })),
      'Onbetaalde batch',
    )}
    ${cta('Batch openen in het CRM &rarr;', `${BASE_URL}/admin/batches?batch=${info.batchId}`)}`;
  return sendEmail(to.email, titel, layout(titel, content), {
    type: 'batch_betaal_belactie',
    toName: to.name ?? undefined,
    metadata: { customer_id: info.customerId, batch_id: info.batchId },
  });
}

/* ─── Doorlopend op factuur ──────────────────────────────────── */

export type DoorloopMailInfo = {
  batchId: string;
  branche: string;
  grootte: number;
  prijsPerLead: number;
  totaalExcl: number;
  totaalIncl: number;
  /** Kleiner dan de vorige batch omdat die boven het maximum zat. */
  verkleind?: boolean;
  stopUrl: string;
};

const euro = (n: number) => `&euro;${n.toFixed(2).replace('.', ',')}`;
const nlDatum = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });
const stopRegel = (url: string) =>
  `<p style="margin:16px 0 0;font-size:13px;color:#64748b">Liever niet meer automatisch doorlopen? <a href="${url}" style="color:#3B2F75;font-weight:600">Zet het hier uit</a>. Dat kan altijd, ook in je portaal onder Account &rsaquo; Bestellingen.</p>`;

/** Bevestiging dat doorlopend op factuur aan staat, met wie het aanzette. */
export async function sendDoorlopendAanEmail(
  customer: Customer,
  info: { door: 'beheer' | 'klant'; stopUrl: string },
): Promise<boolean> {
  const greeting = customer.contact_person || customer.name;
  const titel = 'Je leads lopen voortaan automatisch door';
  const wie = info.door === 'beheer'
    ? 'Zoals afgesproken met je accountmanager staat doorlopende levering nu aan.'
    : 'Je hebt doorlopende levering aangezet.';
  const content = `
    <p style="margin:0 0 20px">${statusBadge('DOORLOPEND', 'purple')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 12px">${wie} Is een batch volledig geleverd, dan start direct een nieuwe met dezelfde voorwaarden. Zo zit je nooit zonder leads.</p>
    <p style="margin:0 0 12px">Zo werkt het:</p>
    <ul style="margin:0 0 12px;padding-left:20px;color:#334155">
      <li style="margin-bottom:6px">Bij 90% van je batch krijg je bericht, met het aantal leads en het bedrag.</li>
      <li style="margin-bottom:6px">De nieuwe batch gaat op factuur, met 7 dagen betaaltermijn. Maximaal ${euro(2500)} excl. btw per keer.</li>
      <li>Stoppen kan altijd. Een batch die al loopt, wordt afgemaakt.</li>
    </ul>
    ${stopRegel(info.stopUrl)}`;
  return sendEmail(customer.email, titel, layout(titel, content), {
    type: 'doorlopend_aan',
    toName: greeting,
    metadata: { customer_id: customer.id, door: info.door },
  });
}

/** Bij 90%: de batch loopt straks door, met een knop om dat te voorkomen. */
export async function sendDoorloopAankondigingEmail(customer: Customer, info: DoorloopMailInfo & { laat?: boolean }): Promise<boolean> {
  const greeting = customer.contact_person || customer.name;
  const titel = `Je ${info.branche}-leads lopen ${info.laat ? 'morgen' : 'binnenkort'} door`;
  const content = `
    <p style="margin:0 0 20px">${statusBadge('LOOPT DOOR', 'purple')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 12px">${info.laat
      ? 'Je batch is volledig geleverd. Omdat doorlopende levering aan staat, start morgen een nieuwe batch met dezelfde voorwaarden.'
      : 'Je batch is bijna vol. Omdat doorlopende levering aan staat, start bij de laatste lead direct een nieuwe batch met dezelfde voorwaarden, zodat je leads blijven doorkomen.'}</p>
    ${dataTable(
      row('Branche', `<strong style="color:#0f172a">${info.branche}</strong>`) +
      row('Aantal leads', `<strong style="color:#0f172a">${info.grootte}</strong>`) +
      row('Prijs per lead (excl. btw)', euro(info.prijsPerLead)) +
      row('Totaal excl. btw', euro(info.totaalExcl)) +
      row('Totaal', `<strong style="color:#0f172a">${euro(info.totaalIncl)}</strong>`) +
      row('Betaling', 'Op factuur, 7 dagen betaaltermijn'),
      'Volgende batch',
    )}
    ${info.verkleind ? `<p style="margin:0 0 12px;font-size:13px;color:#64748b">Doorlopen gaat tot ${euro(2500)} excl. btw per keer, daarom is deze batch kleiner dan je vorige. Wil je een grotere? Bestel hem dan in je portaal.</p>` : ''}
    <p style="margin:0">Wil je dit niet? Dan hoef je alleen op de knop te drukken, er start dan niets.</p>
    ${cta('Niet doorlopen', info.stopUrl)}`;
  return sendEmail(customer.email, titel, layout(titel, content), {
    type: 'doorloop_aankondiging',
    toName: greeting,
    metadata: { customer_id: customer.id, batch_id: info.batchId },
  });
}

/** De nieuwe batch loopt, met de factuur en de betaallink. */
export async function sendDoorloopGestartEmail(
  customer: Customer,
  info: DoorloopMailInfo & { factuurnummer: string; betaalUrl: string; uiterlijk: Date },
): Promise<boolean> {
  const greeting = customer.contact_person || customer.name;
  const titel = `Je nieuwe batch ${info.branche} loopt: factuur ${info.factuurnummer}`;
  const content = `
    <p style="margin:0 0 20px">${statusBadge('&#10003; DOORGELOPEN', 'green')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 12px">Je vorige batch is volledig geleverd en je nieuwe batch van <strong style="color:#0f172a">${info.grootte} ${info.branche}-leads</strong> loopt al. Je ontvangt de leads zoals je gewend bent.</p>
    ${dataTable(
      row('Factuur', info.factuurnummer) +
      row('Totaal', `<strong style="color:#0f172a">${euro(info.totaalIncl)}</strong>`) +
      row('Graag betaald voor', nlDatum(info.uiterlijk)),
      'Factuur',
    )}
    ${cta('Factuur betalen &rarr;', info.betaalUrl)}
    <p style="margin:12px 0 0;font-size:13px;color:#64748b">Is de factuur na 7 dagen niet betaald, dan pauzeren we de levering tot de betaling binnen is.</p>
    ${stopRegel(info.stopUrl)}`;
  return sendEmail(customer.email, titel, layout(titel, content), {
    type: 'doorloop_gestart',
    toName: greeting,
    metadata: { customer_id: customer.id, batch_id: info.batchId },
  });
}

/** Dag 5 zonder betaling: over twee dagen pauzeert de levering. */
export async function sendDoorloopHerinneringEmail(
  customer: Customer,
  info: { batchId: string; branche: string; factuurnummer: string; totaalIncl: number; betaalUrl: string; pauzeOp: Date },
): Promise<boolean> {
  const greeting = customer.contact_person || customer.name;
  const titel = `Herinnering: factuur ${info.factuurnummer} staat nog open`;
  const content = `
    <p style="margin:0 0 20px">${statusBadge('HERINNERING', 'orange')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 12px">Je doorlopende batch ${info.branche} levert gewoon door, maar factuur <strong style="color:#0f172a">${info.factuurnummer}</strong> (${euro(info.totaalIncl)}) is nog niet betaald. Is hij op ${nlDatum(info.pauzeOp)} niet betaald, dan pauzeren we de levering.</p>
    ${cta('Factuur betalen &rarr;', info.betaalUrl)}
    <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Al betaald? Dan kruisen onze berichten elkaar en kun je deze mail negeren.</p>`;
  return sendEmail(customer.email, titel, layout(titel, content), {
    type: 'doorloop_herinnering',
    toName: greeting,
    metadata: { customer_id: customer.id, batch_id: info.batchId },
  });
}

/** Dag 7 zonder betaling: levering gepauzeerd, doorlopen staat uit. */
export async function sendDoorloopGepauzeerdEmail(
  customer: Customer,
  info: { batchId: string; branche: string; factuurnummer: string; totaalIncl: number; betaalUrl: string; alGeleverd: boolean },
): Promise<boolean> {
  const greeting = customer.contact_person || customer.name;
  const titel = info.alGeleverd
    ? `Factuur ${info.factuurnummer} is niet op tijd betaald`
    : `Je levering ${info.branche} is gepauzeerd`;
  const content = `
    <p style="margin:0 0 20px">${statusBadge(info.alGeleverd ? 'BETAALTERMIJN VERSTREKEN' : 'GEPAUZEERD', 'red')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 12px">Factuur <strong style="color:#0f172a">${info.factuurnummer}</strong> (${euro(info.totaalIncl)}) is na 7 dagen nog niet betaald. ${info.alGeleverd
      ? 'De batch was al volledig geleverd.'
      : 'We hebben de levering daarom gepauzeerd. Na betaling gaat hij vanzelf verder, je mist geen leads uit je batch.'} Doorlopende levering staat tot die tijd uit.</p>
    ${cta('Factuur betalen &rarr;', info.betaalUrl)}
    <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Klopt er iets niet? Beantwoord deze mail, dan kijken we met je mee.</p>`;
  return sendEmail(customer.email, titel, layout(titel, content), {
    type: 'doorloop_gepauzeerd',
    toName: greeting,
    metadata: { customer_id: customer.id, batch_id: info.batchId },
  });
}

/** Signaal voor de accountmanager over een doorlopende klant. */
export async function sendDoorloopSignaalEmail(
  to: { email: string; name?: string | null },
  info: {
    soort: 'aangezet_door_klant' | 'gestart' | 'gepauzeerd' | 'bellen' | 'wacht_op_betaling' | 'niet_gestart';
    klant: string; contactpersoon?: string | null; telefoon?: string | null; klantEmail?: string | null;
    branche: string; grootte?: number; bedragIncl?: number; factuurnummer?: string | null; reden?: string;
    batchId: string | null; customerId: string;
  },
): Promise<boolean> {
  const teksten: Record<typeof info.soort, { titel: string; badge: string; kleur: 'green' | 'orange' | 'red' | 'purple' | 'blue'; uitleg: string }> = {
    aangezet_door_klant: { titel: `${info.klant} zette doorlopend op factuur aan`, badge: 'NIEUW', kleur: 'purple', uitleg: 'De klant zette zelf doorlopende levering aan. Bij een volle batch start voortaan direct een nieuwe, op factuur. Uitzetten kan op de klantkaart.' },
    gestart: { titel: `${info.klant}: batch ${info.branche} is doorgelopen`, badge: 'DOORGELOPEN', kleur: 'green', uitleg: 'De vorige batch was vol en er loopt nu een nieuwe, op factuur met 7 dagen betaaltermijn.' },
    gepauzeerd: { titel: `${info.klant}: doorloopfactuur niet betaald, levering gepauzeerd`, badge: 'GEPAUZEERD', kleur: 'red', uitleg: 'De factuur is na 7 dagen niet betaald. De levering is gepauzeerd en doorlopen staat uit. Na betaling gaat de batch vanzelf verder.' },
    bellen: { titel: `Bel ${info.klant}: doorloopfactuur 14 dagen open`, badge: 'BELACTIE', kleur: 'red', uitleg: 'De factuur van de doorgelopen batch staat 14 dagen open. De leads zijn (deels) geleverd, dus dit moet betaald worden. Een belletje helpt vaak.' },
    wacht_op_betaling: { titel: `${info.klant}: batch ${info.branche} loopt nog niet door`, badge: 'WACHT', kleur: 'orange', uitleg: 'De batch is vol, maar er staat nog een onbetaalde doorloopfactuur open. De nieuwe batch start pas na betaling daarvan.' },
    niet_gestart: { titel: `${info.klant}: batch ${info.branche} kon niet doorlopen`, badge: 'ACTIE', kleur: 'orange', uitleg: `De batch is vol, maar de doorloop kon niet starten${info.reden ? `: ${info.reden}` : ''}. Neem contact op of maak de batch met de hand aan.` },
  };
  const t = teksten[info.soort];
  const content = `
    <p style="margin:0 0 20px">${statusBadge(t.badge, t.kleur)}</p>
    <p style="margin:0 0 16px">${t.uitleg}</p>
    ${dataTable(
      row('Klant', `<strong style="color:#0f172a">${info.klant}</strong>`) +
      row('Contactpersoon', info.contactpersoon || '-') +
      row('Telefoon', info.telefoon || '-') +
      row('E-mail', info.klantEmail || '-') +
      row('Branche', info.branche) +
      (info.grootte ? row('Batch', `${info.grootte} leads`) : '') +
      (info.factuurnummer ? row('Factuur', info.factuurnummer) : '') +
      (info.bedragIncl ? row('Bedrag', euro(info.bedragIncl)) : ''),
      'Doorlopend op factuur',
    )}
    ${cta(info.batchId ? 'Batch openen in het CRM &rarr;' : 'Klant openen in het CRM &rarr;', info.batchId ? `${BASE_URL}/admin/batches?batch=${info.batchId}` : `${BASE_URL}/admin/customers`)}`;
  return sendEmail(to.email, t.titel, layout(t.titel, content), {
    type: `am_doorloop_${info.soort}`,
    toName: to.name ?? undefined,
    metadata: { customer_id: info.customerId, batch_id: info.batchId },
  });
}

export async function sendOrderConfirmationEmail(
  customer: Customer,
  order: { branch: string; branch_name?: string; batch_size: number; total_price: number; price_per_lead?: number },
): Promise<boolean> {
  const branchLabel = order.branch_name || order.branch;
  const greeting = customer.contact_person || customer.name;
  const subtotal = Number(order.total_price);
  const vat = computeInvoiceVat({
    subtotalExclBtw: subtotal,
    country: customer.country,
    customerVatId: customer.vat_id,
  });
  const btwAmount = vat.btw_amount;
  const totalInclBtw = vat.total_incl_btw;
  const isReverseConf = vat.vat_mode === 'reverse_charge_be';
  const btwRowLabel = isReverseConf ? 'BTW (verlegd)' : 'BTW 21%';
  const totalRowLabel = isReverseConf ? 'Totaal' : 'Totaal incl. BTW';
  const exclSuffixConf = isReverseConf ? '' : ' (excl. BTW)';
  const subtotalLabelConf = isReverseConf ? 'Subtotaal' : 'Subtotaal excl. BTW';
  const reverseNote =
    isReverseConf
      ? `<p style="margin:12px 0 0;font-size:12px;color:#64748b;line-height:1.5">Intracommunautaire levering: Nederlandse BTW is verlegd naar u als Belgische ondernemer (reverse charge).</p>`
      : '';

  const content = `
    <p style="margin:0 0 20px">${statusBadge('&#10003; BEVESTIGD', 'green')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 8px">Bedankt voor je bestelling! Je nieuwe batch is aangemaakt en leads worden automatisch toegewezen.</p>
    ${dataTable(
      row('Branche', `<strong style="color:#0f172a">${branchLabel}</strong>`) +
      row('Batch grootte', `<strong style="color:#0f172a">${order.batch_size}</strong> leads`) +
      (order.price_per_lead ? row(`Prijs per lead${exclSuffixConf}`, `&euro;${Number(order.price_per_lead).toFixed(2)}`) : '') +
      row(subtotalLabelConf, `&euro;${subtotal.toFixed(2)}`) +
      row(btwRowLabel, `&euro;${btwAmount.toFixed(2)}`) +
      `<tr>
        <td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:none">${totalRowLabel}</td>
        <td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:none">&euro;${totalInclBtw.toFixed(2)}</td>
      </tr>`,
      'Bestelgegevens',
    )}
    ${reverseNote}
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

/**
 * Najaarsactie 2026: bevestiging van deelname na betaling van een batch,
 * met de loten van deze batch, het totaal en de voorwaarden.
 */
export async function sendActieLotenEmail(
  customer: Customer,
  info: {
    batchId: string; branche: string; batchSize: number; loten: number; totaalLoten: number;
    prijsLeads: number; leadsPerLot: number; startLabel: string; eindLabel: string;
  },
): Promise<boolean> {
  const greeting = customer.contact_person || customer.name;
  const titel = `Je doet mee: kans op ${info.prijsLeads} gratis leads`;
  const lot = (n: number) => `${n} ${n === 1 ? 'lot' : 'loten'}`;
  const content = `
    <p style="margin:0 0 20px">${statusBadge('JE DOET MEE', 'orange')}</p>
    <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
    <p style="margin:0 0 12px">Bedankt voor je bestelling! Tot en met ${info.eindLabel} maakt elke batch kans op <strong style="color:#0f172a">${info.prijsLeads} gratis leads</strong>. Je batch van ${info.batchSize} ${info.branche}-leads levert je <strong style="color:#0f172a">${lot(info.loten)}</strong> op.</p>
    ${dataTable(
      row('Deze batch', `${info.batchSize} leads &middot; ${lot(info.loten)}`) +
      row('Jouw loten in totaal', `<strong style="color:#0f172a">${lot(info.totaalLoten)}</strong>`) +
      row('Trekking', `Na ${info.eindLabel}`),
      'Jouw deelname',
    )}
    <p style="margin:0 0 12px">Zo werkt het:</p>
    <ul style="margin:0 0 12px;padding-left:20px;color:#334155">
      <li style="margin-bottom:6px">Per ${info.leadsPerLot} leads in een betaalde batch krijg je 1 lot.</li>
      <li style="margin-bottom:6px">Bestel je in de actieperiode nog een batch, dan komen er loten bij. Hoe meer loten, hoe groter je kans.</li>
      <li>Na ${info.eindLabel} trekken we één winnaar, die alle ${info.prijsLeads} leads gratis krijgt. Wint jouw lot, dan nemen we persoonlijk contact met je op.</li>
    </ul>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;line-height:1.6">Voorwaarden: de actie loopt van ${info.startLabel} tot en met ${info.eindLabel}. Alleen batches die in die periode betaald zijn tellen mee, 1 lot per volle ${info.leadsPerLot} leads. De winnaar ontvangt ${info.prijsLeads} gratis leads in de eigen branche en het eigen gebied. De prijs is niet inwisselbaar voor geld en niet overdraagbaar. Bij creditering of terugbetaling van een batch vervallen de loten van die batch. WarmeLeads mag de actie aanpassen als dat nodig is.</p>`;
  return sendEmail(customer.email, titel, layout(titel, content), {
    type: 'actie_loten',
    toName: greeting,
    metadata: { customer_id: customer.id, batch_id: info.batchId, loten: info.loten, totaal_loten: info.totaalLoten },
  });
}
