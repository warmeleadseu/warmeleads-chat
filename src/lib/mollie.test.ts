import { describe, expect, it } from 'vitest';
import { mollieLocaleForCountry } from './mollie';

describe('mollieLocaleForCountry', () => {
  it('Belgische klanten krijgen nl_BE (Bancontact prominent)', () => {
    expect(mollieLocaleForCountry('BE')).toBe('nl_BE');
    expect(mollieLocaleForCountry('be')).toBe('nl_BE');
    expect(mollieLocaleForCountry(' Be ')).toBe('nl_BE');
  });
  it('Nederlandse klanten krijgen nl_NL (iDEAL prominent)', () => {
    expect(mollieLocaleForCountry('NL')).toBe('nl_NL');
    expect(mollieLocaleForCountry('nl')).toBe('nl_NL');
  });
  it('null / leeg / onbekend → fallback nl_NL', () => {
    expect(mollieLocaleForCountry(null)).toBe('nl_NL');
    expect(mollieLocaleForCountry(undefined)).toBe('nl_NL');
    expect(mollieLocaleForCountry('')).toBe('nl_NL');
    expect(mollieLocaleForCountry('FR')).toBe('nl_NL');
  });
});
