import { describe, expect, it } from 'vitest';
import { beoordeelRegels, herkenKolommen, leesDatum, leesExternBedrag, naamSleutel } from '../externeOmzet';

const KLANTEN = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Mediabink B.V.' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Dubbel' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Dubbel' },
];

describe('externe omzet', () => {
  it('leest datums uit exports en Excel', () => {
    expect(leesDatum('2026-10-15')).toBe('2026-10-15');
    expect(leesDatum('15-10-2026')).toBe('2026-10-15');
    expect(leesDatum('5/6/2026')).toBe('2026-06-05');
    expect(leesDatum(46310)).toBe('2026-10-15');
    expect(leesDatum(new Date(2026, 9, 15))).toBe('2026-10-15');
    expect(leesDatum('31-02-2026')).toBeNull();
    expect(leesDatum('morgen')).toBeNull();
  });

  it('leest bedragen in Nederlandse en Engelse notatie', () => {
    expect(leesExternBedrag('€ 1.234,56')).toBe(1234.56);
    expect(leesExternBedrag('1,234.56')).toBe(1234.56);
    expect(leesExternBedrag('-250')).toBe(-250);
    expect(leesExternBedrag(2500)).toBe(2500);
  });

  it('herkent de kolommen van een factuurexport; excl. btw gaat voor het totaal', () => {
    expect(herkenKolommen(['Factuurnummer', 'Factuurdatum', 'Vervaldatum', 'Relatie', 'Totaal incl. btw', 'BTW', 'Totaal excl. btw', 'Omschrijving'])).toEqual({
      factuurnummer: 'Factuurnummer', datum: 'Factuurdatum', klant: 'Relatie', bedrag_excl: 'Totaal excl. btw', omschrijving: 'Omschrijving',
    });
    expect(herkenKolommen(['Datum', 'Klant', 'Bedrag'])).toEqual({ datum: 'Datum', klant: 'Klant', bedrag_excl: 'Bedrag' });
  });

  it('koppelt klantnamen zonder B.V. en hoofdletters, maar raadt niet bij twee gelijke namen', () => {
    expect(naamSleutel('Mediabink B.V.')).toBe(naamSleutel('mediabink'));
    const b = beoordeelRegels([
      { datum: '2026-10-01', klant: 'mediabink', bedrag_excl: '100' },
      { datum: '2026-10-01', klant: 'Dubbel', bedrag_excl: '100' },
      { datum: '2026-10-01', klant: 'Nieuwe Partij', bedrag_excl: '100' },
    ], [], KLANTEN);
    expect(b.map(x => [x.status, x.rij?.customer_id ?? null, x.klantOnbekend])).toEqual([
      ['goed', KLANTEN[0].id, false], ['goed', null, true], ['goed', null, true],
    ]);
    expect(b[0].rij?.klant_naam).toBe('Mediabink B.V.');
  });

  it('slaat factuurnummers over die er al staan of dubbel in de lijst staan', () => {
    const b = beoordeelRegels([
      { datum: '2026-10-01', factuurnummer: 'R-2026-001', klant: 'X', bedrag_excl: 100 },
      { datum: '2026-10-02', factuurnummer: 'r-2026-002', klant: 'X', bedrag_excl: 100 },
      { datum: '2026-10-03', factuurnummer: 'R-2026-002', klant: 'X', bedrag_excl: 100 },
    ], ['r-2026-001'], []);
    expect(b.map(x => x.status)).toEqual(['dubbel', 'goed', 'dubbel']);
    expect(b[2].reden).toMatch(/twee keer/);
  });

  it('meldt regels zonder datum, bedrag of klant', () => {
    const b = beoordeelRegels([
      { datum: '', klant: 'X', bedrag_excl: 100 },
      { datum: '2026-10-01', klant: 'X', bedrag_excl: 'abc' },
      { datum: '2026-10-01', klant: 'X', bedrag_excl: 0 },
      { datum: '2026-10-01', bedrag_excl: 100 },
    ], [], []);
    expect(b.map(x => x.reden)).toEqual(['geen geldige datum', 'geen geldig bedrag', 'geen geldig bedrag', 'geen klant']);
  });

  it('soort: standaard bulk, of uit de kolom', () => {
    const b = beoordeelRegels([
      { datum: '2026-10-01', klant: 'X', bedrag_excl: 1 },
      { datum: '2026-10-01', klant: 'X', bedrag_excl: 1, soort: 'Overig' },
      { datum: '2026-10-01', klant: 'X', bedrag_excl: 1, soort: 'Bulkleads' },
    ], [], [], 'bulk');
    expect(b.map(x => x.rij?.soort)).toEqual(['bulk', 'overig', 'bulk']);
  });
});
