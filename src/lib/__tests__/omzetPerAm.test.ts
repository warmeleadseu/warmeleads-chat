import { describe, expect, it } from 'vitest';
import { omzetPosten, telOmzet, type OmzetBatch, type OmzetFactuur } from '../omzetPerMaand';
import { amVanPost, omzetPerAm, omzetRegelsVanAm, type AmBronnen } from '../omzetPerAm';

const dagVan = (iso: string) => iso.slice(0, 10);
const batch = (o: Partial<OmzetBatch> & { id: string }): OmzetBatch => ({ customer_id: 'k1', batch_kind: 'leads', created_at: '2026-11-02T08:00:00Z', total_price: 1000, ...o });
const factuur = (o: Partial<OmzetFactuur> & { id: string }): OmzetFactuur => ({
  customer_id: 'k1', batch_id: null, appointment_batch_id: null, credit_note_of: null, subtotal: 1000, status: 'paid',
  paid_at: '2026-11-02T09:00:00Z', created_at: '2026-11-02T08:00:00Z', ...o,
});

/* De situatie van 4 nov 2026: de oorzaak van €12.000 tegenover €4.800 en €6.000. */
function november() {
  const batches = [
    batch({ id: 'dta', customer_id: 'k-dta', created_at: '2026-10-27T08:00:00Z', total_price: 900, account_manager_id: 'don' }),
    /* Batchprijs na 20 gratis leads (compensatie), maar de factuur is betaald. */
    batch({ id: 'mediabink', customer_id: 'k-mb', total_price: 5535, account_manager_id: 'don' }),
    batch({ id: 'ek1', customer_id: 'k-ek', total_price: 1095, account_manager_id: 'luigi' }),
    batch({ id: 'sol', customer_id: 'k-sol', total_price: 2700, account_manager_id: 'luigi' }),
    batch({ id: 'okt', customer_id: 'k-ek', created_at: '2026-10-29T08:00:00Z', total_price: 1500, account_manager_id: 'luigi' }),
  ];
  const facturen = [
    factuur({ id: 'f1', batch_id: 'dta', subtotal: 900, paid_at: '2026-11-02T10:25:00Z' }),
    factuur({ id: 'f2', batch_id: 'mediabink', subtotal: 5945, paid_at: '2026-11-02T10:16:00Z' }),
    factuur({ id: 'f3', batch_id: 'ek1', subtotal: 1095, paid_at: '2026-11-04T13:30:00Z' }),
    factuur({ id: 'f4', batch_id: 'sol', subtotal: 2700, paid_at: '2026-11-04T10:12:00Z' }),
    factuur({ id: 'f5', batch_id: 'okt', subtotal: 1500, paid_at: '2026-10-29T08:36:00Z' }),
    /* Iso-Tech: nog niet betaald, dus geen batch in de betaalde lijst en geen omzet. */
    factuur({ id: 'f6', customer_id: 'k-iso', subtotal: 1562.5, status: 'open', paid_at: null }),
  ];
  const extern = [{ datum: '2026-11-03', bedrag_excl: 500, soort: 'bulk', customer_id: 'k-sgb' }];
  const posten = omzetPosten({ batches, facturen, afspraakBatches: null, extern, dagVan });
  const bronnen: AmBronnen = {
    batchAm: new Map(batches.map(b => [b.id, b.account_manager_id ?? null])),
    klantAm: new Map([['k-sgb', 'don'], ['k-iso', 'luigi']]),
  };
  return { posten, bronnen };
}

describe('omzet per accountmanager', () => {
  it('telt dezelfde betaalde omzet als het totaal, en samen precies het totaal', () => {
    const { posten, bronnen } = november();
    const periode = { vanDag: '2026-11-01', totDag: '2026-11-30' };
    const perAm = omzetPerAm(posten, periode, bronnen);
    expect(perAm.get('luigi')).toMatchObject({ totaal: 3795, bulk: 0, batches: 2 });
    /* Mediabink telt het betaalde factuurbedrag, DTA telt in november (betaald op 2-11). */
    expect(perAm.get('don')).toMatchObject({ totaal: 7345, bulk: 500, batches: 2 });
    const som = [...perAm.values()].reduce((s, r) => s + r.totaal, 0);
    expect(som).toBe(telOmzet(posten, periode.vanDag, periode.totDag).totaal);
  });

  it('een batch telt bij de accountmanager van de batch, anders bij die van de klant', () => {
    const bronnen: AmBronnen = { batchAm: new Map([['b1', 'a'], ['b2', null]]), klantAm: new Map([['k', 'b']]) };
    expect(amVanPost({ batch_id: 'b1', customer_id: 'k' }, bronnen)).toBe('a');
    expect(amVanPost({ batch_id: 'b2', customer_id: 'k' }, bronnen)).toBe('b');
    expect(amVanPost({ batch_id: null, customer_id: 'k' }, bronnen)).toBe('b');
    expect(amVanPost({ batch_id: null, customer_id: 'x' }, bronnen)).toBeNull();
  });

  it('uitgesloten batches tellen niet mee', () => {
    const { posten, bronnen } = november();
    const perAm = omzetPerAm(posten, { vanDag: '2026-11-01', totDag: '2026-11-30' }, bronnen, new Set(['sol']));
    expect(perAm.get('luigi')).toMatchObject({ totaal: 1095, batches: 1 });
  });

  it('een creditnota gaat eraf bij de accountmanager van de batch', () => {
    const batches = [batch({ id: 'b', account_manager_id: 'a' })];
    const facturen = [
      factuur({ id: 'f', batch_id: 'b' }),
      factuur({ id: 'c', batch_id: 'b', credit_note_of: 'f', subtotal: -200, created_at: '2026-11-05T08:00:00Z' }),
    ];
    const posten = omzetPosten({ batches, facturen, afspraakBatches: null, extern: [], dagVan });
    const r = omzetPerAm(posten, { vanDag: '2026-11-01', totDag: '2026-11-30' }, { batchAm: new Map([['b', 'a']]), klantAm: new Map() }).get('a');
    expect(r).toMatchObject({ totaal: 800, batches: 1 });
  });

  it('een rollend venster telt op het tijdstip van betalen', () => {
    const { posten, bronnen } = november();
    const r = omzetPerAm(posten, { vanMoment: '2026-11-04T00:00:00Z', totMoment: '2026-11-04T12:00:00Z' }, bronnen);
    expect(r.get('luigi')?.totaal).toBe(2700);
  });

  it('geeft per accountmanager één regel per batch, op de dag van betalen', () => {
    const { posten, bronnen } = november();
    const regels = omzetRegelsVanAm(posten, { vanDag: '2026-11-01', totDag: '2026-11-30' }, bronnen, 'don');
    expect(regels.map(r => [r.batch_id, r.bedrag, r.dag])).toEqual([
      ['dta', 900, '2026-11-02'],
      ['mediabink', 5945, '2026-11-02'],
      [null, 500, '2026-11-03'],
    ]);
  });
});
