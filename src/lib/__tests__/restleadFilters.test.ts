import { describe, it, expect } from 'vitest';
import { filterEnTel, type RestleadFilterItem, type RestleadFilterKeuze } from '../restleadFilters';

const GEEN: RestleadFilterKeuze = {
  branches: [], provincies: [], marge: null, bronnen: [], campagnes: [], uitgedeeldAan: [], kanNaar: [],
};

function item(over: Partial<RestleadFilterItem> = {}): RestleadFilterItem {
  return {
    branch: 'thuisbatterij', provincie: 'Utrecht', bron: 'zapier', meta_campaign_id: null,
    lat: 52.09, lng: 5.12, klanten: [], kandidaten: [],
    ...over,
  };
}

const ITEMS = [
  item({ branch: 'thuisbatterij', provincie: 'Utrecht', klanten: ['eco'], kandidaten: ['smart'] }),
  item({ branch: 'thuisbatterij', provincie: 'Zuid-Holland', kandidaten: ['eco', 'smart'] }),
  item({ branch: 'zonnepanelen', provincie: 'Utrecht', bron: 'handmatig', kandidaten: [] }),
];

describe('filterEnTel', () => {
  it('laat zonder keuze alles door en telt alles', () => {
    const { over, facetten } = filterEnTel(ITEMS, i => i, GEEN);
    expect(over).toHaveLength(3);
    expect(facetten.branch).toEqual({ thuisbatterij: 2, zonnepanelen: 1 });
    expect(facetten.kan_naar).toEqual({ smart: 2, eco: 1 });
  });

  it('filtert op meerdere branches tegelijk', () => {
    const { over } = filterEnTel(ITEMS, i => i, { ...GEEN, branches: ['thuisbatterij', 'zonnepanelen'] });
    expect(over).toHaveLength(3);
  });

  it('telt de eigen groep over alle andere filters, niet over zichzelf', () => {
    /* Kies je thuisbatterij, dan moet zonnepanelen zijn eigen aantal blijven
       tonen; anders staat er een nul en weet je niet wat aanvinken oplevert. */
    const { over, facetten } = filterEnTel(ITEMS, i => i, { ...GEEN, branches: ['thuisbatterij'] });
    expect(over).toHaveLength(2);
    expect(facetten.branch).toEqual({ thuisbatterij: 2, zonnepanelen: 1 });
    /* De andere groepen tellen wél alleen wat na de branchekeuze overblijft. */
    expect(facetten.province).toEqual({ Utrecht: 1, 'Zuid-Holland': 1 });
  });

  it('combineert groepen als EN, en opties binnen een groep als OF', () => {
    const { over } = filterEnTel(ITEMS, i => i, { ...GEEN, branches: ['thuisbatterij'], provincies: ['Utrecht'] });
    expect(over).toHaveLength(1);
  });

  it('filtert op de klant bij wie de lead al staat', () => {
    const { over } = filterEnTel(ITEMS, i => i, { ...GEEN, uitgedeeldAan: ['eco'] });
    expect(over).toHaveLength(1);
    expect(over[0].klanten).toContain('eco');
  });

  it('filtert op de klant naar wie de lead nog kan', () => {
    const { over } = filterEnTel(ITEMS, i => i, { ...GEEN, kanNaar: ['eco'] });
    expect(over).toHaveLength(1);
    expect(over[0].provincie).toBe('Zuid-Holland');
  });

  it('filtert op bron en campagne', () => {
    expect(filterEnTel(ITEMS, i => i, { ...GEEN, bronnen: ['handmatig'] }).over).toHaveLength(1);
    const metCampagne = [...ITEMS, item({ meta_campaign_id: 'c1' })];
    expect(filterEnTel(metCampagne, i => i, { ...GEEN, campagnes: ['c1'] }).over).toHaveLength(1);
  });

  it('laat een lead zonder provincie buiten een provinciefilter zonder marge', () => {
    const { over } = filterEnTel([item({ provincie: null })], i => i, { ...GEEN, provincies: ['Utrecht'] });
    expect(over).toHaveLength(0);
  });
});
