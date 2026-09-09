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

  it('rekent over water heen, zoals afgesproken', () => {
    /* Lelystad (Flevoland) ligt hemelsbreed ruim 20 km van Noord-Holland,
       dwars over het IJsselmeer. Over de weg is dat ongeveer 70 km. Dat de
       korte route telt is de afgesproken keuze. */
    const d = afstandTotProvincieGrensKm(52.5185, 5.4714, ['NL:Noord-Holland']);
    expect(d!).toBeGreaterThan(15);
    expect(d!).toBeLessThan(30);
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
