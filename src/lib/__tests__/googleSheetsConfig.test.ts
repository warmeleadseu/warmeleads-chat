import { describe, expect, it, afterEach } from 'vitest';
import {
  appendGoogleSheetsApiKey,
  getGoogleSheetsApiKey,
  isGoogleSheetsIntegrationServerReady,
} from '@/lib/googleSheets/config';

describe('googleSheets config', () => {
  const prevKey = process.env.GOOGLE_SHEETS_API_KEY;
  const prevSa = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.GOOGLE_SHEETS_API_KEY;
    else process.env.GOOGLE_SHEETS_API_KEY = prevKey;
    if (prevSa === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    else process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = prevSa;
  });

  it('strips newlines from API key', () => {
    process.env.GOOGLE_SHEETS_API_KEY = 'abc123\n';
    expect(getGoogleSheetsApiKey()).toBe('abc123');
  });

  it('appends key query param when configured', () => {
    process.env.GOOGLE_SHEETS_API_KEY = 'test-key';
    expect(appendGoogleSheetsApiKey('/spreadsheets/x')).toBe(
      '/spreadsheets/x?key=test-key',
    );
    expect(appendGoogleSheetsApiKey('/spreadsheets/x?fields=a')).toBe(
      '/spreadsheets/x?fields=a&key=test-key',
    );
  });

  it('leaves path unchanged without key', () => {
    delete process.env.GOOGLE_SHEETS_API_KEY;
    expect(appendGoogleSheetsApiKey('/spreadsheets/x')).toBe('/spreadsheets/x');
  });

  it('server ready requires API key and service account private key', () => {
    delete process.env.GOOGLE_SHEETS_API_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    expect(isGoogleSheetsIntegrationServerReady()).toBe(false);

    process.env.GOOGLE_SHEETS_API_KEY = 'k';
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'pem';
    expect(isGoogleSheetsIntegrationServerReady()).toBe(true);
  });
});
