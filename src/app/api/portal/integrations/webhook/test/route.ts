import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import { getOutboundWebhookConfig } from '@/lib/integrations/outboundWebhook/integrationRepo';
import {
  buildSampleWebhookPayload,
  pickWebhookSampleBranch,
} from '@/lib/integrations/outboundWebhook/payload';
import { sendWebhookRequest } from '@/lib/integrations/outboundWebhook/transport';
import { assertPublicHttpUrl } from '@/lib/ssrfGuard';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    url?: string | null;
    token?: string | null;
    branch?: string | null;
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

  // SSRF-guard: blokkeer privé/gereserveerde adressen vóór we iets versturen.
  const ssrf = await assertPublicHttpUrl(url);
  if (!ssrf.ok) {
    return NextResponse.json({ error: `URL geweigerd: ${ssrf.reason}` }, { status: 400 });
  }

  const branch = pickWebhookSampleBranch({
    preferred: typeof body.branch === 'string' ? body.branch : null,
    webhookBranches: config?.settings.branches,
    customerBranches: session.customer.branches,
  });

  // Token is optioneel: endpoints zoals Softr-workflows accepteren geen auth-header.
  // Voorbeeld-payload volgens de door de klant ingestelde veld-mapping + branche.
  const payload = {
    ...buildSampleWebhookPayload(config?.settings.field_mappings, { branch }),
    test: true,
  };

  const res = await sendWebhookRequest(url, token, payload);
  // Een timeout telt als geslaagd: de payload is verstuurd, alleen het antwoord
  // bleef uit (gedrag dat we ook bij echte leads als afgeleverd beschouwen).
  const delivered = res.ok || res.outcome === 'timeout';
  return NextResponse.json({
    ok: delivered,
    status: res.status,
    branch,
    body_snippet: res.bodySnippet,
    ...(delivered ? {} : { error: res.errorMessage }),
    ...(res.outcome === 'timeout' ? { note: res.errorMessage } : {}),
  });
}
