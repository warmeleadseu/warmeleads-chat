import { describe, expect, it } from 'vitest';
import type { createServerClient } from '@/lib/supabase';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '../demoPortalEligibility';

/** Nep-Supabase die per tabel een vast aantal teruggeeft. */
function nepDb(aantallen: Record<string, number>) {
  return {
    from(tabel: string) {
      const keten: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq']) keten[m] = () => keten;
      keten.then = (ok: (v: unknown) => unknown) => Promise.resolve({ count: aantallen[tabel] ?? 0, error: null }).then(ok);
      return keten;
    },
  } as unknown as ReturnType<typeof createServerClient>;
}

describe('getHasPaidCustomerBatch', () => {
  it('alleen een betaalde afspraakbatch: echte klant (RJ CV Optimalisatie)', async () => {
    expect(await getHasPaidCustomerBatch(nepDb({ appointment_batches: 1 }), 'k')).toBe(true);
  });
  it('betaalde leadbatch: echte klant', async () => {
    expect(await getHasPaidCustomerBatch(nepDb({ customer_batches: 1 }), 'k')).toBe(true);
  });
  it('echte toewijzing: echte klant', async () => {
    expect(await getHasPaidCustomerBatch(nepDb({ lead_assignments: 3 }), 'k')).toBe(true);
  });
  it('niets betaald en alleen demo: demoportaal', async () => {
    const echt = await getHasPaidCustomerBatch(nepDb({}), 'k');
    expect(echt).toBe(false);
    expect(shouldUseDemoPortalExperience({ hasPaidCustomerBatch: echt })).toBe(true);
  });
});
