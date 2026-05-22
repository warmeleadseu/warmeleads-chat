export const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4';

/** Lezen + schrijven in spreadsheets waartoe de gebruiker toegang heeft. */
export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

export function getGoogleSheetsCallbackUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://warmeleads.eu';
  return `${base}/api/portal/integrations/google-sheets/callback`;
}

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_INTEGRATION_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_INTEGRATION_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: getGoogleSheetsCallbackUri(),
  };
}
