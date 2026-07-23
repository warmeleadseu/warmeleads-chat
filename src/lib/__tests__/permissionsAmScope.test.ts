import { describe, expect, it } from 'vitest';
import {
  ALL_ACCOUNT_MANAGERS,
  amCustomerAccessOrFilter,
  customerVisibleToAm,
  normalizeCustomerAmAssignment,
} from '../permissions';

describe('amCustomerAccessOrFilter', () => {
  it('includes own AM and shared flag', () => {
    expect(amCustomerAccessOrFilter('am-1')).toBe(
      'account_manager_id.eq.am-1,shared_with_all_ams.eq.true',
    );
  });
});

describe('customerVisibleToAm', () => {
  it('allows own assignment and shared customers', () => {
    expect(customerVisibleToAm({ account_manager_id: 'am-1' }, 'am-1')).toBe(true);
    expect(customerVisibleToAm({ account_manager_id: 'am-2' }, 'am-1')).toBe(false);
    expect(customerVisibleToAm({ account_manager_id: null, shared_with_all_ams: true }, 'am-1')).toBe(true);
  });
});

describe('normalizeCustomerAmAssignment', () => {
  it('maps __all__ sentinel to shared flag', () => {
    const updates: Record<string, unknown> = { account_manager_id: ALL_ACCOUNT_MANAGERS };
    normalizeCustomerAmAssignment(updates);
    expect(updates).toEqual({ account_manager_id: null, shared_with_all_ams: true });
  });

  it('clears shared when assigning a specific AM', () => {
    const updates: Record<string, unknown> = { account_manager_id: 'am-9' };
    normalizeCustomerAmAssignment(updates);
    expect(updates).toEqual({ account_manager_id: 'am-9', shared_with_all_ams: false });
  });
});
