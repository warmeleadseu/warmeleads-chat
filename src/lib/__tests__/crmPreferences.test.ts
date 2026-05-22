import { describe, expect, it, vi } from 'vitest';
import {
  CRM_PREFERENCE_PROVIDER,
  getPreferredCrmProvider,
  setPreferredCrmProvider,
} from '@/lib/integrations/crmPreferences';

describe('crmPreferences', () => {
  it('reads preferred provider from customer_integrations', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { settings: { preferred_crm_provider: 'teamleader' } },
                error: null,
              }),
            })),
          })),
        })),
      })),
    };

    const result = await getPreferredCrmProvider(supabase as never, 'cust-1');
    expect(result).toBe('teamleader');
  });

  it('upserts preference row with crm_preference provider', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({ upsert })),
    };

    await setPreferredCrmProvider(supabase as never, 'cust-1', 'teamleader');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 'cust-1',
        provider: CRM_PREFERENCE_PROVIDER,
        settings: { preferred_crm_provider: 'teamleader' },
      }),
      { onConflict: 'customer_id,provider' },
    );
  });
});
