import { stripEnvValue } from '@/lib/teamleader/credentials';

export const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4';

/** Lezen + schrijven in spreadsheets waartoe de gebruiker toegang heeft. */
export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Service account (project Google Sheets Webapp) — optioneel via env. */
const DEFAULT_GOOGLE_SERVICE_ACCOUNT_EMAIL =
  'warmeleads-sheets@light-footing-452919-u7.iam.gserviceaccount.com';

export function getGoogleServiceAccountEmail(): string {
  return (
    stripEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) ||
    DEFAULT_GOOGLE_SERVICE_ACCOUNT_EMAIL
  );
}

export function getGoogleSheetsCallbackUri(): string {
  const base = stripEnvValue(process.env.NEXT_PUBLIC_APP_URL) || 'https://warmeleads.eu';
  return `${base.replace(/\/$/, '')}/api/portal/integrations/google-sheets/callback`;
}

/** API key uit Google Cloud (project Google Sheets Webapp). Geen newlines. */
export function getGoogleSheetsApiKey(): string {
  return stripEnvValue(process.env.GOOGLE_SHEETS_API_KEY);
}

export function isGoogleSheetsApiKeyConfigured(): boolean {
  return getGoogleSheetsApiKey().length > 0;
}

/** Voegt `key=` toe aan Sheets API-paden (quota/project-identificatie naast OAuth Bearer). */
export function appendGoogleSheetsApiKey(path: string): string {
  const key = getGoogleSheetsApiKey();
  if (!key) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}key=${encodeURIComponent(key)}`;
}

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = stripEnvValue(process.env.GOOGLE_INTEGRATION_CLIENT_ID);
  const clientSecret = stripEnvValue(process.env.GOOGLE_INTEGRATION_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: getGoogleSheetsCallbackUri(),
  };
}

export function getGoogleServiceAccountPrivateKeyConfigured(): boolean {
  return Boolean(stripEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY));
}

/** URL-koppeling: API key + service account (geen klant-OAuth). */
export function isGoogleSheetsIntegrationServerReady(): boolean {
  return (
    isGoogleSheetsApiKeyConfigured() && getGoogleServiceAccountPrivateKeyConfigured()
  );
}

/** Legacy: klant autoriseert eigen Google-account. */
export function isGoogleSheetsOAuthServerReady(): boolean {
  return !!getGoogleOAuthConfig() && isGoogleSheetsApiKeyConfigured();
}
