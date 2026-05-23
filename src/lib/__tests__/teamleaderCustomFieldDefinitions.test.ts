import { describe, expect, it } from 'vitest';
import {
  isMappableTeamleaderFieldType,
  normalizeTeamleaderFieldType,
  unwrapTeamleaderList,
} from '@/lib/teamleader/customFieldDefinitions';

describe('normalizeTeamleaderFieldType', () => {
  it('lowercases and normalizes separators', () => {
    expect(normalizeTeamleaderFieldType('Single_Line')).toBe('single_line');
    expect(normalizeTeamleaderFieldType('EMAIL')).toBe('email');
  });
});

describe('isMappableTeamleaderFieldType', () => {
  it('accepts known mappable types regardless of casing', () => {
    expect(isMappableTeamleaderFieldType('single_line')).toBe(true);
    expect(isMappableTeamleaderFieldType('Single_Select')).toBe(true);
  });

  it('rejects reference and auto fields', () => {
    expect(isMappableTeamleaderFieldType('contact')).toBe(false);
    expect(isMappableTeamleaderFieldType('auto_increment')).toBe(false);
  });
});

describe('unwrapTeamleaderList', () => {
  it('returns arrays as-is', () => {
    expect(unwrapTeamleaderList([{ id: '1' }])).toEqual([{ id: '1' }]);
  });

  it('unwraps nested data arrays', () => {
    expect(unwrapTeamleaderList({ data: [{ id: '2' }] })).toEqual([{ id: '2' }]);
  });

  it('returns empty array for unexpected shapes', () => {
    expect(unwrapTeamleaderList(null)).toEqual([]);
    expect(unwrapTeamleaderList({ meta: {} })).toEqual([]);
  });
});
