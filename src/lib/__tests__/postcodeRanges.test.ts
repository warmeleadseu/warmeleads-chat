/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { buildPostcodeRangeOrFilter, parsePostcodeRanges } from '../postcodeRanges';

describe('parsePostcodeRanges', () => {
  it('parses single PC4 and ranges', () => {
    expect(parsePostcodeRanges('7511')).toEqual([{ from: 7511, to: 7511 }]);
    expect(parsePostcodeRanges('7500-7599')).toEqual([{ from: 7500, to: 7599 }]);
    expect(parsePostcodeRanges('2000-2099, 8000')).toEqual([
      { from: 2000, to: 2099 },
      { from: 8000, to: 8000 },
    ]);
  });

  it('swaps inverted bounds and ignores junk', () => {
    expect(parsePostcodeRanges('7599-7500')).toEqual([{ from: 7500, to: 7599 }]);
    expect(parsePostcodeRanges('abc, 12ab')).toEqual([]);
    expect(parsePostcodeRanges('')).toEqual([]);
  });
});

describe('buildPostcodeRangeOrFilter', () => {
  it('builds half-open string bounds', () => {
    expect(buildPostcodeRangeOrFilter([{ from: 7500, to: 7599 }])).toBe(
      'and(postcode.gte.7500,postcode.lt.7600)',
    );
    expect(buildPostcodeRangeOrFilter([{ from: 7511, to: 7511 }])).toBe(
      'and(postcode.gte.7511,postcode.lt.7512)',
    );
  });

  it('joins multiple ranges with commas for or()', () => {
    expect(
      buildPostcodeRangeOrFilter([
        { from: 2000, to: 2099 },
        { from: 8000, to: 8000 },
      ]),
    ).toBe(
      'and(postcode.gte.2000,postcode.lt.2100),and(postcode.gte.8000,postcode.lt.8001)',
    );
  });
});
