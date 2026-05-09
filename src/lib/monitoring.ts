/**
 * Optionele client-side error reporting (zet NEXT_PUBLIC_SENTRY_DSN in productie).
 */
export function captureClientException(error: unknown, context?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'production') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  void (async () => {
    try {
      const Sentry = await import('@sentry/browser');
      if (!(globalThis as unknown as { __wl_sentry_init?: boolean }).__wl_sentry_init) {
        Sentry.init({ dsn, tracesSampleRate: 0.05 });
        (globalThis as unknown as { __wl_sentry_init?: boolean }).__wl_sentry_init = true;
      }
      Sentry.captureException(error, { extra: context });
    } catch {
      /* dependency optioneel of netwerk */
    }
  })();
}
