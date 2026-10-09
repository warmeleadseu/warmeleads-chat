import { describe, expect, it } from 'vitest';
import { berekenBatchWinst, telWinstOp } from '../batchWinst';

const basis = { batch_kind: 'leads', batch_size: 100, total_price: 2000, is_paid: true, mollie_payment_id: null, leads_delivered_external: 0, extern_bedrag_excl: null };

describe('berekenBatchWinst: omzet', () => {
  it('extern gefactureerd zonder factuur: batchprijs telt volledig mee', () => {
    const w = berekenBatchWinst(basis, [], { geleverd: 100, kosten: 600 });
    expect(w.betaalwijze).toBe('extern');
    expect(w.omzetBron).toBe('batchprijs');
    expect(w.omzet).toBe(2000);
    expect(w.winst).toBe(1400);
  });

  it('extern ingevuld bedrag gaat voor alles', () => {
    const w = berekenBatchWinst({ ...basis, extern_bedrag_excl: '1800' }, [{ subtotal: 2000 }], { geleverd: 100, kosten: 600 });
    expect(w.omzetBron).toBe('extern');
    expect(w.omzet).toBe(1800);
    expect(w.betaalwijze).toBe('extern');
  });

  it('factuur in het systeem gaat voor de batchprijs, creditnota gaat eraf', () => {
    const w = berekenBatchWinst(basis, [{ subtotal: 2100 }, { subtotal: -300, credit: true }], { geleverd: 100, kosten: 0 });
    expect(w.omzetBron).toBe('factuur');
    expect(w.omzet).toBe(1800);
    expect(w.betaalwijze).toBe('factuur');
  });

  it('Mollie en nog niet betaald', () => {
    expect(berekenBatchWinst({ ...basis, mollie_payment_id: 'tr_1' }, [{ subtotal: 2000 }], null).betaalwijze).toBe('mollie');
    expect(berekenBatchWinst({ ...basis, is_paid: false }, [{ subtotal: 2000 }], null).betaalwijze).toBe('open');
  });
});

describe('berekenBatchWinst: naar rato geleverd', () => {
  it('lopende batch: alleen het geleverde deel is verdiend', () => {
    const w = berekenBatchWinst(basis, [], { geleverd: 40, kosten: 240 });
    expect(w.voortgang).toBe(0.4);
    expect(w.gerealiseerd).toBe(800);
    expect(w.winst).toBe(560);
    expect(w.marge).toBe(70);
    expect(w.kostenPerLead).toBe(6);
    /* 60 resterende leads x 6 euro: 2000 - (240 + 360) */
    expect(w.prognoseWinst).toBe(1400);
  });

  it('compensatie: grotere batch, zelfde prijs, dus lagere opbrengst per lead', () => {
    const w = berekenBatchWinst({ ...basis, batch_size: 110 }, [], { geleverd: 110, kosten: 660 });
    expect(w.opbrengstPerLead).toBe(18.18);
    expect(w.gerealiseerd).toBe(2000);
    expect(w.winst).toBe(1340);
  });

  it('extern geleverde leads tellen mee voor de voortgang', () => {
    const w = berekenBatchWinst({ ...basis, leads_delivered_external: 10 }, [], { geleverd: 40, kosten: 0 });
    expect(w.voortgang).toBe(0.5);
    expect(w.gerealiseerd).toBe(1000);
  });

  it('meer geleverd dan besteld: niet meer dan 100% omzet', () => {
    const w = berekenBatchWinst(basis, [], { geleverd: 120, kosten: 0 });
    expect(w.voortgang).toBe(1);
    expect(w.gerealiseerd).toBe(2000);
  });

  it('niche-onderzoek: vast pakket telt in één keer', () => {
    const w = berekenBatchWinst({ ...basis, batch_kind: 'niche_research', total_price: 1000 }, [], { geleverd: 3, kosten: 50 });
    expect(w.gerealiseerd).toBe(1000);
    expect(w.winst).toBe(950);
    expect(w.prognoseWinst).toBe(950);
  });

  it('nog niets geleverd: geen prognose, geen kosten per lead', () => {
    const w = berekenBatchWinst(basis, [], null);
    expect(w.gerealiseerd).toBe(0);
    expect(w.prognoseWinst).toBeNull();
    expect(w.kostenPerLead).toBeNull();
    expect(w.marge).toBeNull();
  });
});

describe('telWinstOp', () => {
  it('telt op en berekent de marge over het geheel', () => {
    const a = berekenBatchWinst(basis, [], { geleverd: 100, kosten: 600 });
    const b = berekenBatchWinst(basis, [], { geleverd: 50, kosten: 500 });
    const t = telWinstOp([a, b]);
    expect(t.gerealiseerd).toBe(3000);
    expect(t.kosten).toBe(1100);
    expect(t.winst).toBe(1900);
    expect(t.marge).toBe(63.3);
  });
});
