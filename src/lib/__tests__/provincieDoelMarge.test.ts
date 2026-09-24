import { describe, it, expect } from 'vitest';
import { binnenProvincieMarge, grenssleutelsVoorTokens, margeVan } from '../provincieDoelMarge';
import { matchLeadToTargets } from '../matchLeadToTargets';

/**
 * Een provinciedoel was alles of niets. Een lead in Sleeuwijk die 1 km over de
 * grens van Zuid-Holland ligt viel eruit, terwijl de adviseur er langs rijdt.
 */

const UTRECHT_ZH = ['NL:Utrecht', 'NL:Zuid-Holland'];
const SLEEUWIJK = { lat: 51.8194, lng: 4.9569 };      // ~1 km buiten Zuid-Holland
const GRONINGEN = { lat: 53.2194, lng: 6.5665 };      // heel ver weg

describe('grenssleutelsVoorTokens', () => {
  it('vertaalt NL:Utrecht naar de sleutel van het grensbestand', () => {
    /* De tokens staan als NL:Utrecht in customer_targets, terwijl het
       grensbestand op de kale naam wordt bevraagd. Die vertaling verkeerd doen
       levert geen fout op maar stilzwijgend nul resultaten. */
    const s = grenssleutelsVoorTokens(['NL:Utrecht']);
    expect(s).toContain('NL:Utrecht');
    expect(s.length).toBeGreaterThan(0);
  });

  it('gaat om met onzin en lege invoer', () => {
    expect(grenssleutelsVoorTokens([])).toEqual([]);
    expect(grenssleutelsVoorTokens(['NL:Verzonnen'])).toEqual([]);
  });
});

describe('binnenProvincieMarge', () => {
  it('accepteert een lead net buiten de provincie', () => {
    expect(binnenProvincieMarge(SLEEUWIJK, UTRECHT_ZH, 15)).toBe(true);
  });

  it('weigert diezelfde lead zonder marge', () => {
    expect(binnenProvincieMarge(SLEEUWIJK, UTRECHT_ZH, 0)).toBe(false);
  });

  it('weigert een lead ver buiten het gebied', () => {
    expect(binnenProvincieMarge(GRONINGEN, UTRECHT_ZH, 15)).toBe(false);
  });

  it('kan niets zeggen zonder coordinaten', () => {
    expect(binnenProvincieMarge({ lat: null, lng: null }, UTRECHT_ZH, 15)).toBe(false);
  });

  it('weigert bij lege of onbekende provincies', () => {
    expect(binnenProvincieMarge(SLEEUWIJK, [], 15)).toBe(false);
    expect(binnenProvincieMarge(SLEEUWIJK, ['NL:Verzonnen'], 15)).toBe(false);
  });
});

describe('margeVan', () => {
  it('leest een geldige marge en negeert onzin', () => {
    expect(margeVan({ marge_km: 15 })).toBe(15);
    expect(margeVan({ marge_km: 0 })).toBe(0);
    expect(margeVan({ marge_km: null })).toBe(0);
    expect(margeVan({ marge_km: -5 })).toBe(0);
    expect(margeVan({})).toBe(0);
  });

  it('kapt af op honderd', () => {
    expect(margeVan({ marge_km: 5000 })).toBe(100);
  });
});

describe('matchLeadToTargets met een provinciemarge', () => {
  const doel = (marge: number) => ([{
    target_type: 'province', provinces: UTRECHT_ZH, country: 'NL',
    lat: null, lng: null, radius_km: null, marge_km: marge,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }] as any);

  const lead = { ...SLEEUWIJK, provincie: 'Noord-Brabant', land: 'NL', postcode: '4254 AA' };

  it('laat een lead net buiten de provincie toe met marge', () => {
    expect(matchLeadToTargets(lead, doel(15)).matches).toBe(true);
  });

  it('weigert diezelfde lead zonder marge', () => {
    expect(matchLeadToTargets(lead, doel(0)).matches).toBe(false);
  });

  it('laat een lead binnen de provincie altijd toe', () => {
    const binnen = { lat: 52.09, lng: 5.12, provincie: 'Utrecht', land: 'NL', postcode: '3511 AA' };
    expect(matchLeadToTargets(binnen, doel(0)).matches).toBe(true);
    expect(matchLeadToTargets(binnen, doel(0)).distance_km).toBe(0);
  });

  it('weigert een lead ver buiten het gebied ook met marge', () => {
    const ver = { ...GRONINGEN, provincie: 'Groningen', land: 'NL', postcode: '9711 AA' };
    expect(matchLeadToTargets(ver, doel(15)).matches).toBe(false);
  });
});
