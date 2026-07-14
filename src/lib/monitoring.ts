/**
 * Gestructureerde server-side logging + optionele error-reporting.
 *
 * - `logInfo` / `logWarn` / `logError` schrijven één JSON-regel zodat logs in
 *   Vercel/observability-tools doorzoekbaar zijn (op `route`, `lead_id`, etc.).
 * - `captureServerException` stuurt de fout door naar Sentry als
 *   `SENTRY_DSN` is gezet én `@sentry/node` beschikbaar is. De import gebruikt
 *   bewust een variabele-specifier zodat de build niet faalt als het pakket
 *   (nog) niet is geïnstalleerd; het blijft dus volledig optioneel.
 */

type LogLevel = 'info' | 'warn' | 'error';

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(context ? { context } : {}),
  };
  const line = safeStringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      return val;
    });
  } catch {
    return String(value);
  }
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  emit('info', message, context);
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
  emit('warn', message, context);
}

export function logError(message: string, context?: Record<string, unknown>): void {
  emit('error', message, context);
}

let serverSentryInit: boolean | null = null;

/**
 * Rapporteer een server-side fout. Logt altijd gestructureerd en stuurt
 * optioneel door naar Sentry. Gebruik dit i.p.v. het stil wegslikken van
 * fouten in webhooks, crons en betaal-/factuurpaden.
 */
export function captureServerException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  emit('error', context?.message ? String(context.message) : 'server_exception', {
    ...context,
    error,
  });

  if (typeof window !== 'undefined') return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  void (async () => {
    try {
      const moduleName = '@sentry/node';
      const Sentry = (await import(/* webpackIgnore: true */ moduleName as string).catch(
        () => null,
      )) as { init?: (o: unknown) => void; captureException?: (e: unknown, o?: unknown) => void } | null;
      if (!Sentry?.captureException) return;
      if (!serverSentryInit) {
        Sentry.init?.({ dsn, tracesSampleRate: 0.05 });
        serverSentryInit = true;
      }
      Sentry.captureException(error, { extra: context });
    } catch {
      /* dependency optioneel of netwerk */
    }
  })();
}

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
