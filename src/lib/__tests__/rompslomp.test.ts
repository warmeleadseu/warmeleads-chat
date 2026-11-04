import { describe, expect, it } from 'vitest';
import { deelIn, zelfdeKlant, type RompslompFactuur, type WlBatch } from '../rompslomp';

let n = 0;
const factuur = (o: Partial<RompslompFactuur> & { klant?: string }): RompslompFactuur => ({
  id: ++n, date: '2026-10-10', invoice_number: `2026100${n}`, status: 'published', payment_status: 'paid',
  price_without_vat: '1000.0', description: '', cached_contact: { name: o.klant ?? 'Klant B.V.' }, invoice_lines: [], ...o,
});
const batch = (o: Partial<WlBatch>): WlBatch => ({ id: `b${++n}`, klant: 'Klant B.V.', created_at: '2026-10-05T10:00:00Z', total_price: 1000, ...o });
const KLANTEN = [{ id: 'k-sgb', name: 'SGB Grupo de Ventas' }, { id: 'k-klant', name: 'Klant' }];

describe('Rompslomp-facturen indelen', () => {
  it('herkent dezelfde klant ook met B.V. of een langere naam', () => {
    expect(zelfdeKlant('Partof B.V.', 'partof')).toBe(true);
    expect(zelfdeKlant('SGB Grupo de Ventas S.L.', 'SGB Grupo de Ventas')).toBe(true);
    expect(zelfdeKlant('ECS', 'ECS Power')).toBe(false);
    expect(zelfdeKlant('Groenvolt', 'Greenteam')).toBe(false);
  });

  it('afspraken tellen nooit mee', () => {
    const [v] = deelIn([factuur({ description: 'Factuur - 10 exclusieve thuisbatterij afspraken' })], [], []);
    expect(v).toMatchObject({ telt_mee: false, reden: 'afspraken' });
  });

  it('een factuur die als batch al in WarmeLeads staat telt niet, en een batch koppelt maar één keer', () => {
    const b = batch({ total_price: 1500 });
    const v = deelIn([
      factuur({ price_without_vat: '1500.0', description: '50 exclusieve leads' }),
      factuur({ price_without_vat: '1500.0', description: '50 exclusieve leads', date: '2026-10-20' }),
    ], [b], KLANTEN);
    expect(v[0]).toMatchObject({ telt_mee: false, customer_id: 'k-klant' });
    expect(v[0].reden).toMatch(/staat al in WarmeLeads/);
    expect(v[1]).toMatchObject({ telt_mee: true, reden: 'geen batch in WarmeLeads gevonden' });
  });

  it('vergelijkt ook met het factuurbedrag in WarmeLeads, maar niet buiten 45 dagen', () => {
    const v = deelIn([
      factuur({ price_without_vat: '900.0' }),
      factuur({ price_without_vat: '700.0', date: '2026-12-30' }),
    ], [batch({ total_price: 1500, factuurbedrag: 900 }), batch({ total_price: 700 })], []);
    expect(v.map(x => x.telt_mee)).toEqual([false, true]);
    expect(v[0].reden).toMatch(/staat al/);
    expect(v[1]).toMatchObject({ telt_mee: true, reden: 'geen batch in WarmeLeads gevonden' });
  });

  it('bulk telt mee; met het externe factuurnummer op een batch telt alleen het verschil', () => {
    const v = deelIn([
      factuur({ invoice_number: 'R-0', klant: 'SGB Grupo de Ventas S.L.', description: 'Bulk TB leads', price_without_vat: '585.2' }),
      factuur({ invoice_number: 'R-1', klant: 'Solaris Prime', description: 'TB Bulk', price_without_vat: '6450.0' }),
      factuur({ invoice_number: 'R-2', klant: 'Solaris Prime', description: 'TB Bulk', price_without_vat: '2700.0' }),
    ], [batch({ klant: 'SolarisPrime', extern_factuurnummer: 'R-1', extern_bedrag_excl: '2700' }), batch({ klant: 'x', extern_factuurnummer: 'R-2', extern_bedrag_excl: 2700 })], KLANTEN);
    const nr = (x: string) => v.find(y => y.factuurnummer === x);
    expect(nr('R-0')).toMatchObject({ telt_mee: true, soort: 'bulk', reden: 'bulk', customer_id: 'k-sgb', bedrag_excl: 585.2 });
    expect(nr('R-1')).toMatchObject({ telt_mee: true, bedrag_excl: 3750 });
    expect(nr('R-2')).toMatchObject({ telt_mee: false });
  });

  it('creditfacturen tellen mee als negatief bedrag; een positieve "creditfactuur" gaat naar beoordelen', () => {
    const v = deelIn([
      factuur({ price_without_vat: '-945.0', description: 'Creditfactuur - terugbetaling' }),
      factuur({ price_without_vat: '425.0', description: 'Creditfactuur - Roofing leads' }),
    ], [], []);
    expect(v[0]).toMatchObject({ telt_mee: true, reden: 'creditfactuur', bedrag_excl: -945 });
    expect(v[1]).toMatchObject({ telt_mee: false });
    expect(v[1].reden).toMatch(/positief/);
  });

  it('concepten en facturen van vóór 1 mei vallen weg; onbetaald wordt vastgelegd', () => {
    const v = deelIn([
      factuur({ status: 'concept', description: 'bulk' }),
      factuur({ date: '2026-04-30', description: 'bulk' }),
      factuur({ payment_status: 'unpaid', description: 'bulk' }),
    ], [], []);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ betaald: false, telt_mee: true });
  });
});
