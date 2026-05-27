import { describe, expect, it } from 'vitest';
import {
  PARTNER_PROSPECT_BRANCH_SLUGS,
  isPartnerProspectBranchSlug,
  normalizePartnerProspectBranchSlug,
} from '@/lib/partnerProspectConstants';
import {
  buildPartnerProspectInsertRow,
  isPartnerProspectBranch,
} from '@/lib/partnerProspectIngest';

describe('partner prospect branches', () => {
  it('recognizes all configured partner branches', () => {
    for (const slug of PARTNER_PROSPECT_BRANCH_SLUGS) {
      expect(isPartnerProspectBranch(slug)).toBe(true);
      expect(isPartnerProspectBranchSlug(slug)).toBe(true);
      expect(normalizePartnerProspectBranchSlug(slug)).toBe(slug);
    }
    expect(isPartnerProspectBranch('airco')).toBe(false);
    expect(isPartnerProspectBranch('thuisbatterij')).toBe(false);
  });
});

describe('buildPartnerProspectInsertRow', () => {
  it('tags airco_partners on branches and source_metadata', () => {
    const row = buildPartnerProspectInsertRow(
      'airco_partners',
      { naam_klant: 'Test BV', email: 'a@b.nl' },
      { budget: '5000' },
      null,
      '64cad239-1eaf-497e-9c2b-d2ea60cb0512',
    );
    expect(row.branches).toEqual(['airco_partners']);
    expect((row.source_metadata as { partner_branch: string }).partner_branch).toBe('airco_partners');
    expect(row.source).toBe('meta_partner');
  });
});
