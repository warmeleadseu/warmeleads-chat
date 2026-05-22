import { describe, expect, it } from 'vitest';
import {
  branchesChanged,
  normalizeCustomerBranchSlugs,
} from '../customerBranches';

describe('normalizeCustomerBranchSlugs', () => {
  it('trims and deduplicates', () => {
    expect(normalizeCustomerBranchSlugs([' zonnepanelen ', 'zonnepanelen', 'airco', ''])).toEqual([
      'zonnepanelen',
      'airco',
    ]);
  });

  it('returns empty for non-arrays', () => {
    expect(normalizeCustomerBranchSlugs(null)).toEqual([]);
    expect(normalizeCustomerBranchSlugs('zonnepanelen')).toEqual([]);
  });
});

describe('branchesChanged', () => {
  it('detects add/remove regardless of order', () => {
    expect(branchesChanged(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(branchesChanged(['a'], ['a', 'b'])).toBe(true);
    expect(branchesChanged(['a', 'b'], ['a'])).toBe(true);
  });
});
