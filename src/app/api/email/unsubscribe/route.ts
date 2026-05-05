import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

interface ResolvedToken {
  email: string;
  emailLogId: string;
  templateKey: string | null;
  scope: string;
}

async function resolveToken(token: string): Promise<ResolvedToken | null> {
  if (!token) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('email_log')
    .select('id, to_email, template_key, type')
    .eq('unsubscribe_token', token)
    .maybeSingle();
  if (!data) return null;
  // Scope leiden we af van de type-prefix (am_<template>) zodat we tegen
  // dezelfde categorie uitschrijven. We vangen onbekende templates op door
  // standaard 'all' te kiezen.
  const scope = (() => {
    if (!data.template_key) return 'all';
    if (data.template_key === 'pricing_overview' || data.template_key === 'proposal') return 'pricing';
    if (
      data.template_key === 'follow_up' ||
      data.template_key === 'meeting_request' ||
      data.template_key === 'welcome_customer'
    )
      return 'nurture';
    return 'marketing';
  })();
  return {
    email: data.to_email,
    emailLogId: data.id,
    templateKey: data.template_key,
    scope,
  };
}

async function persistOptout(
  email: string,
  scope: string,
  emailLogId: string,
  source: string,
): Promise<void> {
  const supabase = createServerClient();
  const lowered = email.toLowerCase();
  // 'all' impliceert volledige uitschrijving; specifieke scope blijft naast
  // 'all' bestaan voor audit, maar 'all' is leidend bij filtering.
  await supabase.from('email_optouts').upsert(
    [
      { email: lowered, scope, source, unsubscribed_via_message_id: emailLogId },
      { email: lowered, scope: 'all', source, unsubscribed_via_message_id: emailLogId },
    ],
    { onConflict: 'email,scope' },
  );
}

/** GET: rendert nu in /email/unsubscribe-pagina, deze API is alleen voor 1-click POST. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const resolved = await resolveToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link' }, { status: 404 });
  }
  return NextResponse.json({
    email: resolved.email,
    template_key: resolved.templateKey,
    scope: resolved.scope,
  });
}

/**
 * POST handelt zowel het webformulier als RFC 8058 List-Unsubscribe-Post af.
 * Body kan leeg zijn; token komt uit query of body. Na success: idempotent.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  let token = url.searchParams.get('token') || '';
  let scopeOverride: string | null = null;
  if (!token) {
    try {
      const body = await request.json();
      if (typeof body?.token === 'string') token = body.token;
      if (typeof body?.scope === 'string') scopeOverride = body.scope;
    } catch {
      // form-encoded fallback
      const text = await request.text();
      const params = new URLSearchParams(text);
      token = params.get('token') || token;
      if (params.get('scope')) scopeOverride = params.get('scope');
    }
  }

  const resolved = await resolveToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Ongeldige of verlopen link' }, { status: 404 });
  }

  const scope = scopeOverride || 'all';
  await persistOptout(resolved.email, scope, resolved.emailLogId, 'unsubscribe_link');

  return NextResponse.json({
    success: true,
    email: resolved.email,
    scope,
  });
}
