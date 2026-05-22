import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_CRM_IDS,
  getCrmProvider,
  isCrmProviderAvailable,
} from '@/lib/integrations/crmProviders';

describe('crmProviders', () => {
  it('teamleader and google_sheets are available', () => {
    expect(AVAILABLE_CRM_IDS).toContain('teamleader');
    expect(AVAILABLE_CRM_IDS).toContain('google_sheets');
    expect(isCrmProviderAvailable('hubspot')).toBe(false);
  });

  it('resolves provider by id', () => {
    expect(getCrmProvider('teamleader')?.name).toBe('Teamleader Focus');
    expect(getCrmProvider('unknown')).toBeUndefined();
  });
});
