import { describe, expect, it } from 'vitest';
import { PROVINCES_BE, PROVINCES_NL } from './provinces';

describe('provinces', () => {
  it('includes Belgian Limburg alongside Dutch Limburg in separate lists', () => {
    expect(PROVINCES_BE).toContain('Limburg');
    expect(PROVINCES_NL).toContain('Limburg');
  });

  it('lists all 11 Belgian provinces used in CRM', () => {
    expect(PROVINCES_BE).toHaveLength(11);
  });
});
