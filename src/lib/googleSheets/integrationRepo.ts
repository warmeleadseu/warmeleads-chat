import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';
import { getGoogleOAuthConfig } from './config';
import { refreshGoogleAccessToken } from './oauth';
import {
  GOOGLE_SHEETS_PROVIDER,
  type GoogleSheetsIntegrationSettings,
  type GoogleSheetsTokenPair,
} from './types';

export type StoredGoogleSheetsIntegration = {
  id: string;
  customer_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  settings: GoogleSheetsIntegrationSettings;
  connected_at: string | null;
};

type IntegrationRow = {
  id: string;
  customer_id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  settings: GoogleSheetsIntegrationSettings | null;
  connected_at: string | null;
};

function rowToStored(row: IntegrationRow): StoredGoogleSheetsIntegration | null {
  if (!row.access_token_enc || !row.refresh_token_enc || !row.expires_at) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    access_token: decryptSecret(row.access_token_enc),
    refresh_token: decryptSecret(row.refresh_token_enc),
    expires_at: new Date(row.expires_at),
    settings: row.settings ?? { enabled: true },
    connected_at: row.connected_at,
  };
}

export async function getGoogleSheetsIntegration(
  supabase: SupabaseClient,
  customerId: string,
): Promise<StoredGoogleSheetsIntegration | null> {
  const { data } = await supabase
    .from('customer_integrations')
    .select('id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at')
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER)
    .maybeSingle();
  if (!data) return null;
  return rowToStored(data as IntegrationRow);
}

export async function getGoogleSheetsIntegrationRow(
  supabase: SupabaseClient,
  customerId: string,
): Promise<IntegrationRow | null> {
  const { data } = await supabase
    .from('customer_integrations')
    .select('id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at')
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER)
    .maybeSingle();
  return (data as IntegrationRow | null) ?? null;
}

export async function saveGoogleSheetsTokens(
  supabase: SupabaseClient,
  customerId: string,
  tokens: GoogleSheetsTokenPair,
): Promise<void> {
  const existing = await getGoogleSheetsIntegrationRow(supabase, customerId);
  const now = new Date().toISOString();
  const payload = {
    customer_id: customerId,
    provider: GOOGLE_SHEETS_PROVIDER,
    access_token_enc: encryptSecret(tokens.accessToken),
    refresh_token_enc: encryptSecret(tokens.refreshToken),
    expires_at: tokens.expiresAt.toISOString(),
    connected_at: now,
    settings: existing?.settings ?? { enabled: true },
    updated_at: now,
  };
  const { error } = await supabase.from('customer_integrations').upsert(payload, {
    onConflict: 'customer_id,provider',
  });
  if (error) throw new Error(error.message);
}

export async function disconnectGoogleSheets(
  supabase: SupabaseClient,
  customerId: string,
): Promise<void> {
  const existing = await getGoogleSheetsIntegrationRow(supabase, customerId);
  const preservedSettings: GoogleSheetsIntegrationSettings = {
    ...(existing?.settings ?? {}),
    enabled: false,
  };
  await supabase
    .from('customer_integrations')
    .update({
      access_token_enc: null,
      refresh_token_enc: null,
      expires_at: null,
      connected_at: null,
      settings: preservedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER);
}

export async function updateGoogleSheetsSettings(
  supabase: SupabaseClient,
  customerId: string,
  patch: Partial<GoogleSheetsIntegrationSettings>,
): Promise<GoogleSheetsIntegrationSettings> {
  const row = await getGoogleSheetsIntegrationRow(supabase, customerId);
  if (!row) throw new Error('Geen Google Sheets-koppeling');
  const settings: GoogleSheetsIntegrationSettings = { ...(row.settings ?? {}), ...patch };
  const { error } = await supabase
    .from('customer_integrations')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER);
  if (error) throw new Error(error.message);
  return settings;
}

export async function ensureValidGoogleAccessToken(
  supabase: SupabaseClient,
  integration: StoredGoogleSheetsIntegration,
): Promise<string> {
  const bufferMs = 2 * 60 * 1000;
  if (integration.expires_at.getTime() > Date.now() + bufferMs) {
    return integration.access_token;
  }
  const config = getGoogleOAuthConfig();
  if (!config) {
    throw new Error('Google OAuth is niet geconfigureerd op de server.');
  }
  const refreshed = await refreshGoogleAccessToken(config, integration.refresh_token);
  await saveGoogleSheetsTokens(supabase, integration.customer_id, refreshed);
  return refreshed.accessToken;
}
