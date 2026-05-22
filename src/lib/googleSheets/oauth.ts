import {
  buildIntegrationOAuthState,
  parseIntegrationOAuthState,
} from '@/lib/integrations/oauthState';
import { GOOGLE_OAUTH_AUTH_URL, GOOGLE_OAUTH_TOKEN_URL, GOOGLE_SHEETS_SCOPE } from './config';
import type { GoogleOAuthConfig } from './config';
import { GOOGLE_SHEETS_PROVIDER } from './types';
import type { GoogleSheetsTokenPair } from './types';

export function buildGoogleOAuthState(customerId: string): string {
  return buildIntegrationOAuthState(customerId, GOOGLE_SHEETS_PROVIDER);
}

export function parseGoogleOAuthState(state: string): string | null {
  return parseIntegrationOAuthState(state, GOOGLE_SHEETS_PROVIDER);
}

export function buildGoogleAuthorizationUrl(config: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SHEETS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_OAUTH_AUTH_URL}?${params}`;
}

async function tokenRequest(
  config: GoogleOAuthConfig,
  body: Record<string, string>,
): Promise<GoogleSheetsTokenPair> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Google token exchange mislukt (${res.status})`,
    );
  }
  const expiresIn = json.expires_in ?? 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? body.refresh_token ?? '',
    expiresAt: new Date(Date.now() + expiresIn * 1000 - 60_000),
  };
}

export function exchangeGoogleCodeForTokens(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleSheetsTokenPair> {
  return tokenRequest(config, {
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });
}

export function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
): Promise<GoogleSheetsTokenPair> {
  return tokenRequest(config, {
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}
