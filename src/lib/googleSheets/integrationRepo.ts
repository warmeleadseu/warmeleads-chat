import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';
import { getGoogleOAuthConfig } from './config';
import { refreshGoogleAccessToken } from './oauth';
import {
  GOOGLE_SHEETS_PROVIDER,
  type GoogleSheetsConnectionMode,
  type GoogleSheetsIntegrationPublic,
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

function inferConnectionMode(row: IntegrationRow): GoogleSheetsConnectionMode | null {
  if (row.settings?.connection_mode) return row.settings.connection_mode;
  if (row.access_token_enc && row.refresh_token_enc) return 'oauth';
  if (row.connected_at) return 'service_account';
  return null;
}

export function rowToGoogleSheetsIntegrationPublic(
  row: IntegrationRow,
): GoogleSheetsIntegrationPublic {
  return {
    id: row.id,
    customer_id: row.customer_id,
    settings: row.settings ?? { enabled: true },
    connected_at: row.connected_at,
    connection_mode: inferConnectionMode(row),
  };
}

export async function getGoogleSheetsIntegrationPublic(
  supabase: SupabaseClient,
  customerId: string,
): Promise<GoogleSheetsIntegrationPublic | null> {
  const row = await getGoogleSheetsIntegrationRow(supabase, customerId);
  if (!row) return null;
  return rowToGoogleSheetsIntegrationPublic(row);
}

/** Zorgt voor een customer_integrations-rij zonder OAuth. */
export async function ensureGoogleSheetsIntegrationRow(
  supabase: SupabaseClient,
  customerId: string,
): Promise<IntegrationRow> {
  const existing = await getGoogleSheetsIntegrationRow(supabase, customerId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const settings: GoogleSheetsIntegrationSettings = {
    enabled: true,
    connection_mode: 'service_account',
  };
  const { error } = await supabase.from('customer_integrations').insert({
    customer_id: customerId,
    provider: GOOGLE_SHEETS_PROVIDER,
    settings,
    connected_at: null,
    updated_at: now,
  });
  if (error) throw new Error(error.message);

  const row = await getGoogleSheetsIntegrationRow(supabase, customerId);
  if (!row) throw new Error('Google Sheets-koppeling aanmaken mislukt');
  return row;
}

/** Markeert koppeling actief na succesvolle spreadsheet-setup (zonder Google-login). */
export async function markGoogleSheetsConnected(
  supabase: SupabaseClient,
  customerId: string,
): Promise<void> {
  const row = await ensureGoogleSheetsIntegrationRow(supabase, customerId);
  if (row.connected_at && row.settings?.connection_mode === 'oauth') return;

  const now = new Date().toISOString();
  const settings: GoogleSheetsIntegrationSettings = {
    ...(row.settings ?? {}),
    enabled: true,
    connection_mode: row.access_token_enc ? 'oauth' : 'service_account',
  };
  const { error } = await supabase
    .from('customer_integrations')
    .update({
      connected_at: row.connected_at ?? now,
      settings,
      updated_at: now,
    })
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER);
  if (error) throw new Error(error.message);
}

export async function saveGoogleSheetsTokens(
  supabase: SupabaseClient,
  customerId: string,
  tokens: GoogleSheetsTokenPair,
): Promise<void> {
  const existing = await getGoogleSheetsIntegrationRow(supabase, customerId);
  const now = new Date().toISOString();
  const settings: GoogleSheetsIntegrationSettings = {
    ...(existing?.settings ?? {}),
    enabled: true,
    connection_mode: 'oauth',
  };
  const payload = {
    customer_id: customerId,
    provider: GOOGLE_SHEETS_PROVIDER,
    access_token_enc: encryptSecret(tokens.accessToken),
    refresh_token_enc: encryptSecret(tokens.refreshToken),
    expires_at: tokens.expiresAt.toISOString(),
    connected_at: now,
    settings,
    updated_at: now,
  };
  const { error } = await supabase.from('customer_integrations').upsert(payload, {
    onConflict: 'customer_id,provider',
  });
  if (error) throw new Error(error.message);
}

/** Vernieuw tokens na expiry — laat connected_at en settings ongemoeid. */
export async function updateGoogleSheetsTokens(
  supabase: SupabaseClient,
  customerId: string,
  tokens: GoogleSheetsTokenPair,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('customer_integrations')
    .update({
      access_token_enc: encryptSecret(tokens.accessToken),
      refresh_token_enc: encryptSecret(tokens.refreshToken),
      expires_at: tokens.expiresAt.toISOString(),
      updated_at: now,
    })
    .eq('customer_id', customerId)
    .eq('provider', GOOGLE_SHEETS_PROVIDER);
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
  const row = await ensureGoogleSheetsIntegrationRow(supabase, customerId);
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
  await updateGoogleSheetsTokens(supabase, integration.customer_id, refreshed);
  return refreshed.accessToken;
}
