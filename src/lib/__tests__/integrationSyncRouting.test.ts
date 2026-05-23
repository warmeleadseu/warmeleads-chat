import { describe, expect, it } from 'vitest';
import {
  isGoogleSheetsSyncReady,
  isTeamleaderSyncReady,
  resolveIntegrationSyncTargetsFromState,
} from '@/lib/integrations/syncRouting';
import { resolveEffectiveCrmProvider } from '@/lib/integrations/crmPreferences';
import { branchMappingIsEmpty, hasSavedFieldMappings } from '@/lib/teamleader/fieldMappingLogic';
import { FIELD_MAP_SUMMARY } from '@/lib/teamleader/standardFields';

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

describe('resolveEffectiveCrmProvider', () => {
  it('prefers stored value', () => {
    expect(resolveEffectiveCrmProvider('google_sheets', true, true)).toBe('google_sheets');
  });

  it('defaults to teamleader when both connected without stored preference', () => {
    expect(resolveEffectiveCrmProvider(null, true, true)).toBe('teamleader');
  });

  it('returns null when nothing connected', () => {
    expect(resolveEffectiveCrmProvider(null, false, false)).toBeNull();
  });
});

describe('resolveIntegrationSyncTargetsFromState', () => {
  it('syncs teamleader when inferred preference and ready', () => {
    expect(
      resolveIntegrationSyncTargetsFromState({
        preferredStored: null,
        teamleaderConnected: true,
        sheetsConnected: true,
        tlReady: true,
        gsReady: true,
      }),
    ).toEqual({ teamleader: true, google_sheets: false });
  });

  it('respects explicit google_sheets preference', () => {
    expect(
      resolveIntegrationSyncTargetsFromState({
        preferredStored: 'google_sheets',
        teamleaderConnected: true,
        sheetsConnected: true,
        tlReady: true,
        gsReady: true,
      }),
    ).toEqual({ teamleader: false, google_sheets: true });
  });

  it('falls back to single ready integration without preference', () => {
    expect(
      resolveIntegrationSyncTargetsFromState({
        preferredStored: null,
        teamleaderConnected: false,
        sheetsConnected: true,
        tlReady: false,
        gsReady: true,
      }),
    ).toEqual({ teamleader: false, google_sheets: true });
  });

  it('syncs neither when both ready but neither connected for inference', () => {
    expect(
      resolveIntegrationSyncTargetsFromState({
        preferredStored: null,
        teamleaderConnected: false,
        sheetsConnected: false,
        tlReady: true,
        gsReady: true,
      }),
    ).toEqual({ teamleader: false, google_sheets: false });
  });
});

describe('Teamleader sentinel field mappings', () => {
  it('treats _summary-only mappings as saved', () => {
    const mapping = {
      contact: {},
      deal: { budget: FIELD_MAP_SUMMARY },
    };
    expect(branchMappingIsEmpty(mapping)).toBe(false);
    expect(
      hasSavedFieldMappings({ thuisbatterij: mapping }, ['thuisbatterij']),
    ).toBe(true);
  });
});
