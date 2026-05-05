import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { ALLOWED_FROM_DOMAIN } from '@/lib/email';
import {
  loadAdminFull,
  renderForRecipients,
  resolveRecipients,
  type ComposeRecipient,
} from '@/lib/email/composeContext';
import { getTemplate } from '@/lib/email/templates';

const MAX_PREVIEW = 5;

interface PreviewBody {
  template_key?: unknown;
  options?: unknown;
  subject_override?: unknown;
  recipient_ids?: unknown;
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

export async function POST(request: NextRequest) {
  const adminAuth = await verifyAdmin(request);
  if (!adminAuth) return unauthorized();

  let body: PreviewBody;
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
      { error: `Je e-mailadres is geen @${ALLOWED_FROM_DOMAIN}-adres. Vraag een superadmin om dit aan te passen.` },
      { status: 400 },
    );
  }

  const { resolved, forbidden, invalid } = await resolveRecipients(
    supabase,
    { id: admin.id, role: admin.role },
    recipients,
  );

  // Optouts checken voor preview-info (we blokkeren niet, alleen waarschuwen)
  const recipientEmails = resolved.map(r => r.recipient.email.toLowerCase());
  let optedOut: string[] = [];
  if (recipientEmails.length > 0) {
    const { data } = await supabase
      .from('email_optouts')
      .select('email, scope')
      .in('email', recipientEmails)
      .in('scope', ['all', template.scope]);
    optedOut = Array.from(new Set((data || []).map(o => o.email)));
  }

  const limited = resolved.slice(0, MAX_PREVIEW);
  const previews = await renderForRecipients(supabase, admin, limited, {
    template,
    optionValues: options,
    subjectOverride,
  });

  return NextResponse.json({
    template_key: template.key,
    from: `${admin.name} <${admin.email}>`,
    reply_to: admin.email,
    counts: {
      requested: recipients.length,
      resolved: resolved.length,
      forbidden: forbidden.length,
      invalid: invalid.length,
      opted_out: optedOut.length,
      sendable: resolved.length - optedOut.length,
    },
    forbidden,
    invalid,
    opted_out_emails: optedOut,
    previews: previews.map(p => ({
      recipient: {
        id: p.recipient.recipient.id,
        type: p.recipient.recipient.type,
        email: p.recipient.recipient.email,
        name: p.recipient.recipient.name,
        company: p.recipient.recipient.companyName,
      },
      subject: p.subject,
      html: p.html,
      text: p.text,
      warnings: p.warnings,
      opted_out: optedOut.includes(p.recipient.recipient.email.toLowerCase()),
    })),
  });
}
