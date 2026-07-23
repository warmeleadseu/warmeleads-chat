import { describe, expect, it } from 'vitest';
import {
  matchesPostcodeArea,
  parseMaxDistanceKm,
  parsePostcodeArea,
  parseProvinceList,
} from '../portalLeadGeoFilters';

describe('parsePostcodeArea', () => {
  it('parses prefix', () => {
    expect(parsePostcodeArea('75')).toEqual({ kind: 'prefix', prefix: '75' });
    expect(parsePostcodeArea('7500')).toEqual({ kind: 'prefix', prefix: '7500' });
  });

  it('parses range', () => {
    expect(parsePostcodeArea('7500-7599')).toEqual({ kind: 'range', from: 7500, to: 7599 });
  });
});

describe('matchesPostcodeArea', () => {
  it('matches prefix and range', () => {
    expect(matchesPostcodeArea('7511 JE', { kind: 'prefix', prefix: '75' })).toBe(true);
    expect(matchesPostcodeArea('7511 JE', { kind: 'range', from: 7500, to: 7599 })).toBe(true);
    expect(matchesPostcodeArea('1011 AB', { kind: 'prefix', prefix: '75' })).toBe(false);
  });
});

describe('parse helpers', () => {
  it('parses provinces and distance', () => {
    expect(parseProvinceList('Overijssel, Gelderland')).toEqual(['Overijssel', 'Gelderland']);
    expect(parseMaxDistanceKm('25')).toBe(25);
    expect(parseMaxDistanceKm('0')).toBeNull();
  });
});
