import { NextResponse } from 'next/server';

/**
 * Uniforme API-respons-envelope. Nieuwe/gemigreerde routes gebruiken deze
 * helpers zodat clients altijd dezelfde vorm krijgen:
 *   succes  -> { ok: true, data }
 *   fout    -> { ok: false, error: { code, message, ...extra } }
 *
 * Voor backward-compat bevat een foutrespons ook een top-level `error`-string,
 * zodat bestaande clients die `body.error` lezen blijven werken tijdens de
 * gefaseerde migratie.
 */

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation_error'
  | 'rate_limited'
  | 'internal_error';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_error: 422,
  rate_limited: 429,
  internal_error: 500,
};

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  bad_request: 'Ongeldig verzoek',
  unauthorized: 'Niet geautoriseerd',
  forbidden: 'Onvoldoende rechten',
  not_found: 'Niet gevonden',
  conflict: 'Conflict',
  validation_error: 'Validatie mislukt',
  rate_limited: 'Te veel verzoeken',
  internal_error: 'Er ging iets mis',
};

export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(
  code: ApiErrorCode,
  message?: string,
  extra?: Record<string, unknown>,
): NextResponse {
  const msg = message ?? DEFAULT_MESSAGE[code];
  return NextResponse.json(
    { ok: false, error: { code, message: msg, ...(extra ?? {}) }, /* compat */ error_message: msg },
    { status: STATUS_BY_CODE[code] },
  );
}
