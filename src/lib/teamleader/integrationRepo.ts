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
import { geldigeSleutelMetSlot, isVers, type TokenStand } from './tokenVernieuwing';
import { neemCronSlot, geefCronSlotTerug } from '@/lib/cronSlot';

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
  client_id_enc?: string | null;
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

export type TeamleaderConnectionState = {
  row: IntegrationRow | null;
  integration: StoredIntegration | null;
  /** DB heeft connected_at + tokens */
  connected: boolean;
  /** Tokens kunnen met de huidige server-sleutel worden gelezen */
  tokensReadable: boolean;
};

export async function getTeamleaderConnectionState(
  supabase: SupabaseClient,
  customerId: string,
): Promise<TeamleaderConnectionState> {
  const row = await getRawIntegrationRow(supabase, customerId);
  const integration = row ? rowToStored(row) : null;
  const connected = Boolean(
    row?.connected_at && row.access_token_enc && row.refresh_token_enc && row.expires_at,
  );
  return {
    row,
    integration,
    connected,
    tokensReadable: Boolean(integration),
  };
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
  const accessTokenEnc = encryptSecret(tokens.accessToken);
  const refreshTokenEnc = encryptSecret(tokens.refreshToken);
  // Faal hard als encrypt/decrypt op deze server inconsistent is.
  decryptSecret(accessTokenEnc);
  decryptSecret(refreshTokenEnc);

  const payload = {
    customer_id: customerId,
    provider: TEAMLEADER_PROVIDER,
    access_token_enc: accessTokenEnc,
    refresh_token_enc: refreshTokenEnc,
    expires_at: tokens.expiresAt.toISOString(),
    connected_at: now,
    settings,
    updated_at: now,
  };
  const { error } = await supabase.from('customer_integrations').upsert(payload, {
    onConflict: 'customer_id,provider',
  });
  if (error) throw new Error(error.message);

  /* Na (opnieuw) koppelen: wat in de storing bleef hangen opnieuw in de rij,
     met een schone teller. De herhaalronde stuurt ze daarna na, ook leads
     ouder dan 72 uur. Zonder het terugzetten van de teller bleven leads die
     al acht keer waren geprobeerd voorgoed liggen (bij Energiekompas liep een
     lead op tot dertig pogingen). Hooguit 60 dagen terug: wat ouder is,
     verwacht een klant niet meer in zijn CRM. */
  await supabase
    .from('integration_sync_log')
    .update({
      status: 'pending',
      attempts: 0,
      error_message: null,
      updated_at: now,
    })
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 60 * 24 * 3_600_000).toISOString());
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
      'id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at, client_id_enc',
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
  const customerId = integration.customer_id;
  const naarStand = (i: StoredIntegration | null): TokenStand | null =>
    i ? { accessToken: i.access_token, refreshToken: i.refresh_token, verlooptOp: i.expires_at } : null;

  /* Snelle weg: de sleutel in handen is nog geldig. */
  const inHanden = naarStand(integration)!;
  if (isVers(inHanden, Date.now())) return integration.access_token;

  const slot = `teamleader-token:${customerId}`;
  return geldigeSleutelMetSlot({
    lees: async () => naarStand(await getTeamleaderIntegration(supabase, customerId)),
    neemSlot: () => neemCronSlot(supabase, slot, 1),
    geefSlotTerug: () => geefCronSlotTerug(supabase, slot),
    vernieuw: async refreshToken => {
      const oauthConfig = await getEffectiveOAuthConfig(supabase, customerId);
      if (!oauthConfig) {
        throw new Error(
          'Teamleader-koppeling kan niet vernieuwen: OAuth-app credentials ontbreken.',
        );
      }
      const refreshed = await refreshAccessToken(oauthConfig, refreshToken);
      /* Vanaf hier is de oude vernieuwingssleutel bij Teamleader vervallen.
         Mislukt het opslaan, dan is de koppeling stuk; dus een paar keer
         proberen en anders luid melden. */
      let laatsteFout: unknown = null;
      for (let poging = 1; poging <= 3; poging++) {
        try {
          await updateTeamleaderTokens(supabase, customerId, refreshed);
          return refreshed.accessToken;
        } catch (err) {
          laatsteFout = err;
          await new Promise(r => setTimeout(r, 500 * poging));
        }
      }
      console.error('[teamleader] nieuwe sleutel ontvangen maar niet opgeslagen; koppeling moet opnieuw', {
        customerId,
        message: laatsteFout instanceof Error ? laatsteFout.message : String(laatsteFout),
      });
      throw new Error('Nieuwe Teamleader-sleutel kon niet worden opgeslagen; opnieuw koppelen nodig.');
    },
  });
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
