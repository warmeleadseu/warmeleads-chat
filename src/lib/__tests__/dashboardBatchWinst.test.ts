import { describe, expect, it } from 'vitest';
import { batchRegels, klantRegels, type DashboardBatch, type DashboardLevering } from '../dashboardBatchWinst';

const batch = (b: Partial<DashboardBatch>): DashboardBatch => ({
  id: 'b1', customer_id: 'k1', klant: 'Klant', branch: 'thuisbatterij', batch_kind: 'leads', batch_size: 4, status: 'active',
  price_per_lead: 27, aangemaakt: '2026-11-03', omzet: 100, winstdeel: 0, ...b,
});
const lever = (lead_id: string, x: Partial<DashboardLevering> = {}): DashboardLevering =>
  ({ lead_id, customer_id: 'k1', batch_id: 'b1', assigned_at: '2026-11-04T10:00:00Z', source: 'distribution', ...x });
const basis = {
  kosten: new Map([['l1', 20], ['l2', 10]]),
  zonderKostendeel: new Set(['is']),
  periodeStartIso: '2026-10-31T23:00:00Z',
  periodeStartDag: '2026-11-01',
};

describe('batchRegels', () => {
  it('rekent met het gefactureerde bedrag over de batchgrootte, niet met prijs per lead', () => {
    const [r] = batchRegels({ ...basis, batches: [batch({})], leveringen: [lever('l1'), lever('l2')] });
    expect(r).toMatchObject({ delivered: 2, revenue: 50, cost: 30, profit: 20, pricePerLead: 25, marginPct: 40 });
  });
  it('deelt de kosten over betalende klanten; Infinite Scale draagt niets', () => {
    const [r] = batchRegels({
      ...basis,
      batches: [batch({})],
      leveringen: [
        lever('l1'),
        lever('l1', { customer_id: 'k2', batch_id: 'b9' }),
        lever('l1', { customer_id: 'is', batch_id: 'b8' }),
        lever('l1', { customer_id: 'k3', source: 'mirror' }),
      ],
    });
    expect(r.cost).toBe(10);
  });
  it('telt alleen leveringen in de periode en geen interne batches', () => {
    expect(batchRegels({ ...basis, batches: [batch({})], leveringen: [lever('l1', { assigned_at: '2026-10-20T10:00:00Z' })] })).toEqual([]);
    expect(batchRegels({ ...basis, batches: [batch({ customer_id: 'is' })], leveringen: [lever('l1', { customer_id: 'is' })] })).toEqual([]);
  });
  it('niche-onderzoek telt één keer, in de periode van bestellen', () => {
    const niche = { batch_kind: 'niche_research', omzet: 1000 };
    expect(batchRegels({ ...basis, batches: [batch(niche)], leveringen: [] })[0].revenue).toBe(1000);
    expect(batchRegels({ ...basis, batches: [batch({ ...niche, aangemaakt: '2026-10-01' })], leveringen: [lever('l1')] })[0].revenue).toBe(0);
  });
  it('trekt de winstdeling af', () => {
    const [r] = batchRegels({ ...basis, batches: [batch({ winstdeel: 0.5 })], leveringen: [lever('l1'), lever('l2')] });
    expect(r).toMatchObject({ winstdeling: 10, profit: 10 });
  });
});

describe('klantRegels', () => {
  it('voegt bulkfacturen en hun winstdeling toe', () => {
    const regels = batchRegels({ ...basis, batches: [batch({ winstdeel: 0.5 })], leveringen: [lever('l1'), lever('l2')] });
    const [k] = klantRegels(regels, [{ customer_id: 'k1', bedrag: 200, winstdeling: 100 }, { customer_id: null, bedrag: 50, winstdeling: 0 }], () => 'x');
    expect(k).toEqual({ name: 'Klant', revenue: 250, cost: 30, winstdeling: 110, margin: 110, leads: 2, marginPct: 44 });
  });
});
