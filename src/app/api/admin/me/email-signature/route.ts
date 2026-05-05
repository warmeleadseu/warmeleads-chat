import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { renderDefaultSignature } from '@/lib/email/templates/_signature';
import { buildAdminCtx, loadAdminFull } from '@/lib/email/composeContext';
import { EMAIL_BASE_URL } from '@/lib/email';

const MAX_LEN = 30_000;

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const full = await loadAdminFull(supabase, admin.id);
  if (!full) {
    return NextResponse.json({ error: 'Profiel niet gevonden' }, { status: 500 });
  }

  const defaultHtml = renderDefaultSignature(buildAdminCtx({ ...full, email_signature_html: null }), EMAIL_BASE_URL);

  return NextResponse.json({
    has_override: Boolean(full.email_signature_html && full.email_signature_html.trim()),
    override_html: full.email_signature_html || '',
    default_html: defaultHtml,
  });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: { html?: unknown; clear?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const supabase = createServerClient();

  if (body.clear === true) {
    await supabase
      .from('admin_users')
      .update({ email_signature_html: null })
      .eq('id', admin.id);
    return NextResponse.json({ success: true, has_override: false });
  }

  const html = typeof body.html === 'string' ? body.html : '';
  if (!html.trim()) {
    return NextResponse.json({ error: 'HTML is verplicht (of stuur clear:true)' }, { status: 400 });
  }
  if (html.length > MAX_LEN) {
    return NextResponse.json({ error: `Te lang: max ${MAX_LEN} tekens` }, { status: 400 });
  }
  // Veiligheids-check: scripts blokkeren.
  if (/<script|on\w+\s*=/.test(html)) {
    return NextResponse.json(
      { error: 'Scripts en event-handlers zijn niet toegestaan in de handtekening.' },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ email_signature_html: html })
    .eq('id', admin.id);
  if (error) {
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }
  return NextResponse.json({ success: true, has_override: true });
}
