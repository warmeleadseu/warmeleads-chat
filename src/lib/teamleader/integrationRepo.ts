import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';
import { refreshAccessToken } from './oauth';
import { getEffectiveOAuthConfig } from './credentials';
import {
  TEAMLEADER_PROVIDER,
  type TeamleaderIntegrationSettings,
  type TeamleaderTokenPair,
} from './types';
import { getFirstPhaseId } from './deals';

export type StoredIntegration = {
  id: string;
  customer_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  settings: TeamleaderIntegrationSettings;
  connected_at: string | null;
};

type IntegrationRow = {
  id: string;
  customer_id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  settings: TeamleaderIntegrationSettings | null;
  connected_at: string | null;
};

function rowToStored(row: IntegrationRow): StoredIntegration | null {
  if (!row.access_token_enc || !row.refresh_token_enc || !row.expires_at) return null;
  try {
    return {
      id: row.id,
      customer_id: row.customer_id,
      access_token: decryptSecret(row.access_token_enc),
      refresh_token: decryptSecret(row.refresh_token_enc),
      expires_at: new Date(row.expires_at),
      settings: row.settings ?? { enabled: true },
      connected_at: row.connected_at,
    };
  } catch (err) {
    console.error('[teamleader] token decrypt failed', {
      customerId: row.customer_id,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function getTeamleaderIntegration(
  supabase: SupabaseClient,
  customerId: string,
): Promise<StoredIntegration | null> {
  const row = await getRawIntegrationRow(supabase, customerId);
  if (!row) return null;
  return rowToStored(row);
}

/** True wanneer er tokens in de DB staan maar decrypt faalt (opnieuw koppelen vereist). */
export async function isTeamleaderTokenDecryptBroken(
  supabase: SupabaseClient,
  customerId: string,
): Promise<boolean> {
  const row = await getRawIntegrationRow(supabase, customerId);
  if (!row?.connected_at || !row.access_token_enc || !row.refresh_token_enc) return false;
  return rowToStored(row) === null;
}

export async function saveTeamleaderTokens(
  supabase: SupabaseClient,
  customerId: string,
  tokens: TeamleaderTokenPair,
): Promise<void> {
  const existing = await getRawIntegrationRow(supabase, customerId);
  const now = new Date().toISOString();
  const settings: TeamleaderIntegrationSettings = {
    ...(existing?.settings ?? {}),
    enabled: true,
  };
  const payload = {
    customer_id: customerId,
    provider: TEAMLEADER_PROVIDER,
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
export async function updateTeamleaderTokens(
  supabase: SupabaseClient,
  customerId: string,
  tokens: TeamleaderTokenPair,
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
    .eq('provider', TEAMLEADER_PROVIDER);
  if (error) throw new Error(error.message);
}

/**
 * Ontkoppelen: gooi alleen de OAuth-tokens weg. Pipeline-keuze,
 * deal-titel-template en eigen OAuth-app credentials blijven bewaard
 * zodat opnieuw koppelen één klik is.
 */
export async function disconnectTeamleader(
  supabase: SupabaseClient,
  customerId: string,
): Promise<void> {
  const existing = await getRawIntegrationRow(supabase, customerId);
  const preservedSettings: TeamleaderIntegrationSettings = {
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
    .eq('provider', TEAMLEADER_PROVIDER);
}

/** Volledig opruimen — ook de eigen OAuth-app credentials en sync-log. */
export async function fullyRemoveTeamleader(
  supabase: SupabaseClient,
  customerId: string,
): Promise<void> {
  await supabase
    .from('customer_integrations')
    .delete()
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER);
}

/** Lees de row zonder decrypt te forceren (helper voor disconnect). */
export async function getRawIntegrationRow(
  supabase: SupabaseClient,
  customerId: string,
): Promise<IntegrationRow | null> {
  const { data } = await supabase
    .from('customer_integrations')
    .select(
      'id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at',
    )
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .maybeSingle();
  return (data as IntegrationRow | null) ?? null;
}

export async function updateTeamleaderSettings(
  supabase: SupabaseClient,
  customerId: string,
  patch: Partial<TeamleaderIntegrationSettings>,
): Promise<TeamleaderIntegrationSettings> {
  const existing = await getTeamleaderIntegration(supabase, customerId);
  if (!existing) throw new Error('Geen Teamleader-koppeling');
  const settings: TeamleaderIntegrationSettings = { ...existing.settings, ...patch };
  if (patch.pipeline_id && patch.pipeline_id !== existing.settings.pipeline_id) {
    settings.phase_id = null;
  }
  const { error } = await supabase
    .from('customer_integrations')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER);
  if (error) throw new Error(error.message);
  return settings;
}

/**
 * Geef een geldig access token terug. Refresht zo nodig — gebruikt de
 * OAuth-config van **deze** klant (BYOA) of valt terug op de globale app.
 */
export async function ensureValidAccessToken(
  supabase: SupabaseClient,
  integration: StoredIntegration,
): Promise<string> {
  const bufferMs = 2 * 60 * 1000;
  if (integration.expires_at.getTime() > Date.now() + bufferMs) {
    return integration.access_token;
  }
  const oauthConfig = await getEffectiveOAuthConfig(supabase, integration.customer_id);
  if (!oauthConfig) {
    throw new Error(
      'Teamleader-koppeling kan niet vernieuwen: OAuth-app credentials ontbreken.',
    );
  }
  const refreshed = await refreshAccessToken(oauthConfig, integration.refresh_token);
  await updateTeamleaderTokens(supabase, integration.customer_id, refreshed);
  return refreshed.accessToken;
}

export async function resolvePhaseIdForPipeline(
  supabase: SupabaseClient,
  integration: StoredIntegration,
  accessToken: string,
  pipelineId: string,
): Promise<string | null> {
  if (
    integration.settings.phase_id &&
    integration.settings.pipeline_id === pipelineId
  ) {
    return integration.settings.phase_id;
  }
  const phaseId = await getFirstPhaseId(accessToken, pipelineId);
  if (phaseId) {
    await updateTeamleaderSettings(supabase, integration.customer_id, {
      pipeline_id: pipelineId,
      phase_id: phaseId,
    });
  }
  return phaseId;
}
