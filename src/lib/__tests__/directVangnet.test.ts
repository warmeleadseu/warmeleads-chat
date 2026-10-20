import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../distribution', () => ({ distributeLead: vi.fn() }));
vi.mock('../pdok', () => ({ resolveAddress: vi.fn(), isValidPlace: () => true }));

import { distributeLead } from '../distribution';
import { resolveAddress } from '../pdok';
import { draaiVangnet, selecteerVangnetLeads, vangnetMagGeocoderen, vangnetMinuutOverslaan, vangnetPogingNu, VANGNET_GEOCODE_TIMEOUT_MS, type VangnetLead } from '../directVangnet';

const NU = new Date('2026-10-20T10:07:30Z');
const secGeleden = (s: number) => new Date(NU.getTime() - s * 1000).toISOString();
const lead = (x: Partial<VangnetLead>): VangnetLead => ({
  id: 'l', branch: 'thuisbatterij', bron: 'zapier', phone_valid: true, created_at: secGeleden(120), assigned_customer_ids: [], ...x,
});
const DIRECT = new Set(['thuisbatterij']);
const SPIEGEL = ['spiegel'];
const ids = (l: VangnetLead[]) => l.map(x => x.id);

describe('selecteerVangnetLeads', () => {
  it('lead van 2 minuten zonder klant in een direct-branche: opgepakt', () => {
    expect(ids(selecteerVangnetLeads([lead({ id: 'a' })], DIRECT, SPIEGEL, NU))).toEqual(['a']);
  });
  it('jonger dan 45 seconden: nog niet (de verdeling bij binnenkomst is bezig)', () => {
    expect(selecteerVangnetLeads([lead({ created_at: secGeleden(30) })], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('ouder dan 30 minuten: niet meer, dat doet de verdeelronde', () => {
    expect(selecteerVangnetLeads([lead({ created_at: secGeleden(31 * 60) })], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('branche zonder direct-klant: niets', () => {
    expect(selecteerVangnetLeads([lead({ branch: 'warmtepomp' })], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('heeft al een klant: niets; alleen een spiegelkopie telt niet', () => {
    expect(selecteerVangnetLeads([lead({ assigned_customer_ids: ['k1'] })], DIRECT, SPIEGEL, NU)).toEqual([]);
    expect(ids(selecteerVangnetLeads([lead({ id: 's', assigned_customer_ids: ['spiegel'] })], DIRECT, SPIEGEL, NU))).toEqual(['s']);
  });
  it('demo, Excel-import en ongeldig telefoonnummer: niet', () => {
    expect(selecteerVangnetLeads([
      lead({ bron: 'demo' }), lead({ bron: 'excel_import' }), lead({ phone_valid: false }),
    ], DIRECT, SPIEGEL, NU)).toEqual([]);
  });
  it('telefoonnummer nog niet gecontroleerd (null): wel', () => {
    expect(selecteerVangnetLeads([lead({ phone_valid: null })], DIRECT, SPIEGEL, NU)).toHaveLength(1);
  });
});

describe('vangnetMinuutOverslaan', () => {
  it('slaat de minuut van de kwartierronde en die ervoor over', () => {
    const om = (m: number) => new Date(Date.UTC(2026, 9, 20, 10, m, 5));
    expect([0, 14, 15, 29, 30, 44, 45, 59].map(m => vangnetMinuutOverslaan(om(m)))).toEqual([true, true, true, true, true, true, true, true]);
    expect([1, 7, 13, 16, 31, 46].map(m => vangnetMinuutOverslaan(om(m)))).toEqual([false, false, false, false, false, false]);
  });
});

describe('vangnetPogingNu', () => {
  it('de eerste vijf minuten elke minuut, daarna elke vijf minuten', () => {
    const op = (min: number) => vangnetPogingNu(secGeleden(min * 60 + 10), NU);
    expect([1, 2, 3, 4].map(op)).toEqual([true, true, true, true]);
    expect([5, 6, 7, 8, 9, 10, 11, 15, 20, 29].map(op)).toEqual([true, false, false, false, false, true, false, true, true, false]);
  });
  it('over 30 minuten hooguit 9 pogingen in plaats van 26', () => {
    const pogingen = Array.from({ length: 30 }, (_, m) => m).filter(m => m >= 1 && vangnetPogingNu(secGeleden(m * 60 + 10), NU));
    expect(pogingen.length).toBeLessThanOrEqual(9);
  });
});

describe('vangnetMagGeocoderen', () => {
  it('alleen in de eerste twee minuten', () => {
    expect(vangnetMagGeocoderen(secGeleden(50), NU)).toBe(true);
    expect(vangnetMagGeocoderen(secGeleden(110), NU)).toBe(true);
    expect(vangnetMagGeocoderen(secGeleden(125), NU)).toBe(false);
    expect(vangnetMagGeocoderen(secGeleden(20 * 60), NU)).toBe(false);
  });
});

describe('draaiVangnet', () => {
  type Rij = Record<string, unknown>;
  function nepDb(leads: Rij[]) {
    const updates: Rij[] = [];
    const db = {
      from(tabel: string) {
        const b: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq', 'in', 'containedBy', 'or', 'gte', 'lte', 'order', 'limit']) b[m] = () => b;
        b.update = (u: Rij) => { updates.push(u); return { eq: async () => ({ error: null }) }; };
        const rijen = tabel === 'customer_batches'
          ? [{ branch: 'thuisbatterij', direct_leveren: null, customers: { direct_leveren: true, is_active: true } }]
          : leads;
        b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rijen, error: null }).then(ok);
        return b;
      },
    };
    return { db, updates };
  }
  const rij = (x: Rij): Rij => ({ ...lead({}), postcode: '3511AA', huisnummer: '1', plaatsnaam: 'Utrecht', provincie: 'Utrecht', lat: 52.09, lng: 5.12, land: 'NL', telefoonnummer: '0612345678', email: 'a@b.nl', ...x });

  beforeEach(() => { vi.mocked(distributeLead).mockReset(); vi.mocked(resolveAddress).mockReset(); });

  it('verdeelt een lead met coördinaten zonder opnieuw te geocoderen', async () => {
    vi.mocked(distributeLead).mockResolvedValue({ lead_id: 'a', assignments: [{ customer_id: 'k1', batch_id: 'b', distance_km: 1 }] });
    const { db } = nepDb([rij({ id: 'a' })]);
    const r = await draaiVangnet(db as never, { nu: NU });
    expect(r).toMatchObject({ kandidaten: 1, verdeeld: 1, geocodeerd: 0, uitgesteld: 0 });
    expect(resolveAddress).not.toHaveBeenCalled();
  });

  it('jonge lead zonder coördinaten: één keer geocoderen, dan verdelen', async () => {
    vi.mocked(resolveAddress).mockResolvedValue({ lat: 52.1, lng: 5.1, plaatsnaam: 'Utrecht', provincie: 'Utrecht', land: 'NL' } as never);
    vi.mocked(distributeLead).mockResolvedValue({ lead_id: 'a', assignments: [] });
    const { db, updates } = nepDb([rij({ id: 'a', lat: null, lng: null, created_at: secGeleden(60) })]);
    const r = await draaiVangnet(db as never, { nu: NU });
    expect(resolveAddress).toHaveBeenCalledTimes(1);
    expect(updates[0]).toMatchObject({ lat: 52.1, lng: 5.1 });
    expect(r.geocodeerd).toBe(1);
    expect(vi.mocked(distributeLead).mock.calls[0][0]).toMatchObject({ lat: 52.1, lng: 5.1 });
  });

  it('oudere lead zonder coördinaten: niet opnieuw geocoderen (wel verdelen op provincie)', async () => {
    vi.mocked(distributeLead).mockResolvedValue({ lead_id: 'a', assignments: [] });
    const { db } = nepDb([rij({ id: 'a', lat: null, lng: null, created_at: secGeleden(10 * 60 + 5) })]);
    await draaiVangnet(db as never, { nu: NU });
    expect(resolveAddress).not.toHaveBeenCalled();
    expect(distributeLead).toHaveBeenCalledTimes(1);
  });

  it('geocoder die blijft hangen houdt de ronde niet op', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.mocked(resolveAddress).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(distributeLead).mockResolvedValue({ lead_id: 'a', assignments: [] });
    const { db } = nepDb([rij({ id: 'a', lat: null, lng: null, provincie: '', created_at: secGeleden(60) })]);
    const p = draaiVangnet(db as never, { nu: NU });
    await vi.advanceTimersByTimeAsync(VANGNET_GEOCODE_TIMEOUT_MS + 10);
    const r = await p;
    vi.useRealTimers();
    expect(r.details[0]).toMatchObject({ lead_id: 'a', klant: null });
    expect(distributeLead).not.toHaveBeenCalled();
  });

  it('na de tijdslimiet geen nieuwe leads meer: die schuiven naar de volgende minuut', async () => {
    let t = 1_000_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => t);
    vi.mocked(distributeLead).mockImplementation(async () => { t += 20_000; return { lead_id: 'x', assignments: [] }; });
    const { db } = nepDb([rij({ id: 'a' }), rij({ id: 'b' }), rij({ id: 'c' })]);
    const r = await draaiVangnet(db as never, { nu: NU });
    spy.mockRestore();
    expect(distributeLead).toHaveBeenCalledTimes(2);
    expect(r.uitgesteld).toBe(1);
  });

  it('proefstand: verdeelt en geocodeert niets', async () => {
    const { db, updates } = nepDb([rij({ id: 'a', lat: null, lng: null })]);
    const r = await draaiVangnet(db as never, { nu: NU, proef: true });
    expect(r.kandidaten).toBe(1);
    expect(distributeLead).not.toHaveBeenCalled();
    expect(resolveAddress).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });
});
