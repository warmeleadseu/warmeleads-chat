import { describe, expect, it } from 'vitest';
import { omzetPosten, telOmzet, type OmzetFactuur, type OmzetInvoer } from '../omzetPerMaand';

const kort = (p: { dag: string; bedrag: number; soort: string }[]) => p.map(({ dag, bedrag, soort }) => ({ dag, bedrag, soort }));

const dagVan = (iso: string) => iso.slice(0, 10);
const factuur = (o: Partial<OmzetFactuur> & { id: string }): OmzetFactuur => ({
  customer_id: 'k1', batch_id: null, appointment_batch_id: null, credit_note_of: null, subtotal: 0,
  status: 'paid', paid_at: null, created_at: '2026-10-01T10:00:00Z', ...o,
});
const leeg: OmzetInvoer = { batches: [], facturen: [], afspraakBatches: null, extern: [], dagVan };
const batch = (id: string, o: Record<string, unknown> = {}) => ({
  id, customer_id: 'k1', batch_kind: 'leads', created_at: '2026-10-05T09:00:00Z', total_price: 1000, extern_bedrag_excl: null, ...o,
});

describe('omzet per maand', () => {
  it('telt het factuurbedrag op de betaaldag, niet de batchprijs op de aanmaakdag', () => {
    const p = omzetPosten({
      ...leeg,
      batches: [batch('b1', { total_price: 6560, created_at: '2026-09-28T09:00:00Z' })],
      facturen: [factuur({ id: 'f1', batch_id: 'b1', subtotal: 5535, paid_at: '2026-10-02T12:00:00Z' })],
    });
    expect(kort(p)).toEqual([{ dag: '2026-10-02', bedrag: 5535, soort: 'leads' }]);
    expect(telOmzet(p, '2026-09-01', '2026-09-30').totaal).toBe(0);
    expect(telOmzet(p, '2026-10-01', '2026-10-31').totaal).toBe(5535);
  });

  it('een extern bedrag gaat voor; zonder factuur telt de batchprijs op de aanmaakdag', () => {
    const p = omzetPosten({
      ...leeg,
      batches: [batch('b1', { extern_bedrag_excl: '900' }), batch('b2', { total_price: '450.50' }), batch('b3', { batch_kind: 'bulk_leads', total_price: 300 })],
      facturen: [factuur({ id: 'f1', batch_id: 'b1', subtotal: 1500, paid_at: '2026-10-07T12:00:00Z' })],
    });
    expect(kort(p)).toEqual([
      { dag: '2026-10-07', bedrag: 900, soort: 'leads' },
      { dag: '2026-10-05', bedrag: 450.5, soort: 'leads' },
      { dag: '2026-10-05', bedrag: 300, soort: 'bulk' },
    ]);
  });

  it('een betaalde batch met een open factuur telt het factuurbedrag op de aanmaakdag', () => {
    const p = omzetPosten({ ...leeg, batches: [batch('b1')], facturen: [factuur({ id: 'f1', batch_id: 'b1', subtotal: 800, status: 'sent' })] });
    expect(kort(p)).toEqual([{ dag: '2026-10-05', bedrag: 800, soort: 'leads' }]);
  });

  it('interne en uitgesloten klanten tellen niet, ook hun facturen niet', () => {
    const p = omzetPosten({
      ...leeg,
      batches: [batch('b1', { intern: true }), batch('b2', { customer_id: 'weg' })],
      facturen: [
        factuur({ id: 'f1', subtotal: 100, paid_at: '2026-10-03T10:00:00Z', intern: true }),
        factuur({ id: 'f2', customer_id: 'weg', subtotal: 100, paid_at: '2026-10-03T10:00:00Z' }),
      ],
      extern: [{ datum: '2026-10-03', bedrag_excl: 50, soort: 'bulk', customer_id: 'weg' }],
      uitgesloten: new Set(['weg']),
    });
    expect(kort(p)).toEqual([]);
  });

  it('losse facturen, afspraken, creditnota\'s en externe facturen', () => {
    const p = omzetPosten({
      ...leeg,
      batches: [batch('b1')],
      facturen: [
        factuur({ id: 'f1', batch_id: 'b1', subtotal: 1000, paid_at: '2026-10-06T10:00:00Z' }),
        factuur({ id: 'c1', credit_note_of: 'f1', batch_id: null, subtotal: -200, status: 'credited', created_at: '2026-10-20T10:00:00Z' }),
        factuur({ id: 'f2', subtotal: 600, paid_at: '2026-10-08T10:00:00Z' }),
        factuur({ id: 'f3', subtotal: 999, status: 'sent' }),
        factuur({ id: 'f4', appointment_batch_id: 'a1', subtotal: 600, paid_at: '2026-10-09T10:00:00Z' }),
      ],
      afspraakBatches: [{ id: 'a1', customer_id: 'k1', total_price: 2400, created_at: '2026-10-01T10:00:00Z' }],
      extern: [{ datum: '2026-10-15', bedrag_excl: '2500', soort: 'bulk' }, { datum: '2026-10-16', bedrag_excl: -100, soort: 'overig' }],
    });
    expect(telOmzet(p, '2026-10-01', '2026-10-31')).toEqual({
      totaal: 4400,
      perSoort: { leads: 1000, bulk: 2500, afspraken: 600, overig: 500, credit: -200 },
    });
  });

  it('zonder afspraken tellen afspraakfacturen en hun creditnota\'s niet', () => {
    const p = omzetPosten({
      ...leeg,
      facturen: [
        factuur({ id: 'f4', appointment_batch_id: 'a1', subtotal: 600, paid_at: '2026-10-09T10:00:00Z' }),
        factuur({ id: 'c4', credit_note_of: 'f4', subtotal: 600, created_at: '2026-10-10T10:00:00Z' }),
      ],
    });
    expect(kort(p)).toEqual([]);
  });

  it('een creditnota op een batch met extern bedrag gaat er niet nog eens af', () => {
    const p = omzetPosten({
      ...leeg,
      batches: [batch('b1', { extern_bedrag_excl: 700 })],
      facturen: [
        factuur({ id: 'f1', batch_id: 'b1', subtotal: 1000, paid_at: '2026-10-06T10:00:00Z' }),
        factuur({ id: 'c1', credit_note_of: 'f1', subtotal: 300, created_at: '2026-10-07T10:00:00Z' }),
      ],
    });
    expect(kort(p)).toEqual([{ dag: '2026-10-06', bedrag: 700, soort: 'leads' }]);
  });
});
