import { describe, expect, it } from 'vitest';
import { afTeStaan, leesWinstAfspraken, telWinstdeling, verdeelOverDagen, winstdeelVan, winstdelingBijPosten } from '../winstdeling';
import { berekenBatchWinst, telWinstOp } from '../batchWinst';
import { bouwResultaat } from '../resultaatPerPeriode';

const AFSPRAAK = [{ customer_id: 'k1', vanaf: '2026-09-25', tot: '2026-11-25', deel: 0.5 }];
const batch = { batch_kind: 'leads', status: 'completed', batch_size: 100, total_price: 2700, is_paid: true };

describe('afspraken lezen', () => {
  it('leest een lijst en geeft een lege lijst zonder instelling', () => {
    expect(leesWinstAfspraken(JSON.stringify(AFSPRAAK))).toEqual(AFSPRAAK);
    expect(leesWinstAfspraken(null)).toEqual([]);
  });
  it('weigert een ongeldige afspraak in plaats van hem stil over te slaan', () => {
    expect(() => leesWinstAfspraken('[{"customer_id":"k1","vanaf":"gisteren","deel":0.5}]')).toThrow();
    expect(() => leesWinstAfspraken('[{"customer_id":"k1","vanaf":"2026-01-01","deel":50}]')).toThrow();
  });
  it('geldt alleen voor die klant, vanaf en tot en met de genoemde dagen', () => {
    expect(winstdeelVan(AFSPRAAK, 'k1', '2026-09-25')).toBe(0.5);
    expect(winstdeelVan(AFSPRAAK, 'k1', '2026-11-25')).toBe(0.5);
    expect(winstdeelVan(AFSPRAAK, 'k1', '2026-09-24')).toBe(0);
    expect(winstdeelVan(AFSPRAAK, 'k1', '2026-11-26')).toBe(0);
    expect(winstdeelVan(AFSPRAAK, 'k2', '2026-10-01')).toBe(0);
    expect(winstdeelVan(AFSPRAAK, null, '2026-10-01')).toBe(0);
  });
});

describe('winst per batch met deling', () => {
  it('deelt de winst na leadkosten en telt precies op', () => {
    const w = berekenBatchWinst(batch, [], { geleverd: 100, kosten: 700 }, 0.5);
    expect(w.winstdeling).toBe(1000);
    expect(w.winst).toBe(1000);
    expect(w.prognoseWinst).toBe(1000);
    expect(telWinstOp([w]).winstdeling).toBe(1000);
  });
  it('deelt geen verlies en verandert niets zonder afspraak', () => {
    const verlies = berekenBatchWinst(batch, [], { geleverd: 100, kosten: 3000 }, 0.5);
    expect(verlies.winstdeling).toBe(0);
    expect(verlies.winst).toBe(-300);
    expect(berekenBatchWinst(batch, [], { geleverd: 100, kosten: 700 }).winst).toBe(2000);
    expect(afTeStaan(-10, 0.5)).toBe(0);
  });
});

describe('winstdeling bij de betaalde omzet', () => {
  const batches = new Map([['b1', { deel: 0.5, omzet: 2700, winst: 2000 }]]);
  it('telt batch en bulk op hun eigen dag', () => {
    const p = winstdelingBijPosten([
      { dag: '2026-10-29', bedrag: 2700, batch_id: 'b1', customer_id: 'k1' },
      { dag: '2026-10-19', bedrag: 1011.5, batch_id: null, customer_id: 'k1' },
      { dag: '2026-10-19', bedrag: 900, batch_id: null, customer_id: 'k2' },
      { dag: '2026-10-19', bedrag: 900, batch_id: 'b2', customer_id: 'k1' },
    ], batches, AFSPRAAK);
    expect(telWinstdeling(p, '2026-10-29', '2026-10-29')).toBe(1000);
    expect(telWinstdeling(p, '2026-10-01', '2026-10-31')).toBe(1505.75);
    expect(telWinstdeling(p, '2026-11-01', '2026-11-30')).toBe(0);
  });
  it('in delen betaald en een creditnota tellen naar rato', () => {
    const p = winstdelingBijPosten([
      { dag: '2026-10-01', bedrag: 1350, batch_id: 'b1', customer_id: 'k1' },
      { dag: '2026-10-02', bedrag: 1350, batch_id: 'b1', customer_id: 'k1' },
      { dag: '2026-10-03', bedrag: -270, batch_id: 'b1', customer_id: 'k1' },
    ], batches, AFSPRAAK);
    expect(p.map(x => x.bedrag)).toEqual([500, 500, -100]);
  });
});

describe('resultaat per periode', () => {
  it('verdeelt over de leverdagen en gaat van het netto af', () => {
    const perDag = verdeelOverDagen(1000, new Map([['2026-10-30', 1], ['2026-11-01', 3]]));
    expect(perDag.get('2026-10-30')).toBe(250);
    const r = bouwResultaat({
      soort: 'maand', start: '2026-10-01', vandaag: '2026-11-30',
      verdiend: new Map([['2026-11-01', 2700]]), gefactureerd: new Map(), advertentie: new Map([['2026-11-01', 700]]),
      winstdeling: perDag, leveringen: new Map(), personeel: [],
    });
    expect(r.map(x => x.winstdeling)).toEqual([250, 750]);
    expect(r[1].brutowinst).toBe(2000);
    expect(r[1].netto).toBe(1250);
    expect(r[1].breakEven).toBe(1450);
  });
});
