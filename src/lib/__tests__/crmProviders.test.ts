import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_CRM_IDS,
  getCrmProvider,
  isCrmProviderAvailable,
} from '@/lib/integrations/crmProviders';

describe('crmProviders', () => {
  it('only teamleader is available', () => {
    expect(AVAILABLE_CRM_IDS).toEqual(['teamleader']);
    expect(isCrmProviderAvailable('teamleader')).toBe(true);
    expect(isCrmProviderAvailable('hubspot')).toBe(false);
  });

  it('resolves provider by id', () => {
    expect(getCrmProvider('teamleader')?.name).toBe('Teamleader Focus');
    expect(getCrmProvider('unknown')).toBeUndefined();
  });
});
