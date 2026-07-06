/**
 * Application secret voor admin- en portal-sessie-JWTs en impersonatie-tokens.
 *
 * Voorkeurvolgorde:
 *   1. APP_SESSION_SECRET (≥32 tekens, aanbevolen in productie)
 *   2. ADMIN_SESSION_SECRET (legacy alias)
 *
 * Bewust LOSGEKOPPELD van CRON_SECRET: sessie-ondertekening en cron-authenticatie
 * gebruiken niet langer hetzelfde secret. Een gelekt CRON_SECRET mag geen
 * geldige gebruikerssessies kunnen vervalsen (en omgekeerd). In productie
 * throwen we als er geen dedicated sessie-secret is gezet.
 */

const DEV_FALLBACK = 'dev-only-insecure-session-secret-min-32-chars!!';

let warnedShortSecret = false;

function getCandidate(): string | null {
  const app = process.env.APP_SESSION_SECRET?.trim();
  if (app) return app;
  const admin = process.env.ADMIN_SESSION_SECRET?.trim();
  if (admin) return admin;
  return null;
}

export function getRawSessionSecret(): string {
  const candidate = getCandidate();

  if (candidate) {
    if (
      process.env.NODE_ENV === 'production' &&
      candidate.length < 32 &&
      !warnedShortSecret
    ) {
      console.warn(
        '[sessionSecrets] Sessie-secret is korter dan 32 tekens. ' +
          'Zet een langere APP_SESSION_SECRET voor sterke HMAC-sleutels.',
      );
      warnedShortSecret = true;
    }
    return candidate;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_FALLBACK;
  }

  throw new Error(
    'Geen sessie-secret gevonden in productie. Zet APP_SESSION_SECRET (min. 32 tekens). ' +
      'CRON_SECRET wordt bewust niet meer gebruikt voor sessie-ondertekening.',
  );
}

export function getSessionSecretKey(): Uint8Array {
  return new TextEncoder().encode(getRawSessionSecret());
}
