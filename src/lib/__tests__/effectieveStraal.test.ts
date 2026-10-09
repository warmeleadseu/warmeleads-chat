import { describe, expect, it } from 'vitest';
import { effectieveStraal, leesMarge, STANDAARD_STRAAL_MARGE_KM } from '../provincieDoelMarge';
import { matchLeadToTargets } from '../matchLeadToTargets';

/* Middelpunt van het gebied van Energiekompas (Enschede). */
const ENSCHEDE = { target_type: 'radius', lat: 52.22080698, lng: 6.8777881, radius_km: 50, is_active: true, provinces: [], country: null };
/* Op ongeveer 52 km van dat middelpunt, recht naar het noorden. */
const lead52km = { lat: 52.22080698 + 52 / 111.2, lng: 6.8777881, provincie: 'Overijssel', land: 'NL' };

describe('effectieveStraal', () => {
  it('straal plus marge', () => {
    expect(effectieveStraal({ radius_km: 50, marge_km: 3 })).toBe(53);
  });
  it('zonder marge: alleen de straal', () => {
    expect(effectieveStraal({ radius_km: 50 })).toBe(50);
    expect(effectieveStraal({ radius_km: 50, marge_km: null })).toBe(50);
  });
  it('negatieve marge telt niet', () => {
    expect(effectieveStraal({ radius_km: 50, marge_km: -5 })).toBe(50);
  });
  it('standaardmarge is 3 km', () => {
    expect(STANDAARD_STRAAL_MARGE_KM).toBe(3);
  });
});

describe('leesMarge', () => {
  it('accepteert 0 t/m 100, rondt af', () => {
    expect(leesMarge(3)).toBe(3);
    expect(leesMarge('2.6')).toBe(3);
    expect(leesMarge(0)).toBe(0);
  });
  it('weigert onzin', () => {
    expect(leesMarge(-1)).toBeNull();
    expect(leesMarge(101)).toBeNull();
    expect(leesMarge('abc')).toBeNull();
    expect(leesMarge('')).toBeNull();
  });
});

describe('matchLeadToTargets rekent met de marge', () => {
  it('52 km valt buiten 50 km zonder marge', () => {
    expect(matchLeadToTargets(lead52km as never, [ENSCHEDE as never]).matches).toBe(false);
  });
  it('52 km valt binnen 50 km + 3 km marge', () => {
    expect(matchLeadToTargets(lead52km as never, [{ ...ENSCHEDE, marge_km: 3 } as never]).matches).toBe(true);
  });
  it('52 km valt buiten 45 km + 3 km marge', () => {
    expect(matchLeadToTargets(lead52km as never, [{ ...ENSCHEDE, radius_km: 45, marge_km: 3 } as never]).matches).toBe(false);
  });
});
