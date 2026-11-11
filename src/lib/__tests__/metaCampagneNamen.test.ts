import { describe, expect, it } from 'vitest';
import { laadOpgeslagenCampagneNamen } from '../metaCampagneNamen';
import { behoudCampagneNamen, mergeMetaCampaignLookupNames } from '../metaCampaignIds';

function nepClient(namen: Record<string, string | null>, kapot: string[] = []) {
  return {
    from: () => {
      let id = '';
      const q = {
        select: () => q,
        eq: (_c: string, v: string) => { id = v; return q; },
        not: () => q,
        order: () => q,
        limit: async () => {
          if (kapot.includes(id)) throw new Error('storing');
          return { data: namen[id] ? [{ campaign_name: namen[id] }] : [], error: null };
        },
      };
      return q;
    },
  };
}

describe('laatst bekende campagnenamen uit onze eigen data', () => {
  it('geeft de naam per campagne, en slaat onbekende en kapotte over', async () => {
    const namen = await laadOpgeslagenCampagneNamen(nepClient({ '1': 'Thuisbatterij NL', '2': null, '3': 'X' }, ['3']), ['1', '2', '3']);
    expect([...namen.entries()]).toEqual([['1', 'Thuisbatterij NL']]);
  });
});

describe('namen vasthouden in het scherm', () => {
  it('na opslaan of verversen blijven de opgehaalde namen staan', () => {
    const vorige = [{ id: '1', name: 'Zonnepanelen' }, { id: '2', name: '2' }];
    const nieuw = [{ id: '1', name: '1', exclusief: 'altijd' as const }, { id: '2', name: '2' }, { id: '3', name: '3' }];
    expect(behoudCampagneNamen(nieuw, vorige)).toEqual([
      { id: '1', name: 'Zonnepanelen', exclusief: 'altijd' },
      { id: '2', name: '2' },
      { id: '3', name: '3' },
    ]);
  });

  it('een mislukte lookup overschrijft een bekende naam niet met het nummer', () => {
    const out = mergeMetaCampaignLookupNames(['1', '2'], [{ id: '1', name: '1' }, { id: '2', name: 'Nieuw' }], [{ id: '1', name: 'Oud' }]);
    expect(out.map(p => p.name)).toEqual(['Oud', 'Nieuw']);
  });
});
