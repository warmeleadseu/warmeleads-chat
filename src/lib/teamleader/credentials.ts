import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';
import { decryptSecret, encryptSecret } from '@/lib/integrations/tokenEncrypt';
import { TEAMLEADER_PROVIDER } from './types';

export type TeamleaderOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Bron van de credentials — bepaalt UI-copy in portaal/admin. */
  source: 'customer' | 'global';
};

/**
 * Strip newlines en (un)trim — copy-paste van secrets bevat vaak een
 * achterliggende newline waardoor OAuth stilletjes faalt.
 */
export function stripEnvValue(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value).replace(/[\r\n\u2028\u2029]+/g, '').trim();
}

/**
 * Default redirect URI = onze callback. Klanten moeten exact deze URL
 * whitelisten in hun eigen Teamleader-integratie.
 */
export function getCallbackRedirectUri(): string {
  const site = stripEnvValue(process.env.NEXT_PUBLIC_SITE_URL);
  const base = site || 'https://warmeleads.eu';
  return `${base.replace(/\/$/, '')}/api/portal/integrations/teamleader/callback`;
}

function fromEnv(): Omit<TeamleaderOAuthConfig, 'source'> | null {
  const clientId = stripEnvValue(process.env.TEAMLEADER_CLIENT_ID);
  const clientSecret = stripEnvValue(process.env.TEAMLEADER_CLIENT_SECRET);
  const redirectUri =
    stripEnvValue(process.env.TEAMLEADER_REDIRECT_URI) || getCallbackRedirectUri();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

const SETTINGS_KEYS = [
  'teamleader_client_id',
  'teamleader_client_secret',
  'teamleader_redirect_uri',
] as const;

async function fromAppSettings(
  supabase: SupabaseClient,
): Promise<Omit<TeamleaderOAuthConfig, 'source'> | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', [...SETTINGS_KEYS]);
  if (!data?.length) return null;
  const map: Record<string, string> = {};
  for (const row of data) map[row.key] = stripEnvValue(row.value);
  const clientId = map.teamleader_client_id;
  const clientSecret = map.teamleader_client_secret;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: map.teamleader_redirect_uri || getCallbackRedirectUri(),
  };
}

/** Globale Warme Leads-OAuth-app (fallback, optioneel). */
export async function getGlobalOAuthConfig(): Promise<TeamleaderOAuthConfig | null> {
  const env = fromEnv();
  if (env) return { ...env, source: 'global' };
  const supabase = createServerClient();
  const settings = await fromAppSettings(supabase);
  if (settings) return { ...settings, source: 'global' };
  return null;
}

/** Klant-eigen OAuth-app credentials uit `customer_integrations`. */
export async function getCustomerOAuthConfig(
  supabase: SupabaseClient,
  customerId: string,
): Promise<TeamleaderOAuthConfig | null> {
  const { data } = await supabase
    .from('customer_integrations')
    .select('client_id_enc, client_secret_enc')
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER)
    .maybeSingle();
  if (!data?.client_id_enc || !data?.client_secret_enc) return null;
  try {
    return {
      clientId: decryptSecret(data.client_id_enc),
      clientSecret: decryptSecret(data.client_secret_enc),
      redirectUri: getCallbackRedirectUri(),
      source: 'customer',
    };
  } catch {
    return null;
  }
}

/**
 * Resolved OAuth-config voor één specifieke klant:
 *   1. Klant-eigen credentials in `customer_integrations` (BYOA).
 *   2. Globale Warme Leads-OAuth-app (Vercel env of Admin → Koppelingen).
 *
 * Klanten hebben dus volledige controle en hoeven onze app niet te gebruiken.
 */
export async function getEffectiveOAuthConfig(
  supabase: SupabaseClient,
  customerId: string,
): Promise<TeamleaderOAuthConfig | null> {
  const customer = await getCustomerOAuthConfig(supabase, customerId);
  if (customer) return customer;
  return getGlobalOAuthConfig();
}

export async function saveCustomerOAuthCredentials(
  supabase: SupabaseClient,
  customerId: string,
  args: { clientId: string; clientSecret: string },
): Promise<{ changed: boolean }> {
  const clientId = stripEnvValue(args.clientId);
  const clientSecret = stripEnvValue(args.clientSecret);
  if (!clientId || !clientSecret) {
    throw new Error('Vul zowel Client ID als Client Secret in.');
  }

  const existing = await getCustomerOAuthConfig(supabase, customerId);
  const changed =
    !existing ||
    existing.clientId !== clientId ||
    existing.clientSecret !== clientSecret;

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    customer_id: customerId,
    provider: TEAMLEADER_PROVIDER,
    client_id_enc: encryptSecret(clientId),
    client_secret_enc: encryptSecret(clientSecret),
    updated_at: now,
  };
  if (changed) {
    // Bestaande tokens zijn aan de oude app gekoppeld → ongeldig maken.
    payload.access_token_enc = null;
    payload.refresh_token_enc = null;
    payload.expires_at = null;
    payload.connected_at = null;
  }

  const { error } = await supabase
    .from('customer_integrations')
    .upsert(payload, { onConflict: 'customer_id,provider' });
  if (error) throw new Error(error.message);
  return { changed };
}

/**
 * Verwijder klant-eigen OAuth-app credentials. Bestaande access/refresh
 * tokens zijn onbruikbaar zonder die credentials (en kunnen niet meer
 * vernieuwd worden), dus die ruimen we tegelijk op.
 */
export async function clearCustomerOAuthCredentials(
  supabase: SupabaseClient,
  customerId: string,
): Promise<void> {
  await supabase
    .from('customer_integrations')
    .update({
      client_id_enc: null,
      client_secret_enc: null,
      access_token_enc: null,
      refresh_token_enc: null,
      expires_at: null,
      connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', customerId)
    .eq('provider', TEAMLEADER_PROVIDER);
}

/**
 * Of er überhaupt OAuth mogelijk is voor déze klant — voor portaal-UI.
 * (configured = klant heeft eigen app OF Warme Leads-app is geconfigureerd)
 */
export async function isTeamleaderConfiguredForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{
  configured: boolean;
  source: 'customer' | 'global' | null;
}> {
  const config = await getEffectiveOAuthConfig(supabase, customerId);
  return {
    configured: !!config,
    source: config?.source ?? null,
  };
}

/** Legacy export — wordt nog gebruikt door admin status route en oude tests. */
export async function getTeamleaderOAuthConfig(): Promise<TeamleaderOAuthConfig | null> {
  return getGlobalOAuthConfig();
}

/** Legacy boolean — globale config aanwezig (admin-only check). */
export async function isTeamleaderConfigured(): Promise<boolean> {
  return (await getGlobalOAuthConfig()) !== null;
}
