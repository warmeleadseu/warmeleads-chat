import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { ALLOWED_FROM_DOMAIN } from '@/lib/email';
import { logAudit } from '@/lib/audit';
import { sendAsAdmin } from '@/lib/email/sendAsAdmin';
import {
  loadAdminFull,
  renderForRecipients,
  resolveRecipients,
  type AdminRow,
  type ComposeRecipient,
  type ComposeRenderResult,
  type ResolvedRecipient,
} from '@/lib/email/composeContext';
import { getTemplate, type EmailTemplate } from '@/lib/email/templates';

export const runtime = 'nodejs';
export const maxDuration = 300;

const SYNC_LIMIT = 100;
/** Rate-limit voor Resend (paid plan: 10/s, marge 20%). */
const SEND_INTERVAL_MS = 125;

interface SendBody {
  template_key?: unknown;
  options?: unknown;
  subject_override?: unknown;
  recipient_ids?: unknown;
  dry_run?: unknown;
}

interface RecipientIdsBody {
  prospects?: unknown;
  customers?: unknown;
}

function parseRecipients(input: unknown): ComposeRecipient[] {
  const out: ComposeRecipient[] = [];
  if (!input || typeof input !== 'object') return out;
  const r = input as RecipientIdsBody;
  if (Array.isArray(r.prospects)) {
    for (const id of r.prospects) {
      if (typeof id === 'string' && id.length > 0) out.push({ type: 'prospect', id });
    }
  }
  if (Array.isArray(r.customers)) {
    for (const id of r.customers) {
      if (typeof id === 'string' && id.length > 0) out.push({ type: 'customer', id });
    }
  }
  return out;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface SendStats {
  sent: number;
  failed: number;
  optOut: number;
  errors: Array<{ recipient_id: string; type: string; email: string; error: string }>;
}

async function sendOneAndLog(
  rendered: ComposeRenderResult,
  template: EmailTemplate,
  admin: AdminRow,
  options: Record<string, unknown>,
  stats: SendStats,
): Promise<void> {
  const r = rendered.recipient.recipient;
  const result = await sendAsAdmin({
    admin: { id: admin.id, name: admin.name, email: admin.email },
    to: r.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    scope: template.scope,
    prospectId: r.type === 'prospect' ? r.id : null,
    customerId: r.type === 'customer' ? r.id : null,
    templateKey: template.key,
    templateOptions: options,
    unsubscribeToken: rendered.recipient.unsubscribeToken,
    toName: r.name,
  });

  if (result.blockedByOptOut) {
    stats.optOut += 1;
    return;
  }
  if (!result.ok) {
    stats.failed += 1;
    stats.errors.push({
      recipient_id: r.id,
      type: r.type,
      email: r.email,
      error: result.error || 'Onbekende fout',
    });
    return;
  }
  stats.sent += 1;

  // Voor prospects: maak prospect_activity en update last_contacted_at.
  if (r.type === 'prospect') {
    try {
      const supabase = createServerClient();
      const bodyPreview = rendered.text.slice(0, 200);
      await supabase.from('prospect_activities').insert({
        prospect_id: r.id,
        admin_user_id: admin.id,
        type: 'email',
        title: rendered.subject || 'E-mail verstuurd',
        body: bodyPreview,
        metadata: {
          template_key: template.key,
          email_log_id: result.emailLogId,
          provider_message_id: result.messageId,
        },
      });
      await supabase
        .from('prospects')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', r.id);
    } catch (err) {
      console.error('[compose/send] prospect_activity insert failed:', err);
    }
  }
}

async function processBatch(
  rendered: ComposeRenderResult[],
  template: EmailTemplate,
  admin: AdminRow,
  options: Record<string, unknown>,
  onProgress?: (stats: SendStats) => Promise<void>,
): Promise<SendStats> {
  const stats: SendStats = { sent: 0, failed: 0, optOut: 0, errors: [] };
  for (let i = 0; i < rendered.length; i++) {
    await sendOneAndLog(rendered[i], template, admin, options, stats);
    if (onProgress) await onProgress(stats);
    if (i < rendered.length - 1) await delay(SEND_INTERVAL_MS);
  }
  return stats;
}

export async function POST(request: NextRequest) {
  const adminAuth = await verifyAdmin(request);
  if (!adminAuth) return unauthorized();

  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const templateKey = typeof body.template_key === 'string' ? body.template_key : '';
  if (!templateKey) {
    return NextResponse.json({ error: 'template_key is verplicht' }, { status: 400 });
  }
  const template = getTemplate(templateKey);
  if (!template) {
    return NextResponse.json({ error: 'Onbekende template' }, { status: 400 });
  }

  const options =
    body.options && typeof body.options === 'object' && !Array.isArray(body.options)
      ? (body.options as Record<string, unknown>)
      : {};
  const subjectOverride =
    typeof body.subject_override === 'string' ? body.subject_override : '';
  const dryRun = body.dry_run === true;

  const recipients = parseRecipients(body.recipient_ids);
  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Geen ontvangers opgegeven' }, { status: 400 });
  }

  const supabase = createServerClient();
  const admin = await loadAdminFull(supabase, adminAuth.id);
  if (!admin) return NextResponse.json({ error: 'Admin niet gevonden' }, { status: 500 });

  const fromDomain = admin.email.split('@')[1]?.toLowerCase();
  if (fromDomain !== ALLOWED_FROM_DOMAIN) {
    return NextResponse.json(
      {
        error: `Je e-mailadres (${admin.email}) is geen @${ALLOWED_FROM_DOMAIN}-adres. Verzenden is alleen toegestaan met een adres op dit domein.`,
      },
      { status: 400 },
    );
  }

  const { resolved, forbidden, invalid } = await resolveRecipients(
    supabase,
    { id: admin.id, role: admin.role },
    recipients,
  );

  if (resolved.length === 0) {
    return NextResponse.json(
      {
        error: 'Geen geldige ontvangers',
        forbidden,
        invalid,
      },
      { status: 400 },
    );
  }

  const rendered = await renderForRecipients(supabase, admin, resolved, {
    template,
    optionValues: options,
    subjectOverride,
  });

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      counts: {
        requested: recipients.length,
        resolved: resolved.length,
        forbidden: forbidden.length,
        invalid: invalid.length,
      },
      previews: rendered.slice(0, 5).map(r => ({
        recipient: {
          id: r.recipient.recipient.id,
          email: r.recipient.recipient.email,
          name: r.recipient.recipient.name,
        },
        subject: r.subject,
      })),
    });
  }

  // Synchroon voor batches tot SYNC_LIMIT.
  if (resolved.length <= SYNC_LIMIT) {
    const stats = await processBatch(rendered, template, admin, options);

    await logAudit({
      adminId: admin.id,
      adminName: admin.name,
      action: resolved.length === 1 ? 'email.sent' : 'email.bulk_sent',
      entityType: 'email_compose',
      entityId: template.key,
      details: {
        template_key: template.key,
        total: resolved.length,
        sent: stats.sent,
        failed: stats.failed,
        opt_out: stats.optOut,
      },
    });

    return NextResponse.json({
      success: stats.failed === 0,
      partial: stats.failed > 0 && stats.sent > 0,
      counts: {
        requested: recipients.length,
        resolved: resolved.length,
        sent: stats.sent,
        failed: stats.failed,
        opt_out: stats.optOut,
        forbidden: forbidden.length,
        invalid: invalid.length,
      },
      errors: stats.errors,
    });
  }

  // Bulk (>100 ontvangers): zelfde request blijft open, maar we maken eerst
  // een email_jobs-rij zodat de UI parallel via polling de voortgang kan
  // tonen. We updaten de job-rij elke ~1s tijdens het versturen.
  const audienceSummary = {
    prospect_count: resolved.filter(r => r.recipient.type === 'prospect').length,
    customer_count: resolved.filter(r => r.recipient.type === 'customer').length,
    forbidden_count: forbidden.length,
    invalid_count: invalid.length,
  };

  const { data: job, error: jobErr } = await supabase
    .from('email_jobs')
    .insert({
      admin_id: admin.id,
      template_key: template.key,
      total: resolved.length,
      status: 'running',
      options,
      audience_summary: audienceSummary,
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: 'Kon bulk-job niet aanmaken', details: jobErr?.message },
      { status: 500 },
    );
  }

  const stats = await runJobInline(job.id, rendered, template, admin, options);

  await logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'email.bulk_sent',
    entityType: 'email_job',
    entityId: job.id,
    details: {
      template_key: template.key,
      total: resolved.length,
      sent: stats.sent,
      failed: stats.failed,
      opt_out: stats.optOut,
    },
  });

  return NextResponse.json({
    success: stats.failed === 0,
    partial: stats.failed > 0 && stats.sent > 0,
    job_id: job.id,
    counts: {
      requested: recipients.length,
      resolved: resolved.length,
      sent: stats.sent,
      failed: stats.failed,
      opt_out: stats.optOut,
      forbidden: forbidden.length,
      invalid: invalid.length,
    },
    errors: stats.errors,
    polling_url: `/api/admin/emails/jobs/${job.id}`,
  });
}

/**
 * Runt een batch inline en updatet email_jobs zodat de UI via een tweede
 * connectie kan pollen voor voortgang.
 */
async function runJobInline(
  jobId: string,
  rendered: ComposeRenderResult[],
  template: EmailTemplate,
  admin: AdminRow,
  options: Record<string, unknown>,
): Promise<SendStats> {
  const supabase = createServerClient();
  let lastUpdate = 0;
  try {
    const stats = await processBatch(rendered, template, admin, options, async stats => {
      const now = Date.now();
      if (now - lastUpdate > 1000) {
        lastUpdate = now;
        await supabase
          .from('email_jobs')
          .update({ sent: stats.sent, failed: stats.failed, opt_out: stats.optOut })
          .eq('id', jobId);
      }
    });
    await supabase
      .from('email_jobs')
      .update({
        sent: stats.sent,
        failed: stats.failed,
        opt_out: stats.optOut,
        status: 'done',
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    return stats;
  } catch (err) {
    await supabase
      .from('email_jobs')
      .update({
        status: 'error',
        error: String(err),
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    throw err;
  }
}

export type { ResolvedRecipient };
