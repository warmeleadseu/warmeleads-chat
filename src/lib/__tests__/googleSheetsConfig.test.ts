import { describe, expect, it, afterEach } from 'vitest';
import {
  appendGoogleSheetsApiKey,
  getGoogleSheetsApiKey,
} from '@/lib/googleSheets/config';

describe('googleSheets config', () => {
  const prev = process.env.GOOGLE_SHEETS_API_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.GOOGLE_SHEETS_API_KEY;
    else process.env.GOOGLE_SHEETS_API_KEY = prev;
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
});
