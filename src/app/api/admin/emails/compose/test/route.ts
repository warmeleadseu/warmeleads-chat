import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { ALLOWED_FROM_DOMAIN } from '@/lib/email';
import { sendAsAdmin, normalizeCcBcc } from '@/lib/email/sendAsAdmin';
import { logAudit } from '@/lib/audit';
import {
  loadAdminFull,
  renderForRecipients,
  resolveRecipients,
  type ComposeRecipient,
} from '@/lib/email/composeContext';
import { getTemplate } from '@/lib/email/templates';

export const runtime = 'nodejs';

interface TestBody {
  template_key?: unknown;
  options?: unknown;
  subject_override?: unknown;
  /** Eén ontvanger om als data-context te gebruiken (bv. eerste prospect). */
  sample_recipient?: unknown;
  /** Volledige handmatige onderwerp-override voor deze test-mail. */
  subject_override_full?: unknown;
  /** Volledige handmatig bewerkte HTML voor deze test-mail. */
  html_override?: unknown;
  /** Cc/bcc — getoond in de test-mail zodat de gebruiker het echt ziet. */
  cc?: unknown;
  bcc?: unknown;
}

function parseAddressList(input: unknown): string[] {
  if (Array.isArray(input)) return input.filter((v): v is string => typeof v === 'string');
  if (typeof input === 'string') {
    return input
      .split(/[,;\n]/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(request: NextRequest) {
  const adminAuth = await verifyAdmin(request);
  if (!adminAuth) return unauthorized();

  let body: TestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const templateKey = typeof body.template_key === 'string' ? body.template_key : '';
  const template = templateKey ? getTemplate(templateKey) : null;
  if (!template) {
    return NextResponse.json({ error: 'Onbekende template' }, { status: 400 });
  }

  const options =
    body.options && typeof body.options === 'object' && !Array.isArray(body.options)
      ? (body.options as Record<string, unknown>)
      : {};
  const subjectOverride =
    typeof body.subject_override === 'string' ? body.subject_override : '';

  let sample: ComposeRecipient | null = null;
  if (body.sample_recipient && typeof body.sample_recipient === 'object') {
    const s = body.sample_recipient as { type?: unknown; id?: unknown };
    if ((s.type === 'prospect' || s.type === 'customer') && typeof s.id === 'string') {
      sample = { type: s.type, id: s.id };
    }
  }

  const supabase = createServerClient();
  const admin = await loadAdminFull(supabase, adminAuth.id);
  if (!admin) return NextResponse.json({ error: 'Admin niet gevonden' }, { status: 500 });
  const fromDomain = admin.email.split('@')[1]?.toLowerCase();
  if (fromDomain !== ALLOWED_FROM_DOMAIN) {
    return NextResponse.json(
      { error: `Verzenden alleen toegestaan vanaf @${ALLOWED_FROM_DOMAIN}` },
      { status: 400 },
    );
  }

  // Bouw render-context. Als er een sample-recipient is, lenen we die data
  // (naam/branches) maar overschrijven het email-adres met de admin zelf.
  let resolved;
  if (sample) {
    const r = await resolveRecipients(supabase, { id: admin.id, role: admin.role }, [sample]);
    if (r.resolved.length === 0) {
      return NextResponse.json(
        { error: 'Sample-ontvanger niet beschikbaar voor deze admin' },
        { status: 400 },
      );
    }
    resolved = [
      {
        ...r.resolved[0],
        recipient: { ...r.resolved[0].recipient, email: admin.email },
      },
    ];
  } else {
    // Fallback: dummy-recipient met admin als ontvanger.
    resolved = [
      {
        recipient: {
          type: template.applicableTo[0],
          id: 'test',
          email: admin.email,
          name: admin.name,
          firstName: admin.name.split(' ')[0] || admin.name,
          companyName: 'WarmeLeads',
          branches: [],
        },
        unsubscribeToken: 'test-' + Date.now(),
        unsubscribeUrl: '#',
      },
    ];
  }

  const rendered = await renderForRecipients(supabase, admin, resolved, {
    template,
    optionValues: options,
    subjectOverride,
  });
  const r = rendered[0];

  const subjectFull =
    typeof body.subject_override_full === 'string' && body.subject_override_full.trim()
      ? body.subject_override_full.trim()
      : r.subject;
  const htmlFull =
    typeof body.html_override === 'string' && body.html_override.trim()
      ? (body.html_override as string)
      : r.html;
  const textFull = htmlFull === r.html ? r.text : htmlToText(htmlFull);
  const wasEdited = htmlFull !== r.html || subjectFull !== r.subject;

  const ccCheck = normalizeCcBcc(parseAddressList(body.cc), new Set(), 25);
  const bccCheck = normalizeCcBcc(parseAddressList(body.bcc), new Set(), 25);
  if (ccCheck.invalid.length > 0) {
    return NextResponse.json(
      { error: `Ongeldig cc-adres: ${ccCheck.invalid.join(', ')}` },
      { status: 400 },
    );
  }
  if (bccCheck.invalid.length > 0) {
    return NextResponse.json(
      { error: `Ongeldig bcc-adres: ${bccCheck.invalid.join(', ')}` },
      { status: 400 },
    );
  }

  const result = await sendAsAdmin({
    admin: { id: admin.id, name: admin.name, email: admin.email },
    to: admin.email,
    subject: `[TEST] ${subjectFull}`,
    html: htmlFull,
    text: textFull,
    scope: template.scope,
    bypassOptOut: true,
    templateKey: template.key,
    templateOptions: { ...options, _is_test: true, _manually_edited: wasEdited },
    toName: admin.name,
    cc: ccCheck.addresses.length > 0 ? ccCheck.addresses : undefined,
    bcc: bccCheck.addresses.length > 0 ? bccCheck.addresses : undefined,
  });

  await logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'email.test_sent',
    entityType: 'email_compose',
    entityId: template.key,
    details: { template_key: template.key, ok: result.ok },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Versturen mislukt' },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true, message_id: result.messageId });
}
