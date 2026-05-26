import { SignJWT, importPKCS8 } from 'jose';
import { GOOGLE_OAUTH_TOKEN_URL, GOOGLE_SHEETS_SCOPE, getGoogleServiceAccountEmail } from './config';

function getPrivateKeyPem(): string {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '';
  raw = raw.trim().replace(/^["']|["']$/g, '');
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n');
}

export function isGoogleServiceAccountConfigured(): boolean {
  return Boolean(getGoogleServiceAccountEmail() && getPrivateKeyPem());
}

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

/**
 * Access token voor de Warme Leads service account (JWT bearer).
 * Gebruikt voor Sheets read/write wanneer de spreadsheet met dit account is gedeeld.
 */
export async function getGoogleServiceAccountAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > now + 60_000) {
    return cachedAccessToken.token;
  }

  const clientEmail = getGoogleServiceAccountEmail();
  const privateKeyPem = getPrivateKeyPem();
  if (!clientEmail || !privateKeyPem) {
    throw new Error('Google service account is niet geconfigureerd op de server.');
  }

  const privateKey = await importPKCS8(privateKeyPem, 'RS256');
  const iat = Math.floor(now / 1000);
  const assertion = await new SignJWT({ scope: GOOGLE_SHEETS_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 3600)
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience(GOOGLE_OAUTH_TOKEN_URL)
    .sign(privateKey);

  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Google service account token mislukt: ${detail}`);
  }

  const expiresInSec = data.expires_in ?? 3600;
  cachedAccessToken = {
    token: data.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return data.access_token;
}
