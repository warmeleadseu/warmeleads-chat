import { describe, expect, it } from 'vitest';
import {
  isGoogleSheetsSyncReady,
  isTeamleaderSyncReady,
} from '@/lib/integrations/syncRouting';

describe('isTeamleaderSyncReady', () => {
  it('requires connection, pipeline and enabled', () => {
    expect(
      isTeamleaderSyncReady({
        connected_at: '2025-01-01',
        settings: { pipeline_id: 'p1', enabled: true },
      } as never),
    ).toBe(true);
    expect(
      isTeamleaderSyncReady({
        connected_at: '2025-01-01',
        settings: { pipeline_id: null, enabled: true },
      } as never),
    ).toBe(false);
    expect(
      isTeamleaderSyncReady({
        connected_at: null,
        settings: { pipeline_id: 'p1', enabled: true },
      } as never),
    ).toBe(false);
  });
});

describe('isGoogleSheetsSyncReady', () => {
  it('requires spreadsheet, mappings and enabled', () => {
    expect(
      isGoogleSheetsSyncReady(
        {
          connected_at: '2025-01-01',
          settings: {
            spreadsheet_id: 'abc',
            sheet_name: 'Blad1',
            enabled: true,
            field_mappings: { thuisbatterij: { email: '0' } },
          },
        } as never,
        ['thuisbatterij'],
      ),
    ).toBe(true);
    expect(
      isGoogleSheetsSyncReady(
        {
          connected_at: '2025-01-01',
          settings: {
            spreadsheet_id: 'abc',
            sheet_name: 'Blad1',
            enabled: true,
            field_mappings: {},
          },
        } as never,
        ['thuisbatterij'],
      ),
    ).toBe(false);
  });
});
