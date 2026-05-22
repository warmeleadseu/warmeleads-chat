import { createServerClient } from '@/lib/supabase';

export type TeamleaderOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** Verwijdert newlines/spaties — secrets uit copy-paste breken OAuth anders. */
export function stripEnvValue(value: string | undefined | null): string {
  if (value == null) return '';
  return String(value).replace(/[\r\n\u2028\u2029]+/g, '').trim();
}

function defaultRedirectUri(): string {
  const site = stripEnvValue(process.env.NEXT_PUBLIC_SITE_URL);
  const base = site || 'https://warmeleads.eu';
  return `${base.replace(/\/$/, '')}/api/portal/integrations/teamleader/callback`;
}

function fromEnv(): TeamleaderOAuthConfig | null {
  const clientId = stripEnvValue(process.env.TEAMLEADER_CLIENT_ID);
  const clientSecret = stripEnvValue(process.env.TEAMLEADER_CLIENT_SECRET);
  const redirectUri =
    stripEnvValue(process.env.TEAMLEADER_REDIRECT_URI) || defaultRedirectUri();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

const SETTINGS_KEYS = [
  'teamleader_client_id',
  'teamleader_client_secret',
  'teamleader_redirect_uri',
] as const;

export async function getTeamleaderOAuthConfig(): Promise<TeamleaderOAuthConfig | null> {
  const envConfig = fromEnv();
  if (envConfig) return envConfig;

  const supabase = createServerClient();
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
    redirectUri: map.teamleader_redirect_uri || defaultRedirectUri(),
  };
}

export async function isTeamleaderConfigured(): Promise<boolean> {
  return (await getTeamleaderOAuthConfig()) !== null;
}
