import { describe, it, expect } from 'vitest';
import { isInboundLeadBranchSlug, NICHE_RESEARCH_SYSTEM_BRANCH } from '../nicheResearch';
import { isNicheResearchBatchKind } from '../batchKind';

describe('niche research branch routing', () => {
  it('treats system branch as non-inbound', () => {
    expect(isInboundLeadBranchSlug(NICHE_RESEARCH_SYSTEM_BRANCH)).toBe(false);
    expect(isInboundLeadBranchSlug('')).toBe(false);
    expect(isInboundLeadBranchSlug(null)).toBe(false);
  });

  it('accepts real lead branches for inbound routing', () => {
    expect(isInboundLeadBranchSlug('detailing_onderhoud')).toBe(true);
    expect(isInboundLeadBranchSlug('thuisbatterij')).toBe(true);
  });

  it('identifies niche_research batch kind', () => {
    expect(isNicheResearchBatchKind('niche_research')).toBe(true);
    expect(isNicheResearchBatchKind('leads')).toBe(false);
    expect(isNicheResearchBatchKind(null)).toBe(false);
  });
});
