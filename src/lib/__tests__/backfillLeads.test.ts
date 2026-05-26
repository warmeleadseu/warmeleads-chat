import { describe, expect, it } from 'vitest';
import { MAX_BACKFILL_LEADS } from '@/lib/integrations/backfillLeads';

describe('backfillLeads constants', () => {
  it('limits batch size', () => {
    expect(MAX_BACKFILL_LEADS).toBeGreaterThan(0);
    expect(MAX_BACKFILL_LEADS).toBeLessThanOrEqual(100);
  });
});
