import { describe, expect, it } from 'vitest';
import { batchMatchesBranchDefault, metaIdsEqual } from '@/lib/metaCampaignDefaults';

describe('metaIdsEqual', () => {
  it('matcht lege lijsten', () => {
    expect(metaIdsEqual([], [])).toBe(true);
  });

  it('matcht volgorde-onafhankelijk', () => {
    expect(metaIdsEqual(['1', '2', '3'], ['3', '2', '1'])).toBe(true);
  });

  it('faalt bij verschillende length', () => {
    expect(metaIdsEqual(['1', '2'], ['1', '2', '3'])).toBe(false);
  });

  it('faalt bij verschillende inhoud', () => {
    expect(metaIdsEqual(['1', '2'], ['1', '3'])).toBe(false);
  });
});

describe('batchMatchesBranchDefault', () => {
  const defaults = {
    meta_campaign_ids: ['100', '200'],
    meta_campaign_paused_ids: ['200'],
    meta_campaign_sync_enabled: true,
  };

  it('matcht wanneer alle drie velden gelijk zijn', () => {
    expect(
      batchMatchesBranchDefault(
        {
          meta_campaign_ids: ['200', '100'],
          meta_campaign_paused_ids: ['200'],
          meta_campaign_sync_enabled: true,
        },
        defaults,
      ),
    ).toBe(true);
  });

  it('faalt bij verschillende campagne-IDs', () => {
    expect(
      batchMatchesBranchDefault(
        {
          meta_campaign_ids: ['100', '300'],
          meta_campaign_paused_ids: ['200'],
          meta_campaign_sync_enabled: true,
        },
        defaults,
      ),
    ).toBe(false);
  });

  it('faalt bij verschillende paused-staat', () => {
    expect(
      batchMatchesBranchDefault(
        {
          meta_campaign_ids: ['100', '200'],
          meta_campaign_paused_ids: ['100'],
          meta_campaign_sync_enabled: true,
        },
        defaults,
      ),
    ).toBe(false);
  });

  it('faalt bij verschillende sync-vlag', () => {
    expect(
      batchMatchesBranchDefault(
        {
          meta_campaign_ids: ['100', '200'],
          meta_campaign_paused_ids: ['200'],
          meta_campaign_sync_enabled: false,
        },
        defaults,
      ),
    ).toBe(false);
  });

  it('behandelt null sync-vlag op de batch als true (gelijk aan default)', () => {
    expect(
      batchMatchesBranchDefault(
        {
          meta_campaign_ids: ['100', '200'],
          meta_campaign_paused_ids: ['200'],
          meta_campaign_sync_enabled: null,
        },
        defaults,
      ),
    ).toBe(true);
  });

  it('matcht beide leeg', () => {
    expect(
      batchMatchesBranchDefault(
        { meta_campaign_ids: [], meta_campaign_paused_ids: [], meta_campaign_sync_enabled: true },
        { meta_campaign_ids: [], meta_campaign_paused_ids: [], meta_campaign_sync_enabled: true },
      ),
    ).toBe(true);
  });

  it('coerce: postgres array literal string vs array → match', () => {
    expect(
      batchMatchesBranchDefault(
        {
          meta_campaign_ids: '{100,200}',
          meta_campaign_paused_ids: '{200}',
          meta_campaign_sync_enabled: true,
        },
        defaults,
      ),
    ).toBe(true);
  });
});
