import { createHmac, timingSafeEqual } from 'crypto';
import { getRawSessionSecret } from '@/lib/sessionSecrets';
import { TEAMLEADER_AUTH_BASE } from './config';
import type { TeamleaderOAuthConfig } from './credentials';
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

export function buildAuthorizationUrl(
  config: TeamleaderOAuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    state,
  });
  return `${TEAMLEADER_AUTH_BASE}/oauth2/authorize?${params}`;
}

/**
 * Leesbare foutmelding uit het antwoord van Teamleader. Voorheen bleef alleen
 * "Token exchange faalde (400)" over: de reden die Teamleader gaf (sleutel
 * ingetrokken, al gebruikt, verkeerd app-geheim) ging verloren, en daarmee
 * de diagnose toen de koppeling van Energiekompas uitviel.
 */
export function tokenFoutmelding(status: number, tekst: string): string {
  let reden = '';
  try {
    const j = JSON.parse(tekst) as {
      error?: unknown;
      error_description?: unknown;
      message?: unknown;
      errors?: Array<{ title?: unknown; detail?: unknown }>;
    };
    const delen = [
      j.error,
      j.error_description,
      j.message,
      j.errors?.[0]?.title,
      j.errors?.[0]?.detail,
    ].filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    reden = [...new Set(delen)].join(': ');
  } catch {
    reden = tekst.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  reden = reden.slice(0, 300);
  return `Teamleader weigerde de toegang (HTTP ${status})${reden ? `: ${reden}` : ''}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TeamleaderTokenPair> {
  const res = await fetch(`${TEAMLEADER_AUTH_BASE}/oauth2/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const tekst = await res.text();
  let json: { access_token?: string; refresh_token?: string; expires_in?: number } = {};
  try {
    json = JSON.parse(tekst);
  } catch {
    /* geen JSON: hieronder als fout behandeld */
  }
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(tokenFoutmelding(res.status, tekst));
  }
  const expiresIn = json.expires_in ?? 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000 - 60_000),
  };
}

export function exchangeCodeForTokens(
  config: TeamleaderOAuthConfig,
  code: string,
): Promise<TeamleaderTokenPair> {
  return tokenRequest({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });
}

export function refreshAccessToken(
  config: TeamleaderOAuthConfig,
  refreshToken: string,
): Promise<TeamleaderTokenPair> {
  return tokenRequest({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}
