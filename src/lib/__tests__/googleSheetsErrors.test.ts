import { describe, expect, it } from 'vitest';
import { mapGoogleSheetsHttpError } from '@/lib/googleSheets/errors';

describe('mapGoogleSheetsHttpError', () => {
  it('maps permission errors to 403', () => {
    const r = mapGoogleSheetsHttpError(new Error('The caller does not have permission'));
    expect(r.status).toBe(403);
    expect(r.message).toContain('Geen toegang');
  });

  it('maps not found to 404', () => {
    const r = mapGoogleSheetsHttpError(new Error('Requested entity was not found'));
    expect(r.status).toBe(404);
  });

  it('defaults to 502', () => {
    const r = mapGoogleSheetsHttpError(new Error('Network timeout'));
    expect(r.status).toBe(502);
  });
});
