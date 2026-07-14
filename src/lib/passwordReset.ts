import crypto from 'crypto';
import type { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

const DEFAULT_EXPIRY_MS = 60 * 60 * 1000; // 1 uur

/**
 * Hasht een reset-token voor opslag/vergelijking. We bewaren nooit het ruwe
 * token in de database: alleen de SHA-256-hash. Zo is een DB-lek niet direct
 * bruikbaar om wachtwoorden te resetten.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Maakt een wachtwoord-reset/instel-token aan: invalideert bestaande ongebruikte
 * tokens voor dezelfde gebruiker, slaat de hash op en geeft het RUWE token terug
 * (uitsluitend voor in de e-maillink).
 */
export async function createPasswordResetToken(
  supabase: Supabase,
  target: { customerId?: string | null; portalUserId?: string | null },
  opts?: { expiryMs?: number },
): Promise<{ rawToken: string; expiresAt: string }> {
  const column: 'customer_id' | 'portal_user_id' = target.portalUserId
    ? 'portal_user_id'
    : 'customer_id';
  const id = target.portalUserId ?? target.customerId;
  if (!id) throw new Error('createPasswordResetToken: customerId of portalUserId vereist');

  await supabase
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq(column, id)
    .is('used_at', null);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + (opts?.expiryMs ?? DEFAULT_EXPIRY_MS)).toISOString();
  const insertData: Record<string, string> = {
    token: hashResetToken(rawToken),
    expires_at: expiresAt,
  };
  insertData[column] = id;
  await supabase.from('password_reset_tokens').insert(insertData);

  return { rawToken, expiresAt };
}

/** Bouwt de portal-reset-URL met het ruwe token. */
export function buildResetUrl(rawToken: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  return `${base}/portal/wachtwoord-resetten?token=${rawToken}`;
}
