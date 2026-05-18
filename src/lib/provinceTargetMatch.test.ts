import { describe, expect, it } from 'vitest';
import {
  formatProvinceTargetLabel,
  leadMatchesAnyProvinceTarget,
  leadMatchesProvinceTarget,
  normalizeProvinceTargetTokens,
  provinceTargetToken,
} from './provinceTargetMatch';

describe('provinceTargetMatch', () => {
  const beLimburgLead = { provincie: 'Limburg', land: 'BE', postcode: '3600' };
  const nlLimburgLead = { provincie: 'Limburg', land: 'NL', postcode: '6211AB' };

  it('matches Belgian Limburg target only for BE leads', () => {
    expect(leadMatchesProvinceTarget(beLimburgLead, 'BE:Limburg')).toBe(true);
    expect(leadMatchesProvinceTarget(nlLimburgLead, 'BE:Limburg')).toBe(false);
  });

  it('matches Dutch Limburg target only for NL leads', () => {
    expect(leadMatchesProvinceTarget(nlLimburgLead, 'NL:Limburg')).toBe(true);
    expect(leadMatchesProvinceTarget(beLimburgLead, 'NL:Limburg')).toBe(false);
  });

  it('does not match bare Limburg token without land on lead', () => {
    expect(leadMatchesProvinceTarget({ provincie: 'Limburg' }, 'BE:Limburg')).toBe(false);
  });

  it('infers land from postcode when lead.land is empty', () => {
    expect(leadMatchesProvinceTarget({ provincie: 'Limburg', postcode: '3500' }, 'BE:Limburg')).toBe(true);
    expect(leadMatchesProvinceTarget({ provincie: 'Limburg', postcode: '6211AB' }, 'NL:Limburg')).toBe(true);
  });

  it('supports legacy Limburg (BE) label', () => {
    expect(leadMatchesProvinceTarget(beLimburgLead, 'Limburg (BE)')).toBe(true);
    expect(leadMatchesProvinceTarget(nlLimburgLead, 'Limburg (BE)')).toBe(false);
  });

  it('matches unique provinces on name + inferred land', () => {
    expect(leadMatchesProvinceTarget({ provincie: 'Antwerpen', land: 'BE' }, 'Antwerpen')).toBe(true);
    expect(leadMatchesProvinceTarget({ provincie: 'Antwerpen', land: 'NL' }, 'Antwerpen')).toBe(false);
    expect(leadMatchesProvinceTarget({ provincie: 'Groningen', land: 'NL' }, 'Groningen')).toBe(true);
  });

  it('normalizes tokens to prefixed form', () => {
    expect(normalizeProvinceTargetTokens(['Limburg (BE)', 'Antwerpen'], 'NL')).toEqual([
      'BE:Limburg',
      'BE:Antwerpen',
    ]);
    expect(normalizeProvinceTargetTokens(['Limburg'], 'BE')).toEqual(['BE:Limburg']);
  });

  it('formats display labels for Limburg', () => {
    expect(formatProvinceTargetLabel('BE:Limburg')).toBe('Limburg (BE)');
    expect(formatProvinceTargetLabel('NL:Limburg')).toBe('Limburg (NL)');
    expect(formatProvinceTargetLabel('BE:Antwerpen')).toBe('Antwerpen');
  });

  it('leadMatchesAnyProvinceTarget aggregates tokens', () => {
    const tokens = [provinceTargetToken('BE', 'Limburg'), provinceTargetToken('NL', 'Noord-Brabant')];
    expect(leadMatchesAnyProvinceTarget(beLimburgLead, tokens)).toBe(true);
    expect(leadMatchesAnyProvinceTarget(nlLimburgLead, tokens)).toBe(false);
    expect(
      leadMatchesAnyProvinceTarget({ provincie: 'Noord-Brabant', land: 'NL' }, tokens),
    ).toBe(true);
  });
});
