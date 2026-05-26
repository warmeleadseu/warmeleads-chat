import { describe, it, expect } from 'vitest';
import { coerceCustomerBatchMetaCampaignIds, mergeMetaCampaignLookupNames } from '../metaCampaignIds';

describe('coerceCustomerBatchMetaCampaignIds', () => {
  it('parses numeric string array', () => {
    expect(coerceCustomerBatchMetaCampaignIds(['12', ' 34 ', 'x', '56'])).toEqual(['12', '34', '56']);
  });

  it('parses Postgres array literal', () => {
    expect(coerceCustomerBatchMetaCampaignIds('{111,222}')).toEqual(['111', '222']);
  });

  it('parses JSON array string', () => {
    expect(coerceCustomerBatchMetaCampaignIds('["111","222"]')).toEqual(['111', '222']);
  });

  it('dedupes preserving order', () => {
    expect(coerceCustomerBatchMetaCampaignIds(['1', '2', '1'])).toEqual(['1', '2']);
  });
});

describe('mergeMetaCampaignLookupNames', () => {
  it('fills names and preserves order', () => {
    const out = mergeMetaCampaignLookupNames(
      ['2', '1'],
      [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
      ],
    );
    expect(out).toEqual([
      { id: '2', name: 'B' },
      { id: '1', name: 'A' },
    ]);
  });

  it('preserves paused flag after name lookup', () => {
    const out = mergeMetaCampaignLookupNames(
      ['1'],
      [{ id: '1', name: 'Kopie' }],
      [{ id: '1', name: '1', paused: true }],
    );
    expect(out).toEqual([{ id: '1', name: 'Kopie', paused: true }]);
  });
});
