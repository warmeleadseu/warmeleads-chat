import { describe, expect, it } from 'vitest';
import { zetInWachtrij, type WachtrijRij } from '../wachtrijPlannen';

function nepDb(bestaand: { id: string; lead_id: string; customer_id: string; status: string }[]) {
  const updates: { id: string; payload: Record<string, unknown> }[] = [];
  const upserts: Record<string, unknown>[] = [];
  const db = {
    from: () => ({
      select: () => ({ in: async () => ({ data: bestaand, error: null }) }),
      update: (payload: Record<string, unknown>) => ({
        eq: (_k: string, id: string) => ({ neq: async () => { updates.push({ id, payload }); return { error: null }; } }),
      }),
      upsert: (rows: Record<string, unknown>[]) => {
        upserts.push(...rows);
        return { select: async () => ({ data: rows.map((_, i) => ({ id: `n${i}` })), error: null }) };
      },
    }),
  };
  return { db, updates, upserts };
}

const rij = (lead: string, klant = 'k'): WachtrijRij => ({
  lead_id: lead, customer_id: klant, batch_id: 'b', gepland_voor: '2026-10-22T10:00:00Z',
  soort: 'spreiding', reden: 'test', aangemaakt_door: 'test', negeer_geo: true,
});

describe('zetInWachtrij', () => {
  it('nieuwe leads: ingepland', async () => {
    const { db, upserts } = nepDb([]);
    expect(await zetInWachtrij(db as never, [rij('a'), rij('b')])).toEqual({ gepland: 2, fout: null });
    expect(upserts.map(u => u.status)).toEqual(['gepland', 'gepland']);
  });
  it('een oude, overgeslagen rij voor dezelfde lead en klant blokkeert niet meer: die krijgt het nieuwe plan', async () => {
    const { db, updates, upserts } = nepDb([{ id: 'oud', lead_id: 'a', customer_id: 'k', status: 'overgeslagen' }]);
    expect(await zetInWachtrij(db as never, [rij('a')])).toEqual({ gepland: 1, fout: null });
    expect(upserts).toHaveLength(0);
    expect(updates[0]).toMatchObject({ id: 'oud', payload: { status: 'gepland', pogingen: 0, laatste_reden: null, gepland_voor: '2026-10-22T10:00:00Z' } });
  });
  it('staat al klaar of is al geleverd: niet opnieuw', async () => {
    const { db, updates, upserts } = nepDb([
      { id: '1', lead_id: 'a', customer_id: 'k', status: 'gepland' },
      { id: '2', lead_id: 'b', customer_id: 'k', status: 'geleverd' },
    ]);
    expect(await zetInWachtrij(db as never, [rij('a'), rij('b')])).toEqual({ gepland: 0, fout: null });
    expect(updates).toHaveLength(0);
    expect(upserts).toHaveLength(0);
  });
  it('niets te doen', async () => {
    expect(await zetInWachtrij(nepDb([]).db as never, [])).toEqual({ gepland: 0, fout: null });
  });
});
