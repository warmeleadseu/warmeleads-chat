import { createHmac, timingSafeEqual } from 'crypto';
import { getRawSessionSecret } from '@/lib/sessionSecrets';

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  return getRawSessionSecret();
}

/** OAuth state: customerId.provider.exp.signature */
export function buildIntegrationOAuthState(customerId: string, provider: string): string {
  const exp = Date.now() + STATE_TTL_MS;
  const payload = `${customerId}.${provider}.${exp}`;
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function parseIntegrationOAuthState(
  state: string,
  expectedProvider: string,
): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 4) return null;
    const [customerId, provider, expStr, sig] = parts;
    if (provider !== expectedProvider) return null;
    const exp = Number(expStr);
    if (!customerId || !Number.isFinite(exp) || Date.now() > exp) return null;
    const payload = `${customerId}.${provider}.${expStr}`;
    const expected = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return customerId;
  } catch {
    return null;
  }
}
