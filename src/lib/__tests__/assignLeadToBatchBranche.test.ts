import { describe, expect, it, vi } from 'vitest';

vi.mock('../batchSync', () => ({ syncBatchDelivered: vi.fn(() => Promise.resolve()) }));
vi.mock('../integrations/onLeadAssigned', () => ({ onLeadAssignedToCustomer: vi.fn() }));

import { assignLeadToBatch } from '../assignLeadToBatch';

/**
 * Branche: een batch in de branche van de lead telt als bewijs, ook als de
 * klantkaart die branche niet noemt (Energiekompas had alleen warmtepomp op
 * de kaart en een thuisbatterij-batch; directe leveringen gingen door, de
 * wachtrij weigerde ze).
 */
function nepDb(
  batch: { branch: string; lead_branch_slug?: string | null } | null,
  anderen: { customer_id: string }[] = [],
  klanten: { id: string; name: string; exclude_customers: string[] }[] = [],
) {
  const inserts: unknown[] = [];
  const leeg = () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) });
  const db = {
    from(tabel: string) {
      if (tabel === 'customer_batches') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: batch }) }) }) };
      }
      if (tabel === 'customer_targets') return { select: leeg };
      if (tabel === 'lead_assignments') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ gte: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }),
            in: () => ({ neq: () => ({ neq: () => Promise.resolve({ data: anderen.map(a => ({ lead_id: 'l1', ...a })), error: null }) }) }),
          }),
          insert: (rij: unknown) => {
            inserts.push(rij);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'a1' }, error: null }) }) };
          },
        };
      }
      if (tabel === 'customers') return { select: () => ({ in: () => Promise.resolve({ data: klanten, error: null }) }) };
      if (tabel === 'leads') return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
      throw new Error(`onverwachte tabel ${tabel}`);
    },
  };
  return { db, inserts };
}

const LEAD = { id: 'l1', branch: 'thuisbatterij', lat: 52.2, lng: 6.9 };
const KLANT = { id: 'k1', branches: ['warmtepomp'] };

describe('assignLeadToBatch: branche', () => {
  it('batch in de branche van de lead: geleverd, ook als de klantkaart hem niet noemt', async () => {
    const { db, inserts } = nepDb({ branch: 'thuisbatterij' });
    const r = await assignLeadToBatch({ supabase: db as never, lead: LEAD as never, customer: KLANT, batchId: 'b1', source: 'distribution' });
    expect(r.ok).toBe(true);
    expect(inserts).toHaveLength(1);
  });

  it('batch in een andere branche: klantkaart beslist en weigert', async () => {
    const { db, inserts } = nepDb({ branch: 'warmtepomp' });
    const r = await assignLeadToBatch({ supabase: db as never, lead: LEAD as never, customer: KLANT, batchId: 'b1', source: 'distribution' });
    expect(r).toMatchObject({ ok: false, code: 'branch_mismatch' });
    expect(inserts).toHaveLength(0);
  });

  it('uitsluiting: lead staat al bij een klant die deze klant uitsluit (beide kanten op)', async () => {
    const k = (uitK1: boolean) => [
      { id: 'k1', name: 'Klant Een', exclude_customers: uitK1 ? ['k2'] : [] },
      { id: 'k2', name: 'Concurrent', exclude_customers: uitK1 ? [] : ['k1'] },
    ];
    for (const uitK1 of [true, false]) {
      const { db, inserts } = nepDb({ branch: 'thuisbatterij' }, [{ customer_id: 'k2' }], k(uitK1));
      const r = await assignLeadToBatch({ supabase: db as never, lead: LEAD as never, customer: KLANT, batchId: 'b1', source: 'distribution' });
      expect(r).toMatchObject({ ok: false, code: 'uitsluiting' });
      expect(inserts).toHaveLength(0);
    }
  });

  it('uitsluiting telt niet voor de klant van wie de lead wordt verplaatst', async () => {
    const { db, inserts } = nepDb({ branch: 'thuisbatterij' }, [{ customer_id: 'k2' }], [
      { id: 'k1', name: 'Klant Een', exclude_customers: ['k2'] },
      { id: 'k2', name: 'Concurrent', exclude_customers: [] },
    ]);
    const r = await assignLeadToBatch({ supabase: db as never, lead: LEAD as never, customer: KLANT, batchId: 'b1', source: 'bulk_assign', negeerKlanten: ['k2'] });
    expect(r.ok).toBe(true);
    expect(inserts).toHaveLength(1);
  });

  it('zonder batch: klantkaart beslist', async () => {
    const { db } = nepDb(null);
    const r = await assignLeadToBatch({ supabase: db as never, lead: LEAD as never, customer: KLANT, source: 'distribution' });
    expect(r).toMatchObject({ ok: false, code: 'branch_mismatch' });
  });
});
