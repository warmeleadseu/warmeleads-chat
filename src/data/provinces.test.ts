import { describe, expect, it } from 'vitest';
import { PROVINCE_OPTIONS_BE, PROVINCE_OPTIONS_NL, PROVINCES_BE, PROVINCES_NL } from './provinces';

describe('provinces', () => {
  it('lists Limburg separately per country in target options', () => {
    const nlLimburg = PROVINCE_OPTIONS_NL.find(o => o.name === 'Limburg');
    const beLimburg = PROVINCE_OPTIONS_BE.find(o => o.name === 'Limburg');
    expect(nlLimburg?.value).toBe('NL:Limburg');
    expect(beLimburg?.value).toBe('BE:Limburg');
    expect(nlLimburg?.label).toBe('Limburg (NL)');
    expect(beLimburg?.label).toBe('Limburg (BE)');
  });

  it('keeps canonical province names for lead enrichment', () => {
    expect(PROVINCES_BE).toContain('Limburg');
    expect(PROVINCES_NL).toContain('Limburg');
  });

  it('lists all 11 Belgian provinces used in CRM', () => {
    expect(PROVINCES_BE).toHaveLength(11);
  });
});
