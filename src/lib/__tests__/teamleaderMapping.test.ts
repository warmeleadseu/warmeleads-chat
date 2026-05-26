import { describe, expect, it } from 'vitest';
import {
  buildContactRemarks,
  buildDealSummary,
  buildTeamleaderContactAddresses,
  buildTeamleaderTelephones,
  formatDealTitle,
  normalizeNlPostcode,
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

  it('uses labeled extra fields when provided', () => {
    const summary = buildDealSummary(
      { email: 'a@b.nl' },
      'assign-1',
      'lead-1',
      { 'Type dak': 'Plat' },
    );
    expect(summary).toContain('Type dak');
    expect(summary).toContain('Plat');
  });
});

describe('normalizeNlPostcode', () => {
  it('formats Dutch postcode with space', () => {
    expect(normalizeNlPostcode('5611ab')).toBe('5611 AB');
  });
});

describe('buildTeamleaderContactAddresses', () => {
  it('includes postal_code, city and line_1 for Teamleader API', () => {
    const addresses = buildTeamleaderContactAddresses({
      postcode: '5611AB',
      huisnummer: '12',
      plaatsnaam: 'Eindhoven',
    });
    expect(addresses).toHaveLength(1);
    expect(addresses![0].address).toEqual({
      line_1: '12',
      postal_code: '5611 AB',
      city: 'Eindhoven',
      country: 'NL',
    });
  });

  it('returns undefined when no address parts', () => {
    expect(buildTeamleaderContactAddresses({})).toBeUndefined();
  });

  it('includes postal_code key when only city is known', () => {
    const addresses = buildTeamleaderContactAddresses({ plaatsnaam: 'Utrecht' });
    expect(addresses![0].address.postal_code).toBeNull();
    expect(addresses![0].address.city).toBe('Utrecht');
  });
});

describe('buildTeamleaderTelephones', () => {
  it('uses mobile type for Dutch mobile numbers', () => {
    expect(buildTeamleaderTelephones('+31612345678')).toEqual([
      { type: 'mobile', number: '+31612345678' },
    ]);
  });
});

describe('buildContactRemarks', () => {
  it('formats summary extras for contact background', () => {
    const remarks = buildContactRemarks(
      { notities: 'Bel terug na 17:00' },
      { Zonnepanelen: 'Ja', 'Dynamisch contract': 'Ja' },
    );
    expect(remarks).toContain('Bel terug na 17:00');
    expect(remarks).toContain('Zonnepanelen');
    expect(remarks).toContain('Dynamisch contract');
  });

  it('falls back to custom_fields when no extras', () => {
    const remarks = buildContactRemarks({
      custom_fields: { budget: '€10.000' },
    });
    expect(remarks).toContain('budget');
    expect(remarks).toContain('€10.000');
  });
});
