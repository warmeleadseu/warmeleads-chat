import { describe, it, expect } from 'vitest';
import { filterKoppelingen } from '../koppelingZoek';

const NAMEN = {
  thuisbatterij: 'Thuisbatterij',
  thuisbatterij_partners: 'Thuisbatterij Partners',
  airco_partners: 'Airco Partners',
  dakrenovatie: 'Dakrenovatie',
};

const KOPPELINGEN = [
  { label: 'Thuisbatterij Leads', branch: 'thuisbatterij', customers: null },
  { label: 'TB Partners', branch: 'thuisbatterij_partners', customers: null },
  { label: 'Airco Partners', branch: 'airco_partners', customers: null },
  { label: 'Dak voor Mediabink', branch: 'dakrenovatie', customers: { name: 'Mediabink' } },
];

const namen = (r: typeof KOPPELINGEN) => r.map(k => k.label);

describe('filterKoppelingen', () => {
  it('geeft alles terug bij een lege zoekterm', () => {
    expect(filterKoppelingen(KOPPELINGEN, NAMEN, '')).toHaveLength(4);
    expect(filterKoppelingen(KOPPELINGEN, NAMEN, '   ')).toHaveLength(4);
  });

  it('vindt op naam van de koppeling', () => {
    expect(namen(filterKoppelingen(KOPPELINGEN, NAMEN, 'TB'))).toEqual(['TB Partners']);
  });

  it('is hoofdletterongevoelig', () => {
    expect(namen(filterKoppelingen(KOPPELINGEN, NAMEN, 'AIRCO'))).toEqual(['Airco Partners']);
  });

  it('vindt op branche-slug', () => {
    expect(namen(filterKoppelingen(KOPPELINGEN, NAMEN, 'dakrenovatie'))).toEqual(['Dak voor Mediabink']);
  });

  it('vindt op de weergavenaam van de branche', () => {
    const r = filterKoppelingen(KOPPELINGEN, NAMEN, 'Thuisbatterij Partners');
    expect(namen(r)).toEqual(['TB Partners']);
  });

  it('vindt op klantnaam', () => {
    expect(namen(filterKoppelingen(KOPPELINGEN, NAMEN, 'mediabink'))).toEqual(['Dak voor Mediabink']);
  });

  it('eist dat elk woord ergens voorkomt, ongeacht de volgorde', () => {
    expect(namen(filterKoppelingen(KOPPELINGEN, NAMEN, 'partners airco'))).toEqual(['Airco Partners']);
  });

  it('geeft niets terug als een van de woorden nergens voorkomt', () => {
    expect(filterKoppelingen(KOPPELINGEN, NAMEN, 'airco zonnepanelen')).toHaveLength(0);
  });

  it('werkt zonder weergavenamen', () => {
    expect(namen(filterKoppelingen(KOPPELINGEN, {}, 'thuisbatterij_partners'))).toEqual(['TB Partners']);
  });
});
