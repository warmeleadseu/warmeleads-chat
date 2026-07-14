import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import type { NextResponse } from 'next/server';
import { apiError } from './response';

type ParseResult<T> = { data: T; error: null } | { data: null; error: NextResponse };

/**
 * Parse + valideer de JSON-body van een request met een Zod-schema.
 * Bij fouten wordt een klaar-voor-gebruik foutrespons teruggegeven.
 *
 *   const { data, error } = await parseBody(request, MySchema);
 *   if (error) return error;
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { data: null, error: apiError('bad_request', 'Ongeldige JSON') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      data: null,
      error: apiError('validation_error', 'Validatie mislukt', {
        issues: parsed.error.issues,
      }),
    };
  }
  return { data: parsed.data, error: null };
}

/**
 * Parse + valideer de query-string (searchParams) met een Zod-schema.
 * Herhaalde keys worden als array aangeboden aan het schema.
 */
export function parseQuery<T>(
  request: NextRequest,
  schema: ZodType<T>,
): ParseResult<T> {
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const all = request.nextUrl.searchParams.getAll(key);
    obj[key] = all.length > 1 ? all : all[0];
  }
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return {
      data: null,
      error: apiError('validation_error', 'Ongeldige queryparameters', {
        issues: parsed.error.issues,
      }),
    };
  }
  return { data: parsed.data, error: null };
}
