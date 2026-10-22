import { describe, expect, it } from 'vitest';
import { bouwResultaat, dagenTussen, periodeVan, personeelOpDag, verdiendPerDag, type WinstBatch } from '../resultaatPerPeriode';

const batch = (x: Partial<WinstBatch>): WinstBatch => ({
  id: 'b', batch_kind: 'leads', status: 'active', omzet: 1000, grootte: 100, geleverdExtern: 0,
  aangemaakt: '2026-05-01', afgerond: null, leveringen: [], ...x,
});
const som = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);

describe('verdiendPerDag', () => {
  it('per geleverde lead op de leverdag (omzet / grootte)', () => {
    const m = verdiendPerDag(batch({ leveringen: [{ dag: '2026-05-02', aantal: 10 }, { dag: '2026-05-05', aantal: 5 }] }));
    expect(m.get('2026-05-02')).toBeCloseTo(100);
    expect(m.get('2026-05-05')).toBeCloseTo(50);
  });
  it('nooit meer dan de batchomzet, ook als er meer geleverd is (compensatie)', () => {
    const m = verdiendPerDag(batch({ leveringen: [{ dag: '2026-05-02', aantal: 90 }, { dag: '2026-05-09', aantal: 20 }] }));
    expect(m.get('2026-05-09')).toBeCloseTo(100);
    expect(som(m)).toBeCloseTo(1000);
  });
  it('afgerond met minder leads: het restant op de afrondingsdag', () => {
    const m = verdiendPerDag(batch({ status: 'completed', afgerond: '2026-06-01', leveringen: [{ dag: '2026-05-02', aantal: 60 }] }));
    expect(m.get('2026-06-01')).toBeCloseTo(400);
    expect(som(m)).toBeCloseTo(1000);
  });
  it('niche-onderzoek: in één keer op de aanmaakdag', () => {
    const m = verdiendPerDag(batch({ batch_kind: 'niche_research', omzet: 1000, grootte: 0, aangemaakt: '2026-05-10' }));
    expect([...m.entries()]).toEqual([['2026-05-10', 1000]]);
  });
  it('buiten het systeem geleverde leads tellen op de aanmaakdag', () => {
    const m = verdiendPerDag(batch({ geleverdExtern: 20, aangemaakt: '2026-05-01', leveringen: [{ dag: '2026-05-03', aantal: 10 }] }));
    expect(m.get('2026-05-01')).toBeCloseTo(200);
    expect(m.get('2026-05-03')).toBeCloseTo(100);
  });
  it('lopende batch: alleen wat geleverd is', () => {
    expect(som(verdiendPerDag(batch({ leveringen: [{ dag: '2026-05-02', aantal: 30 }] })))).toBeCloseTo(300);
  });
  it('batch zonder omzet: niets', () => {
    expect(verdiendPerDag(batch({ omzet: 0, leveringen: [{ dag: '2026-05-02', aantal: 30 }] })).size).toBe(0);
  });
});

describe('personeel', () => {
  const regels = [{ bedrag_per_maand: 8500, ingang: '2026-05-01', einde: null }];
  it('per dag het maandbedrag gedeeld door de dagen van die maand', () => {
    expect(personeelOpDag(regels, '2026-05-15')).toBeCloseTo(8500 / 31);
    expect(personeelOpDag(regels, '2026-06-15')).toBeCloseTo(8500 / 30);
    expect(personeelOpDag(regels, '2026-04-30')).toBe(0);
  });
  it('een hele maand is precies het maandbedrag', () => {
    for (const [van, tot] of [['2026-05-01', '2026-05-31'], ['2026-06-01', '2026-06-30'], ['2027-02-01', '2027-02-28']]) {
      expect(dagenTussen(van, tot).reduce((s, d) => s + personeelOpDag(regels, d), 0)).toBeCloseTo(8500);
    }
  });
  it('nieuw bedrag met een nieuwe regel: oude maanden houden het oude bedrag', () => {
    const r = [
      { bedrag_per_maand: 8500, ingang: '2026-05-01', einde: '2026-09-30' },
      { bedrag_per_maand: 9500, ingang: '2026-10-01', einde: null },
    ];
    expect(dagenTussen('2026-09-01', '2026-09-30').reduce((s, d) => s + personeelOpDag(r, d), 0)).toBeCloseTo(8500);
    expect(dagenTussen('2026-10-01', '2026-10-31').reduce((s, d) => s + personeelOpDag(r, d), 0)).toBeCloseTo(9500);
  });
});

describe('periodeVan', () => {
  it('maand, kwartaal, jaar en week (maandag tot zondag)', () => {
    expect(periodeVan('2026-05-17', 'maand')).toEqual({ sleutel: '2026-05', van: '2026-05-01', tot: '2026-05-31' });
    expect(periodeVan('2026-05-17', 'kwartaal')).toEqual({ sleutel: '2026-K2', van: '2026-04-01', tot: '2026-06-30' });
    expect(periodeVan('2026-05-17', 'jaar')).toEqual({ sleutel: '2026', van: '2026-01-01', tot: '2026-12-31' });
    expect(periodeVan('2026-10-22', 'week')).toEqual({ sleutel: '2026-10-19', van: '2026-10-19', tot: '2026-10-25' });
    expect(periodeVan('2026-10-25', 'week').sleutel).toBe('2026-10-19');
  });
});

describe('bouwResultaat', () => {
  const regels = [{ bedrag_per_maand: 8500, ingang: '2026-05-01', einde: null }];
  const m = (o: Record<string, number>) => new Map(Object.entries(o));

  it('omzet − advertentie = bruto; − personeel = netto; marge, break-even en kosten per lead', () => {
    const [mei] = bouwResultaat({
      soort: 'maand', start: '2026-05-01', vandaag: '2026-06-10',
      verdiend: m({ '2026-05-10': 20000 }), gefactureerd: m({ '2026-05-02': 25000 }), advertentie: m({ '2026-05-10': 9000 }),
      leveringen: m({ '2026-05-10': 500 }), personeel: regels,
    });
    expect(mei).toMatchObject({
      sleutel: '2026-05', lopend: false, verdiend: 20000, gefactureerd: 25000, advertentie: 9000, brutowinst: 11000,
      personeel: 8500, netto: 2500, marge: 12.5, breakEven: 17500, leveringen: 500, personeelPerLead: 17, kostenPerLead: 35, prognose: null,
    });
  });

  it('lopende maand: personeel tot vandaag, en een prognose voor de hele maand', () => {
    const r = bouwResultaat({
      soort: 'maand', start: '2026-06-01', vandaag: '2026-06-10',
      verdiend: m({ '2026-06-05': 10000 }), gefactureerd: new Map(), advertentie: m({ '2026-06-05': 4000 }),
      leveringen: new Map(), personeel: regels,
    });
    expect(r[0].lopend).toBe(true);
    expect(r[0].personeel).toBeCloseTo((8500 / 30) * 10, 1);
    expect(r[0].prognose).toEqual({ verdiend: 30000, advertentie: 12000, personeel: 8500, netto: 9500 });
  });

  it('verlies: negatief netto en negatieve marge', () => {
    const [mei] = bouwResultaat({
      soort: 'maand', start: '2026-05-01', vandaag: '2026-06-01',
      verdiend: m({ '2026-05-10': 10000 }), gefactureerd: new Map(), advertentie: m({ '2026-05-10': 6000 }),
      leveringen: new Map(), personeel: regels,
    });
    expect(mei.netto).toBe(-4500);
    expect(mei.marge).toBe(-45);
    expect(mei.personeelPerLead).toBeNull();
  });

  it('weken en kwartalen tellen op tot hetzelfde totaal', () => {
    const basis = {
      start: '2026-05-01', vandaag: '2026-07-31',
      verdiend: m({ '2026-05-03': 1000, '2026-06-20': 2000, '2026-07-30': 3000 }), gefactureerd: new Map<string, number>(),
      advertentie: m({ '2026-05-04': 500, '2026-07-01': 700 }), leveringen: new Map<string, number>(), personeel: regels,
    };
    const tel = (rs: { netto: number }[]) => Math.round(rs.reduce((s, x) => s + x.netto, 0) * 100) / 100;
    const maanden = tel(bouwResultaat({ ...basis, soort: 'maand' }));
    expect(tel(bouwResultaat({ ...basis, soort: 'week' }))).toBeCloseTo(maanden, 1);
    expect(tel(bouwResultaat({ ...basis, soort: 'kwartaal' }))).toBeCloseTo(maanden, 1);
    expect(maanden).toBeCloseTo(6000 - 1200 - 3 * 8500, 1);
  });
});
