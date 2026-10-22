import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * De keuze "met spoed" staat op de batch (lookback_levering) en geldt voor de
 * eerstvolgende lookback, ook als die pas bij de betaling loopt. Daarna valt
 * hij terug op gefaseerd.
 */

const wachtrij = vi.fn(async (_db: unknown, rijen: unknown[]) => ({ gepland: rijen.length, fout: null }));
const verwerk = vi.fn(async () => ({ bekeken: 0, geleverd: 0, overgeslagen: 0 }));
vi.mock('../wachtrijPlannen', () => ({ zetInWachtrij: (...a: [unknown, unknown[]]) => wachtrij(...a) }));
vi.mock('../geplandeLeveringen', () => ({ verwerkGeplandeLeveringen: (...a: unknown[]) => verwerk(...(a as [])) }));
vi.mock('../batchTargets', () => ({ fetchActiveBatchTargetsByBatch: vi.fn(async () => new Map()) }));
vi.mock('../masterPortalMirror', () => ({ MIRROR_ASSIGNMENT_SOURCE: 'mirror', MASTER_PORTAL_MIRROR_BY_BRANCH: {}, mirrorLeadToMasterPortal: vi.fn() }));

let batchRij: Record<string, unknown>;
const updates: Record<string, unknown>[] = [];
const leads = [0, 1, 2].map(i => ({
  id: `l${i}`, branch: 'thuisbatterij', lat: 52.09, lng: 5.12, provincie: 'Utrecht', land: 'NL', bron: 'zapier', phone_valid: true,
  created_at: new Date(Date.now() - (i + 1) * 86_400_000 / 2).toISOString(),
}));

vi.mock('../supabase', () => ({
  createServerClient: () => ({
    from(tabel: string) {
      const b: Record<string, unknown> = {};
      const data = (): unknown => {
        if (tabel === 'customer_batches') return [batchRij];
        if (tabel === 'customer_targets') return [{ customer_id: 'k', target_type: 'radius', lat: 52.09, lng: 5.12, radius_km: 30, marge_km: 0, is_active: true, country: 'NL' }];
        if (tabel === 'customers') return [{ exclude_customers: [] }];
        if (tabel === 'leads') return leads;
        return [];
      };
      for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'order', 'limit', 'not', 'contains', 'range', 'or', 'is']) b[m] = () => b;
      b.update = (u: Record<string, unknown>) => { updates.push({ tabel, ...u }); return b; };
      b.single = async () => ({ data: (data() as unknown[])[0] ?? null, error: null });
      b.maybeSingle = b.single;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: data(), error: null, count: 0 }).then(ok);
      return b;
    },
  }),
}));

import { backfillBatch } from '../distribution';

const basis = {
  id: 'b', customer_id: 'k', branch: 'thuisbatterij', batch_size: 100, leads_delivered: 0, leads_delivered_external: 0,
  leads_per_week: null, leads_per_day: null, lead_filters: [], is_paid: true, starts_at: null,
  created_at: new Date().toISOString(), distribution_priority: false, direct_leveren: null, batch_kind: 'leads',
  delivery_model: 'capped', lookback_days: 3, customers: { id: 'k', is_active: true, direct_leveren: false },
};

beforeEach(() => { wachtrij.mockClear(); verwerk.mockClear(); updates.length = 0; });

describe('lookback-levering op de batch', () => {
  it('standaard gefaseerd: verspreid, niets teruggezet, niets meteen afgeleverd', async () => {
    batchRij = { ...basis, lookback_levering: 'gefaseerd' };
    const voor = Date.now();
    await backfillBatch('b', 3);
    const rijen = wachtrij.mock.calls[0][1] as { gepland_voor: string; aangemaakt_door: string }[];
    expect(rijen).toHaveLength(3);
    expect(rijen.every(r => r.aangemaakt_door === 'inhaalslag')).toBe(true);
    expect(rijen.some(r => new Date(r.gepland_voor).getTime() > voor + 60_000)).toBe(true);
    expect(updates.filter(u => u.tabel === 'customer_batches')).toHaveLength(0);
    expect(verwerk).not.toHaveBeenCalled();
  });

  it('spoed op de batch (bijvoorbeeld bij de betaling): alles nu, keuze teruggezet, wachtrij levert (geen inline levering)', async () => {
    batchRij = { ...basis, lookback_levering: 'spoed' };
    const voor = Date.now();
    await backfillBatch('b', 3);
    const rijen = wachtrij.mock.calls[0][1] as { gepland_voor: string; aangemaakt_door: string; reden: string }[];
    expect(rijen.every(r => r.aangemaakt_door === 'inhaalslag-spoed')).toBe(true);
    expect(rijen.every(r => new Date(r.gepland_voor).getTime() <= voor + 5_000)).toBe(true);
    expect(rijen[0].reden).toMatch(/met spoed/);
    expect(updates).toContainEqual({ tabel: 'customer_batches', lookback_levering: 'gefaseerd' });
    expect(verwerk).not.toHaveBeenCalled();
  });

  it('vanuit het beheerscherm met spoed: meteen afleveren voor deze batch', async () => {
    batchRij = { ...basis, lookback_levering: 'spoed' };
    await backfillBatch('b', 3, { meteenAfleveren: true });
    expect(verwerk).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ batchId: 'b' }));
  });

  it('batch die nog niet mag starten: keuze blijft bewaard', async () => {
    batchRij = { ...basis, lookback_levering: 'spoed', starts_at: new Date(Date.now() + 86_400_000).toISOString() };
    await backfillBatch('b', 3);
    expect(wachtrij).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });
});
