import { describe, expect, it } from 'vitest';
import {
  isReclamationBlockedForBatchKind,
  NICHE_RESEARCH_RECLAMATION_BLOCK_MESSAGE,
} from '../reclamationEligibility';

describe('isReclamationBlockedForBatchKind', () => {
  it('blokkeert niche_research batches', () => {
    expect(isReclamationBlockedForBatchKind('niche_research')).toBe(true);
  });

  it('staat normale pipeline- en bulk-batches toe', () => {
    expect(isReclamationBlockedForBatchKind('leads')).toBe(false);
    expect(isReclamationBlockedForBatchKind('bulk_leads')).toBe(false);
    expect(isReclamationBlockedForBatchKind(null)).toBe(false);
    expect(isReclamationBlockedForBatchKind(undefined)).toBe(false);
  });
});

describe('NICHE_RESEARCH_RECLAMATION_BLOCK_MESSAGE', () => {
  it('is een duidelijke NL-tekst', () => {
    expect(NICHE_RESEARCH_RECLAMATION_BLOCK_MESSAGE).toMatch(/niche-onderzoek/i);
  });
});
