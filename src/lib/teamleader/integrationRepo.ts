import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';
import { refreshAccessToken } from './oauth';
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

export async function getTeamleaderIntegration(
  supabase: SupabaseClient,
  customerId: string,
): Promise<StoredIntegration | null> {
  const { data } = await supabase
    .from('customer_integrations')
    .select('id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at')
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .maybeSingle();
  if (!data) return null;
  return rowToStored(data as IntegrationRow);
}

export async function saveTeamleaderTokens(
  supabase: SupabaseClient,
  customerId: string,
  tokens: TeamleaderTokenPair,
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    customer_id: customerId,
    provider: TEAMLEADER_PROVIDER,
    access_token_enc: encryptSecret(tokens.accessToken),
    refresh_token_enc: encryptSecret(tokens.refreshToken),
    expires_at: tokens.expiresAt.toISOString(),
    connected_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from('customer_integrations').upsert(payload, {
    onConflict: 'customer_id,provider',
  });
  if (error) throw new Error(error.message);
}

export async function disconnectTeamleader(
  supabase: SupabaseClient,
  customerId: string,
): Promise<void> {
  await supabase
    .from('customer_integrations')
    .delete()
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER);
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

export async function ensureValidAccessToken(
  supabase: SupabaseClient,
  integration: StoredIntegration,
): Promise<string> {
  const bufferMs = 2 * 60 * 1000;
  if (integration.expires_at.getTime() > Date.now() + bufferMs) {
    return integration.access_token;
  }
  const refreshed = await refreshAccessToken(integration.refresh_token);
  await saveTeamleaderTokens(supabase, integration.customer_id, refreshed);
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
