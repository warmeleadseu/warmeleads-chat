import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';
import {
  OUTBOUND_WEBHOOK_PROVIDER,
  type OutboundWebhookSettings,
  type StoredOutboundWebhook,
} from './types';

type WebhookRow = {
  id: string;
  customer_id: string;
  access_token_enc: string | null;
  settings: OutboundWebhookSettings | null;
  connected_at: string | null;
};

export async function getRawOutboundWebhookRow(
  supabase: SupabaseClient,
  customerId: string,
): Promise<WebhookRow | null> {
  const { data } = await supabase
    .from('customer_integrations')
    .select('id, customer_id, access_token_enc, settings, connected_at')
    .eq('customer_id', customerId)
    .eq('provider', OUTBOUND_WEBHOOK_PROVIDER)
    .maybeSingle();
  return (data as WebhookRow | null) ?? null;
}

export async function getOutboundWebhookConfig(
  supabase: SupabaseClient,
  customerId: string,
): Promise<StoredOutboundWebhook | null> {
  const row = await getRawOutboundWebhookRow(supabase, customerId);
  if (!row) return null;

  let token: string | null = null;
  if (row.access_token_enc) {
    try {
      token = decryptSecret(row.access_token_enc);
    } catch (err) {
      console.error('[outbound_webhook] token decrypt failed', {
        customerId,
        message: err instanceof Error ? err.message : String(err),
      });
      token = null;
    }
  }

  return {
    id: row.id,
    customer_id: row.customer_id,
    token,
    settings: row.settings ?? {},
    connected_at: row.connected_at,
  };
}

/**
 * Sync-ready = ingeschakeld + URL. Een bearer-token is optioneel: sommige
 * endpoints (bv. Softr-workflow-webhooks) accepteren de POST zonder auth.
 */
export function isOutboundWebhookSyncReady(
  config: StoredOutboundWebhook | null,
): config is StoredOutboundWebhook {
  if (!config) return false;
  if (config.settings.enabled !== true) return false;
  if (!config.settings.url) return false;
  return true;
}

export async function isOutboundWebhookReadyForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<boolean> {
  return isOutboundWebhookSyncReady(await getOutboundWebhookConfig(supabase, customerId));
}

/** Of een lead met deze branche door het filter mag. Leeg filter = alles. */
export function isBranchAllowed(settings: OutboundWebhookSettings, branch: string | null): boolean {
  const list = settings.branches ?? [];
  if (list.length === 0) return true;
  return branch != null && list.includes(branch);
}

export type SaveOutboundWebhookInput = {
  url?: string | null;
  /** undefined = ongewijzigd laten, null/'' = wissen. */
  token?: string | null;
  enabled?: boolean;
  branches?: string[];
};

export async function saveOutboundWebhookConfig(
  supabase: SupabaseClient,
  customerId: string,
  input: SaveOutboundWebhookInput,
): Promise<void> {
  const existing = await getRawOutboundWebhookRow(supabase, customerId);
  const now = new Date().toISOString();

  const settings: OutboundWebhookSettings = { ...(existing?.settings ?? {}) };
  if (input.url !== undefined) settings.url = input.url?.trim() || null;
  if (input.enabled !== undefined) settings.enabled = input.enabled;
  if (input.branches !== undefined) settings.branches = input.branches;

  const payload: Record<string, unknown> = {
    customer_id: customerId,
    provider: OUTBOUND_WEBHOOK_PROVIDER,
    settings,
    updated_at: now,
  };

  if (input.token !== undefined) {
    if (input.token) {
      const enc = encryptSecret(input.token);
      decryptSecret(enc); // faal hard als encrypt/decrypt inconsistent is
      payload.access_token_enc = enc;
    } else {
      payload.access_token_enc = null;
    }
  }

  // Token is optioneel; een ingestelde URL is voldoende om "gekoppeld" te zijn.
  const willHaveUrl = Boolean(settings.url);
  payload.connected_at = willHaveUrl ? existing?.connected_at ?? now : null;

  const { error } = await supabase
    .from('customer_integrations')
    .upsert(payload, { onConflict: 'customer_id,provider' });
  if (error) throw new Error(error.message);

  // Oude mislukte deliveries opnieuw in de wachtrij na een config-wijziging.
  await supabase
    .from('integration_sync_log')
    .update({ status: 'pending', error_message: null, updated_at: now })
    .eq('customer_id', customerId)
    .eq('provider', OUTBOUND_WEBHOOK_PROVIDER)
    .eq('status', 'failed');
}
