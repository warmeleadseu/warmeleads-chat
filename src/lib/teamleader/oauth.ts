import { createHmac, timingSafeEqual } from 'crypto';
import { getRawSessionSecret } from '@/lib/sessionSecrets';
import { TEAMLEADER_AUTH_BASE } from './config';
import { getTeamleaderOAuthConfig } from './credentials';
import type { TeamleaderTokenPair } from './types';

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  return getRawSessionSecret();
}

export function buildOAuthState(customerId: string): string {
  const exp = Date.now() + STATE_TTL_MS;
  const payload = `${customerId}.${exp}`;
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function parseOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return null;
    const [customerId, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!customerId || !Number.isFinite(exp) || Date.now() > exp) return null;
    const payload = `${customerId}.${expStr}`;
    const expected = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return customerId;
  } catch {
    return null;
  }
}

export async function getAuthorizationUrl(state: string): Promise<string> {
  const config = await getTeamleaderOAuthConfig();
  if (!config) throw new Error('Teamleader OAuth niet geconfigureerd');
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    state,
  });
  return `${TEAMLEADER_AUTH_BASE}/oauth2/authorize?${params}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TeamleaderTokenPair> {
  const config = await getTeamleaderOAuthConfig();
  if (!config) throw new Error('Teamleader OAuth niet geconfigureerd');

  const res = await fetch(`${TEAMLEADER_AUTH_BASE}/oauth2/access_token`, {
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
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error_description || json.error || `Token exchange failed (${res.status})`);
  }
  const expiresIn = json.expires_in ?? 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000 - 60_000),
  };
}

export async function exchangeCodeForTokens(code: string): Promise<TeamleaderTokenPair> {
  const config = await getTeamleaderOAuthConfig();
  if (!config) throw new Error('Teamleader OAuth niet geconfigureerd');
  return tokenRequest({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TeamleaderTokenPair> {
  const config = await getTeamleaderOAuthConfig();
  if (!config) throw new Error('Teamleader OAuth niet geconfigureerd');
  return tokenRequest({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}
