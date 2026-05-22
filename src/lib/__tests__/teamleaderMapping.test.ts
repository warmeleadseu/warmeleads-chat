import { describe, expect, it } from 'vitest';
import {
  buildDealSummary,
  formatDealTitle,
  normalizePhone,
  splitContactName,
} from '@/lib/teamleader/mapping';
import { DEFAULT_DEAL_TITLE_TEMPLATE } from '@/lib/teamleader/config';

describe('splitContactName', () => {
  it('splits voornaam and achternaam', () => {
    expect(splitContactName('Jan de Vries')).toEqual({
      firstName: 'Jan de',
      lastName: 'Vries',
    });
  });

  it('handles single name', () => {
    expect(splitContactName('Madonna')).toEqual({
      firstName: 'Madonna',
      lastName: '-',
    });
  });

  it('handles empty', () => {
    expect(splitContactName('')).toEqual({
      firstName: 'Onbekend',
      lastName: '-',
    });
  });
});

describe('formatDealTitle', () => {
  it('uses default template', () => {
    const title = formatDealTitle(undefined, {
      branch_name: 'Zonnepanelen',
      naam_klant: 'Piet Jansen',
      branch: 'zonnepanelen',
    });
    expect(title).toBe(
      DEFAULT_DEAL_TITLE_TEMPLATE.replace('{branch_name}', 'Zonnepanelen').replace(
        '{naam_klant}',
        'Piet Jansen',
      ),
    );
  });

  it('replaces custom template placeholders', () => {
    expect(
      formatDealTitle('{naam_klant} — {branch}', {
        branch_name: 'X',
        naam_klant: 'Anna',
        branch: 'warmtepomp',
      }),
    ).toBe('Anna — warmtepomp');
  });
});

describe('normalizePhone', () => {
  it('rejects short numbers', () => {
    expect(normalizePhone('123')).toBeUndefined();
  });

  it('accepts valid phone', () => {
    expect(normalizePhone('0612345678')).toBe('0612345678');
  });
});

describe('buildDealSummary', () => {
  it('includes assignment and lead ids', () => {
    const summary = buildDealSummary(
      { email: 'a@b.nl', custom_fields: { daktype: 'plat' } },
      'assign-1',
      'lead-1',
    );
    expect(summary).toContain('assign-1');
    expect(summary).toContain('lead-1');
    expect(summary).toContain('daktype');
  });
});
