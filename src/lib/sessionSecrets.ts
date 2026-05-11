/**
 * Application secret voor admin- en portal-sessie-JWTs en impersonatie-tokens.
 *
 * Voorkeurvolgorde:
 *   1. APP_SESSION_SECRET (≥32 tekens, aanbevolen in productie)
 *   2. ADMIN_SESSION_SECRET (legacy alias)
 *   3. CRON_SECRET (sterke fallback; al gebruikt door cron-jobs)
 *
 * In productie loggen we 1x een waarschuwing als er geen sterke
 * APP_SESSION_SECRET is gevonden of als het secret korter dan 32 tekens is,
 * maar we throwen pas wanneer er helemaal geen secret beschikbaar is.
 */

const DEV_FALLBACK = 'dev-only-insecure-session-secret-min-32-chars!!';

let warnedShortSecret = false;
let warnedFallbackSecret = false;

function getCandidate(): string | null {
  const app = process.env.APP_SESSION_SECRET?.trim();
  if (app) return app;
  const admin = process.env.ADMIN_SESSION_SECRET?.trim();
  if (admin) return admin;
  const cron = process.env.CRON_SECRET?.trim();
  if (cron) {
    if (process.env.NODE_ENV === 'production' && !warnedFallbackSecret) {
      console.warn(
        '[sessionSecrets] APP_SESSION_SECRET niet gezet; valt terug op CRON_SECRET. ' +
          'Zet APP_SESSION_SECRET (min. 32 tekens) voor toekomstvaste sessies.',
      );
      warnedFallbackSecret = true;
    }
    return cron;
  }
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
    'Geen sessie-secret gevonden in productie. Zet APP_SESSION_SECRET (min. 32 tekens) of CRON_SECRET.',
  );
}

export function getSessionSecretKey(): Uint8Array {
  return new TextEncoder().encode(getRawSessionSecret());
}
