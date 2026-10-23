import { describe, expect, it } from 'vitest';
import { beoordeelGebied, gebiedTekst } from '../reclamatieGebied';

/* Utrecht als middelpunt; Amersfoort ligt ~20 km, Zwolle ~80 km verderop. */
const UTRECHT = { lat: 52.0907, lng: 5.1214 };
const straal = (radius: number, extra: Record<string, unknown> = {}) => ({ target_type: 'radius', label: 'Utrecht', ...UTRECHT, radius_km: radius, country: 'NL', ...extra });
const AMERSFOORT = { lat: 52.1561, lng: 5.3878, provincie: 'Utrecht', land: 'NL' };
const ZWOLLE = { lat: 52.5168, lng: 6.083, provincie: 'Overijssel', land: 'NL' };

describe('beoordeelGebied', () => {
  it('binnen de straal: binnen, met de afstand tot het middelpunt', () => {
    const o = beoordeelGebied(AMERSFOORT, [straal(30)]);
    expect(o.status).toBe('binnen');
    if (o.status === 'binnen') expect(o.afstandMiddenKm).toBeGreaterThan(18);
  });

  it('buiten de straal: hoeveel km buiten de afgesproken straal', () => {
    const o = beoordeelGebied(AMERSFOORT, [straal(10)]);
    expect(o.status).toBe('buiten');
    if (o.status === 'buiten') {
      expect(o.kmBuiten).toBeGreaterThan(8);
      expect(o.kmBuiten).toBeLessThan(11);
      expect(o.straalKm).toBe(10);
      expect(o.binnenMarge).toBe(false);
    }
    expect(gebiedTekst(o)).toMatch(/km buiten het gebied \(straal 10 km rond Utrecht\)/);
  });

  it('buiten de straal maar binnen onze marge: dat staat erbij', () => {
    const o = beoordeelGebied(AMERSFOORT, [straal(10, { marge_km: 15 })]);
    expect(o.status).toBe('buiten');
    if (o.status === 'buiten') expect(o.binnenMarge).toBe(true);
    expect(gebiedTekst(o)).toMatch(/binnen onze marge/);
  });

  it('meerdere gebieden: het dichtstbijzijnde telt', () => {
    const o = beoordeelGebied(ZWOLLE, [straal(10), { target_type: 'radius', label: 'Deventer', lat: 52.2551, lng: 6.1639, radius_km: 20, country: 'NL' }]);
    expect(o.status).toBe('buiten');
    if (o.status === 'buiten') { expect(o.doel).toBe('Deventer'); expect(o.kmBuiten).toBeLessThan(10); }
  });

  it('provinciegebied: binnen of buiten de afgesproken provincie', () => {
    const prov = { target_type: 'province', provinces: ['NL:Utrecht'], country: 'NL' };
    expect(beoordeelGebied(AMERSFOORT, [prov]).status).toBe('binnen');
    const o = beoordeelGebied(ZWOLLE, [prov]);
    expect(o.status).toBe('buiten_provincie');
    expect(gebiedTekst(o)).toBe('Buiten de afgesproken provincie (Utrecht)');
  });

  it('zonder locatie of zonder gebied: onbekend', () => {
    expect(beoordeelGebied({ provincie: null }, [straal(10)]).status).toBe('onbekend');
    expect(gebiedTekst(beoordeelGebied(AMERSFOORT, []))).toBe('Afstand onbekend: geen gebied ingesteld');
  });

  it('komma als decimaalteken in de tekst', () => {
    expect(gebiedTekst({ status: 'buiten', kmBuiten: 12.4, doel: null, straalKm: 30, binnenMarge: false })).toBe('12,4 km buiten het gebied (straal 30 km)');
  });
});
