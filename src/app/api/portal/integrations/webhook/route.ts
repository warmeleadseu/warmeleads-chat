import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { requireIntegrationOwner } from '@/lib/integrations/portalIntegrationAuth';
import {
  getOutboundWebhookConfig,
  isOutboundWebhookSyncReady,
  saveOutboundWebhookConfig,
} from '@/lib/integrations/outboundWebhook/integrationRepo';
import { OUTBOUND_WEBHOOK_PROVIDER } from '@/lib/integrations/outboundWebhook/types';

type LastDelivery = {
  status: string;
  at: string;
  error: string | null;
} | null;

async function loadLastDelivery(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<LastDelivery> {
  const { data } = await supabase
    .from('integration_sync_log')
    .select('status, error_message, updated_at')
    .eq('customer_id', customerId)
    .eq('provider', OUTBOUND_WEBHOOK_PROVIDER)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    status: data.status as string,
    at: data.updated_at as string,
    error: (data.error_message as string | null) ?? null,
  };
}

function tokenHint(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 4) return '••••';
  return `••••${token.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const supabase = createServerClient();
  const config = await getOutboundWebhookConfig(supabase, session.customer.id);
  const lastDelivery = await loadLastDelivery(supabase, session.customer.id);

  return NextResponse.json({
    enabled: config?.settings.enabled ?? false,
    url: config?.settings.url ?? '',
    branches: config?.settings.branches ?? [],
    has_token: Boolean(config?.token),
    token_hint: tokenHint(config?.token ?? null),
    sync_ready: isOutboundWebhookSyncReady(config),
    available_branches: session.customer.branches ?? [],
    last_delivery: lastDelivery,
  });
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  const denied = requireIntegrationOwner(session);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
    url?: string | null;
    token?: string | null;
    branches?: string[];
  };

  const patch: Parameters<typeof saveOutboundWebhookConfig>[2] = {};

  if (body.url !== undefined) {
    const url = (body.url ?? '').trim();
    if (url && !/^https:\/\/.+/i.test(url)) {
      return NextResponse.json(
        { error: 'De webhook-URL moet beginnen met https://' },
        { status: 400 },
      );
    }
    patch.url = url || null;
  }

  if (body.token !== undefined) {
    // Lege string = ongemoeid laten; expliciet wissen kan via "__clear__".
    if (body.token === '__clear__') patch.token = null;
    else if (typeof body.token === 'string' && body.token.trim().length > 0) {
      patch.token = body.token.trim();
    }
  }

  if (body.branches !== undefined) {
    const allowed = new Set(session.customer.branches ?? []);
    const branches = Array.isArray(body.branches)
      ? body.branches.filter((b) => typeof b === 'string' && allowed.has(b))
      : [];
    patch.branches = branches;
  }

  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;

  const supabase = createServerClient();

  // Inschakelen kan alleen met een geldige URL. Een token is optioneel
  // (sommige endpoints, bv. Softr-workflows, vereisen geen auth-header).
  if (patch.enabled === true) {
    const current = await getOutboundWebhookConfig(supabase, session.customer.id);
    const finalUrl = patch.url !== undefined ? patch.url : current?.settings.url ?? null;
    if (!finalUrl) {
      return NextResponse.json(
        { error: 'Vul eerst een webhook-URL in voordat je de koppeling inschakelt.' },
        { status: 400 },
      );
    }
  }

  try {
    await saveOutboundWebhookConfig(supabase, session.customer.id, patch);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Opslaan mislukt';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const config = await getOutboundWebhookConfig(supabase, session.customer.id);
  const lastDelivery = await loadLastDelivery(supabase, session.customer.id);

  return NextResponse.json({
    enabled: config?.settings.enabled ?? false,
    url: config?.settings.url ?? '',
    branches: config?.settings.branches ?? [],
    has_token: Boolean(config?.token),
    token_hint: tokenHint(config?.token ?? null),
    sync_ready: isOutboundWebhookSyncReady(config),
    available_branches: session.customer.branches ?? [],
    last_delivery: lastDelivery,
  });
}
