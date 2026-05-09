/**
 * Single application secret for signing admin + portal session JWTs and admin impersonation JWTs.
 * Production: APP_SESSION_SECRET (≥32 chars). Legacy: ADMIN_SESSION_SECRET accepted as alias.
 */

const DEV_FALLBACK = 'dev-only-insecure-session-secret-min-32-chars!!';

export function getRawSessionSecret(): string {
  const raw =
    process.env.APP_SESSION_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV !== 'production' ? DEV_FALLBACK : '');

  if (process.env.NODE_ENV === 'production') {
    if (!raw || raw.length < 32) {
      throw new Error(
        'APP_SESSION_SECRET (minimaal 32 tekens) moet in productie gezet zijn voor veilige sessies.',
      );
    }
  }

  return raw || DEV_FALLBACK;
}

export function getSessionSecretKey(): Uint8Array {
  return new TextEncoder().encode(getRawSessionSecret());
}
