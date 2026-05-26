import { googleSheetsAccessDeniedMessage } from './access';

/** Map Google API / netwerk-fouten naar NL gebruikersmelding + HTTP-status. */
export function mapGoogleSheetsHttpError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : 'Onbekende fout';
  const lower = raw.toLowerCase();

  if (
    lower.includes('permission') ||
    lower.includes('403') ||
    lower.includes('caller does not have') ||
    lower.includes('forbidden')
  ) {
    return { message: googleSheetsAccessDeniedMessage(), status: 403 };
  }

  if (lower.includes('not found') || lower.includes('404')) {
    return { message: 'Spreadsheet niet gevonden. Controleer de URL.', status: 404 };
  }

  if (lower.includes('service account') && lower.includes('niet geconfigureerd')) {
    return { message: raw, status: 503 };
  }

  return { message: raw, status: 502 };
}
