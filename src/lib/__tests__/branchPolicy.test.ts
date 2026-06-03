import { describe, expect, it } from 'vitest';
import {
  isPartnerBranch,
  isNicheResearchSystemBranch,
  isSellableLeadBranch,
} from '../branchPolicy';

const baseBranch = (slug: string, overrides: Partial<{ is_active: boolean; is_partner_branch: boolean }> = {}) => ({
  slug,
  is_active: true,
  is_partner_branch: false,
  ...overrides,
});

describe('branchPolicy', () => {
  describe('isPartnerBranch', () => {
    it('detecteert partner via DB-flag', () => {
      expect(isPartnerBranch(baseBranch('foo', { is_partner_branch: true }))).toBe(true);
    });

    it('detecteert hardcoded partner-slugs zonder DB-flag', () => {
      expect(isPartnerBranch(baseBranch('thuisbatterij_partners'))).toBe(true);
      expect(isPartnerBranch(baseBranch('airco_partners'))).toBe(true);
      expect(isPartnerBranch(baseBranch('nei_begun_partners'))).toBe(true);
    });

    it('false voor reguliere branches', () => {
      expect(isPartnerBranch(baseBranch('thuisbatterij'))).toBe(false);
      expect(isPartnerBranch(baseBranch('airco'))).toBe(false);
      expect(isPartnerBranch(baseBranch('badkamer'))).toBe(false);
    });
  });

  describe('isNicheResearchSystemBranch', () => {
    it('herkent niche_research', () => {
      expect(isNicheResearchSystemBranch(baseBranch('niche_research'))).toBe(true);
      expect(isNicheResearchSystemBranch(baseBranch('thuisbatterij'))).toBe(false);
    });
  });

  describe('isSellableLeadBranch', () => {
    it('true voor actieve reguliere branche', () => {
      expect(isSellableLeadBranch(baseBranch('badkamer'))).toBe(true);
    });

    it('false voor inactieve branche', () => {
      expect(isSellableLeadBranch(baseBranch('badkamer', { is_active: false }))).toBe(false);
    });

    it('false voor partner-branche (via DB-flag)', () => {
      expect(
        isSellableLeadBranch(baseBranch('foo', { is_partner_branch: true })),
      ).toBe(false);
    });

    it('false voor partner-branche (via hardcoded slug)', () => {
      expect(isSellableLeadBranch(baseBranch('airco_partners'))).toBe(false);
      expect(isSellableLeadBranch(baseBranch('thuisbatterij_partners'))).toBe(false);
    });

    it('false voor niche_research systeem-branche', () => {
      expect(isSellableLeadBranch(baseBranch('niche_research'))).toBe(false);
    });
  });
});
