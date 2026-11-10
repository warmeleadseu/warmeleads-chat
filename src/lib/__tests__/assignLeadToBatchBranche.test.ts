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
function nepDb(batch: { branch: string; lead_branch_slug?: string | null } | null) {
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
          select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }) }),
          insert: (rij: unknown) => {
            inserts.push(rij);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'a1' }, error: null }) }) };
          },
        };
      }
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

  it('zonder batch: klantkaart beslist', async () => {
    const { db } = nepDb(null);
    const r = await assignLeadToBatch({ supabase: db as never, lead: LEAD as never, customer: KLANT, source: 'distribution' });
    expect(r).toMatchObject({ ok: false, code: 'branch_mismatch' });
  });
});
