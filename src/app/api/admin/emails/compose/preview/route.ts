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
import {
  findRecipientsMissingBranchRequirement,
  getTemplate,
  templateBranchRequirement,
} from '@/lib/email/templates';
import { normalizeCcBcc } from '@/lib/email/sendAsAdmin';

const MAX_PREVIEW = 5;
const MAX_CC = 25;
const MAX_BCC = 25;

interface PreviewBody {
  template_key?: unknown;
  options?: unknown;
  subject_override?: unknown;
  recipient_ids?: unknown;
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

  // Server-side guard voor branche-gebonden templates (bv. nei_begun_intro):
  // weiger de preview als één van de gekozen ontvangers niet aan de branche-
  // eis voldoet, zodat de UI direct een duidelijke foutmelding kan tonen.
  const branchRequirement = templateBranchRequirement(template.key);
  if (branchRequirement && branchRequirement.length > 0) {
    const missing = findRecipientsMissingBranchRequirement(
      template.key,
      resolved.map(r => ({ id: r.recipient.id, branchSlugs: r.branchSlugs })),
    );
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Template "${template.key}" vereist dat ontvangers minstens één van deze branches hebben: ${branchRequirement.join(', ')}.`,
          template_key: template.key,
          required_branches: branchRequirement,
          recipients_without_required_branch: missing,
        },
        { status: 400 },
      );
    }
  }

  // Optouts checken voor preview-info (we blokkeren niet, alleen waarschuwen)
  const recipientEmails = resolved.map(r => r.recipient.email.toLowerCase());

  const ccCheck = normalizeCcBcc(parseAddressList(body.cc), new Set(), MAX_CC);
  const bccCheck = normalizeCcBcc(parseAddressList(body.bcc), new Set(), MAX_BCC);
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
  const cc = ccCheck.addresses;
  const bcc = bccCheck.addresses;

  const allOptoutCheck = Array.from(new Set([...recipientEmails, ...cc, ...bcc]));
  let optoutRows: { email: string; scope: string }[] = [];
  if (allOptoutCheck.length > 0) {
    const { data } = await supabase
      .from('email_optouts')
      .select('email, scope')
      .in('email', allOptoutCheck)
      .in('scope', ['all', template.scope]);
    optoutRows = data || [];
  }
  const optedOutSet = new Set(optoutRows.map(o => o.email));
  const optedOut = recipientEmails.filter(e => optedOutSet.has(e));
  const ccOptedOut = cc.filter(e => optedOutSet.has(e));
  const bccOptedOut = bcc.filter(e => optedOutSet.has(e));

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
      cc: cc.length,
      bcc: bcc.length,
      cc_opted_out: ccOptedOut.length,
      bcc_opted_out: bccOptedOut.length,
    },
    forbidden,
    invalid,
    opted_out_emails: optedOut,
    cc,
    bcc,
    cc_opted_out: ccOptedOut,
    bcc_opted_out: bccOptedOut,
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
