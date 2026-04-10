import { Resend } from 'resend';
import { createServerClient } from '@/lib/supabase';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = 'WarmeLeads <noreply@warmeleads.eu>';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';

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
  const logoUrl = `${BASE_URL}/logo-wit.png`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A1A2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:24px 32px;text-align:center">
    <img src="${logoUrl}" alt="WarmeLeads" width="140" style="max-width:140px;height:auto" />
  </td></tr>
  <tr><td style="background:#16213E;border-radius:12px;padding:32px;border:1px solid rgba(255,107,53,.15)">
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
  return `<span style="display:inline-block;background:rgba(255,107,53,.15);color:#FF6B35;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600">${text}</span>`;
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
    ${lead.notities ? `<p style="margin-top:12px;padding:12px;background:rgba(255,107,53,.08);border-radius:8px;color:#E2E8F0;font-size:14px"><strong style="color:#FF6B35">Notities:</strong> ${lead.notities}</p>` : ''}
    <p style="margin-top:20px">
      <a href="${BASE_URL}/portal" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk in portaal &rarr;</a>
    </p>`;

  return sendEmail(
    customer.email,
    `Nieuwe lead: ${lead.naam_klant}`,
    layout('Nieuwe Lead Ontvangen', content),
    { type: 'lead_notification', toName: customer.contact_person || customer.name, metadata: { customer_id: customer.id, lead_name: lead.naam_klant, branch: lead.branch } },
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
      <a href="${BASE_URL}/admin/verdeling" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar verdeling &rarr;</a>
    </p>`;

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
      <td style="padding:6px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${b.name}</td>
      <td style="padding:6px 12px;color:#FF6B35;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">${b.count}</td>
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
      <h2 style="margin:24px 0 12px;font-size:16px;color:#FF6B35;font-weight:600">Top Branches</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
      <tr style="background:rgba(255,107,53,.1)">
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Branche</th>
        <th style="padding:8px 12px;text-align:right;color:#FF6B35;font-size:13px;font-weight:600">Leads</th>
      </tr>
        ${branchRows}
      </table>` : ''}
    <p style="margin-top:20px">
      <a href="${BASE_URL}/admin" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar dashboard &rarr;</a>
    </p>`;

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
      <tr style="background:rgba(255,107,53,.1)">
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Naam</th>
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Plaats</th>
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Telefoon</th>
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Branche</th>
      </tr>
      ${leadRows}
    </table>
    <p style="margin-top:20px">
      <a href="${BASE_URL}/portal" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk details in portaal &rarr;</a>
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
    { type: 'daily_digest', toName: customer.contact_person || customer.name, metadata: { customer_id: customer.id, lead_count: leads.length } },
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
      <tr style="background:rgba(255,107,53,.1)">
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Lead</th>
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Klant</th>
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Branche</th>
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Feedback</th>
        <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Opmerking</th>
      </tr>
      ${feedbackRows}
    </table>
    <p style="margin-top:20px">
      <a href="${BASE_URL}/admin" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar dashboard &rarr;</a>
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
    { type: 'feedback_digest', metadata: { count: feedbackItems.length } },
  );
}

export async function sendBatchMilestoneEmail(
  customer: Customer,
  batch: BatchInfo & { branch_name?: string },
  milestone: '80pct' | 'completed' | 'reminder',
): Promise<boolean> {
  const branchLabel = batch.branch_name || batch.branch;
  const pct = batch.batch_size > 0 ? Math.round((batch.leads_delivered / batch.batch_size) * 100) : 0;
  const orderUrl = `${BASE_URL}/portal/bestellen?batch=${batch.id}`;

  const titles: Record<string, string> = {
    '80pct': `Uw batch ${branchLabel} is voor ${pct}% voltooid`,
    completed: `Uw batch ${branchLabel} is voltooid!`,
    reminder: `U mist momenteel leads in ${branchLabel}`,
  };

  const bodies: Record<string, string> = {
    '80pct': `
      <p>Hallo ${customer.contact_person || customer.name},</p>
      <p>Uw batch <strong>${branchLabel}</strong> is al voor <strong>${pct}%</strong> voltooid 
         (${batch.leads_delivered} van ${batch.batch_size} leads geleverd).</p>
      <p>Bestel nu een vervolg batch zodat u geen leads mist zodra deze batch vol is.</p>`,
    completed: `
      <p>Hallo ${customer.contact_person || customer.name},</p>
      <p>Uw batch <strong>${branchLabel}</strong> is volledig voltooid! 
         Alle ${batch.batch_size} leads zijn geleverd.</p>
      <p>Wilt u blijven groeien? Bestel direct een nieuwe batch en ontvang weer verse leads.</p>`,
    reminder: `
      <p>Hallo ${customer.contact_person || customer.name},</p>
      <p>Het is nu een paar dagen geleden dat uw batch <strong>${branchLabel}</strong> is voltooid. 
         Momenteel ontvangt u geen nieuwe leads in dit segment.</p>
      <p>Bestel een nieuwe batch om weer leads te ontvangen.</p>`,
  };

  const content = `
    ${bodies[milestone]}
    <p style="margin-top:24px">
      <a href="${orderUrl}" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
        Nieuwe batch bestellen &rarr;
      </a>
    </p>`;

  const milestoneTypes: Record<string, string> = { '80pct': 'batch_80pct', completed: 'batch_completed', reminder: 'batch_reminder' };
  return sendEmail(
    customer.email,
    titles[milestone],
    layout(titles[milestone], content),
    { type: milestoneTypes[milestone] || 'batch_milestone', toName: customer.contact_person || customer.name, metadata: { customer_id: customer.id, batch_id: batch.id, milestone } },
  );
}

export async function sendOrderConfirmationEmail(
  customer: Customer,
  order: { branch: string; branch_name?: string; batch_size: number; total_price: number; price_per_lead?: number },
): Promise<boolean> {
  const branchLabel = order.branch_name || order.branch;
  const subtotal = Number(order.total_price);
  const btwAmount = Math.round(subtotal * 0.21 * 100) / 100;
  const totalInclBtw = subtotal + btwAmount;

  const content = `
    <p>Hallo ${customer.contact_person || customer.name},</p>
    <p>Bedankt voor uw bestelling! Uw nieuwe batch is aangemaakt en leads worden automatisch toegewezen.</p>
    ${dataTable(
      row('Branche', branchLabel) +
      row('Batch grootte', `${order.batch_size} leads`) +
      (order.price_per_lead ? row('Prijs per lead (excl. BTW)', `&euro;${Number(order.price_per_lead).toFixed(2)}`) : '') +
      row('Subtotaal excl. BTW', `&euro;${subtotal.toFixed(2)}`) +
      row('BTW 21%', `&euro;${btwAmount.toFixed(2)}`) +
      `<tr>
        <td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;border-top:2px solid rgba(255,107,53,.2)">Totaal incl. BTW</td>
        <td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;text-align:right;border-top:2px solid rgba(255,107,53,.2)">&euro;${totalInclBtw.toFixed(2)}</td>
      </tr>`
    )}
    <p style="margin-top:20px">
      <a href="${BASE_URL}/portal" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk in portaal &rarr;</a>
    </p>`;

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
