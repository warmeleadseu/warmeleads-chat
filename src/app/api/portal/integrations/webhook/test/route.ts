import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { getOutboundWebhookConfig } from '@/lib/integrations/outboundWebhook/integrationRepo';
import { buildSampleWebhookPayload } from '@/lib/integrations/outboundWebhook/payload';
import { sendWebhookRequest } from '@/lib/integrations/outboundWebhook/transport';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    url?: string | null;
    token?: string | null;
  };

  const supabase = createServerClient();
  const config = await getOutboundWebhookConfig(supabase, session.customer.id);

  // Toegestaan om een nog-niet-opgeslagen URL/token te testen.
  const overrideUrl = typeof body.url === 'string' ? body.url.trim() : '';
  const overrideToken = typeof body.token === 'string' ? body.token.trim() : '';
  const url = overrideUrl || config?.settings.url || '';
  const token = overrideToken || config?.token || '';

  if (!url) {
    return NextResponse.json({ error: 'Geen webhook-URL ingesteld' }, { status: 400 });
  }
  if (!/^https:\/\/.+/i.test(url)) {
    return NextResponse.json(
      { error: 'De webhook-URL moet beginnen met https://' },
      { status: 400 },
    );
  }

  // Token is optioneel: endpoints zoals Softr-workflows accepteren geen auth-header.
  const payload = { ...buildSampleWebhookPayload(), test: true };

  try {
    const res = await sendWebhookRequest(url, token, payload);
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body_snippet: res.bodySnippet,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Test mislukt';
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
