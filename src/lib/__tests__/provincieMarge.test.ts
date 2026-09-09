import { describe, it, expect } from 'vitest';
import {
  afstandTotProvincieGrensKm,
  grensSleutelsVoor,
  grensSleutelsVoorSelectie,
  leadBinnenProvincieMarge,
  parseProvincieMargeKm,
} from '../provincieMarge';

/**
 * De afstanden zijn getoetst aan bekende plaatsen. De contouren zijn
 * vereenvoudigd tot ongeveer een paar honderd meter nauwkeurig, dus de marges
 * in deze tests zijn ruim genomen: ze bewaken de orde van grootte en de
 * werking, niet de laatste honderd meter.
 */

describe('grensSleutelsVoor', () => {
  it('vindt een Nederlandse provincie', () => {
    expect(grensSleutelsVoor('Overijssel')).toEqual(['NL:Overijssel']);
  });

  it('vindt een Belgische provincie', () => {
    expect(grensSleutelsVoor('Oost-Vlaanderen')).toEqual(['BE:Oost-Vlaanderen']);
  });

  it('geeft bij Limburg beide landen, net als het bestaande filter', () => {
    expect(grensSleutelsVoor('Limburg')).toEqual(['NL:Limburg', 'BE:Limburg']);
  });

  it('geeft niets bij een onbekende naam', () => {
    expect(grensSleutelsVoor('Texas')).toEqual([]);
    expect(grensSleutelsVoor('  ')).toEqual([]);
  });

  it('ontdubbelt over een selectie', () => {
    expect(grensSleutelsVoorSelectie(['Utrecht', 'Utrecht', 'Zeeland'])).toEqual([
      'NL:Utrecht', 'NL:Zeeland',
    ]);
  });
});

describe('afstandTotProvincieGrensKm', () => {
  it('geeft vrijwel nul voor een punt op de grens zelf', () => {
    // Hattem ligt in Gelderland, pal tegen de Overijsselse grens.
    const d = afstandTotProvincieGrensKm(52.4753, 6.0664, ['NL:Overijssel']);
    expect(d).not.toBeNull();
    expect(d!).toBeLessThan(3);
  });

  it('geeft een grote afstand voor een punt ver weg', () => {
    // Maastricht ten opzichte van Groningen.
    const d = afstandTotProvincieGrensKm(50.8514, 5.6910, ['NL:Groningen']);
    expect(d!).toBeGreaterThan(200);
  });

  it('springt niet over het IJsselmeer', () => {
    /* Lelystad ligt hemelsbreed 22 km van Noord-Holland, maar dwars over het
       IJsselmeer. Die kust telt niet mee, dus de gemeten afstand wordt groter
       en valt buiten elke redelijke marge. */
    const d = afstandTotProvincieGrensKm(52.5185, 5.4714, ['NL:Noord-Holland']);
    expect(d!).toBeGreaterThan(25);
  });

  it('springt niet over het IJsselmeer naar Friesland', () => {
    /* Enkhuizen ligt hemelsbreed zo'n 25 km van Friesland, dwars over het
       IJsselmeer. De IJsselmeerkust van Friesland telt niet mee, dus wat
       overblijft is de landverbinding bij Lemmer, ruim buiten elke marge. */
    const enkhuizen = { provincie: 'Noord-Holland', land: 'NL', lat: 52.7025, lng: 5.2903 };
    expect(leadBinnenProvincieMarge(enkhuizen, ['NL:Friesland'], 25)).toBe(false);
  });

  it('meet wel gewoon over land', () => {
    // Hattem naar Overijssel: pal over een landgrens.
    expect(afstandTotProvincieGrensKm(52.4753, 6.0664, ['NL:Overijssel'])!).toBeLessThan(3);
  });

  it('levert niets op voor een lead die alleen over water te bereiken is', () => {
    // Midden op Texel, met alleen de Waddenzee en Noordzee eromheen.
    const texel = { provincie: 'Noord-Holland', lat: 53.0796, lng: 4.7986 };
    expect(leadBinnenProvincieMarge(texel, ['NL:Friesland'], 25)).toBe(false);
  });

  it('neemt de kortste afstand over meerdere provincies', () => {
    const alleen = afstandTotProvincieGrensKm(50.8514, 5.6910, ['NL:Groningen'])!;
    const samen = afstandTotProvincieGrensKm(50.8514, 5.6910, ['NL:Groningen', 'NL:Limburg'])!;
    expect(samen).toBeLessThan(alleen);
  });

  it('werkt voor Belgische provincies', () => {
    // Antwerpen-stad ligt in de provincie Antwerpen, dus vlak bij haar grens.
    const d = afstandTotProvincieGrensKm(51.2194, 4.4025, ['BE:Antwerpen']);
    expect(d).not.toBeNull();
    expect(d!).toBeLessThan(20);
  });

  it('geeft null bij onbekende sleutels', () => {
    expect(afstandTotProvincieGrensKm(52.0, 5.0, ['NL:Texas'])).toBeNull();
    expect(afstandTotProvincieGrensKm(52.0, 5.0, [])).toBeNull();
  });

  it('slaat provincies over die ver buiten bereik liggen', () => {
    // Met een krappe maxKm valt Groningen af en blijft er niets over.
    expect(afstandTotProvincieGrensKm(50.8514, 5.6910, ['NL:Groningen'], 5)).toBeNull();
  });
});

describe('landgrens van de marge', () => {
  /**
   * In de database staan Belgische leads met `land = 'NL'` en een Belgische
   * postcode die als Nederlandse postcode is gegeocodeerd, waardoor hun
   * coördinaten midden in Nederland liggen. Zonder landtoets belandden die in
   * de marge van een Nederlandse provincie.
   */
  it('laat een Belgische lead niet in de marge van een Nederlandse provincie', () => {
    const dilbeek = { provincie: 'Vlaams-Brabant', land: 'NL', postcode: '1700', lat: 52.4007, lng: 4.9323 };
    expect(leadBinnenProvincieMarge(dilbeek, ['NL:Noord-Holland'], 15)).toBe(false);
  });

  it('laat een Nederlandse lead wel in de marge van een Nederlandse provincie', () => {
    const hattem = { provincie: 'Gelderland', land: 'NL', postcode: '8051AA', lat: 52.4753, lng: 6.0664 };
    expect(leadBinnenProvincieMarge(hattem, ['NL:Overijssel'], 5)).toBe(true);
  });

  it('laat een Belgische lead wel in de marge van een Belgische provincie', () => {
    const nabijAntwerpen = { provincie: 'Oost-Vlaanderen', land: 'BE', postcode: '9100', lat: 51.1644, lng: 4.1400 };
    expect(leadBinnenProvincieMarge(nabijAntwerpen, ['BE:Antwerpen'], 25)).toBe(true);
  });
});

describe('leadBinnenProvincieMarge', () => {
  const hattem = { provincie: 'Gelderland', lat: 52.4753, lng: 6.0664 };

  it('neemt een lead net over de grens mee', () => {
    expect(leadBinnenProvincieMarge(hattem, ['NL:Overijssel'], 5)).toBe(true);
  });

  it('laat een verre lead buiten de marge', () => {
    const maastricht = { provincie: 'Limburg', lat: 50.8514, lng: 5.6910 };
    expect(leadBinnenProvincieMarge(maastricht, ['NL:Overijssel'], 15)).toBe(false);
  });

  it('doet niets zonder marge of zonder provincie', () => {
    expect(leadBinnenProvincieMarge(hattem, ['NL:Overijssel'], 0)).toBe(false);
    expect(leadBinnenProvincieMarge(hattem, [], 10)).toBe(false);
  });

  it('kan een lead zonder coördinaten niet beoordelen', () => {
    expect(leadBinnenProvincieMarge({ provincie: 'Gelderland' }, ['NL:Overijssel'], 15)).toBe(false);
    expect(leadBinnenProvincieMarge({ lat: null, lng: null }, ['NL:Overijssel'], 15)).toBe(false);
  });
});

describe('parseProvincieMargeKm', () => {
  it('leest gehele en gebroken getallen', () => {
    expect(parseProvincieMargeKm('10')).toBe(10);
    expect(parseProvincieMargeKm(7.5)).toBe(7.5);
    expect(parseProvincieMargeKm('7,5')).toBe(7.5);
  });

  it('negeert leeg en onzin', () => {
    expect(parseProvincieMargeKm('')).toBeNull();
    expect(parseProvincieMargeKm(null)).toBeNull();
    expect(parseProvincieMargeKm('abc')).toBeNull();
    expect(parseProvincieMargeKm(0)).toBeNull();
    expect(parseProvincieMargeKm(-5)).toBeNull();
  });

  it('kapt af op het maximum', () => {
    expect(parseProvincieMargeKm(9999)).toBe(100);
  });
});
