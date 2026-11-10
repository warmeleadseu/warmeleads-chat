import { describe, expect, it } from 'vitest';
import { bouwLekMail, zoekLekken, type SpendRij } from '../metaLekken';

const rij = (ad: string, spend: number, leads: number, extra: Partial<SpendRij> = {}): SpendRij => ({
  ad_id: ad, ad_name: `Ad ${ad}`, campaign_id: `c${ad}`, campaign_name: 'Thuisbatterij | Energiekompas - Enschede',
  date: '2026-11-09', spend, leads_count: leads, ...extra,
});

describe('zoekLekken', () => {
  it('meldt een advertentie met uitgaven en Meta-leads maar niets bij ons', () => {
    const l = zoekLekken([rij('1', 60, 2), rij('1', 57.34, 2, { date: '2026-11-10' })], new Map());
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ ad_id: '1', uitgaven: 117.34, metaLeads: 4, laatsteDag: '2026-11-10' });
  });

  it('meldt niets zodra er één lead binnenkwam', () => {
    expect(zoekLekken([rij('1', 100, 5)], new Map([['1', 1]]))).toEqual([]);
  });

  it('negeert kleine aantallen en kleine bedragen', () => {
    expect(zoekLekken([rij('1', 100, 2)], new Map())).toEqual([]);
    expect(zoekLekken([rij('1', 10, 5)], new Map())).toEqual([]);
  });

  it('negeert campagnes van PakketAdvies en energie, maar niet Energiekompas', () => {
    expect(zoekLekken([rij('1', 250, 27, { campaign_name: 'PakketAdvies | Energie leads' })], new Map())).toEqual([]);
    expect(zoekLekken([rij('2', 50, 3)], new Map())).toHaveLength(1);
  });

  it('sorteert op uitgaven en slaat regels zonder advertentie over', () => {
    const l = zoekLekken([rij('a', 30, 3), rij('b', 90, 3), rij('', 500, 9, { ad_id: null })], new Map());
    expect(l.map(x => x.ad_id)).toEqual(['b', 'a']);
  });
});

describe('bouwLekMail', () => {
  it('escapet namen en noemt totaal', () => {
    const { onderwerp, html } = bouwLekMail(zoekLekken([rij('1', 100, 4, { campaign_name: 'A <b>' })], new Map()), '2026-11-07');
    expect(onderwerp).toContain('A <b>');
    expect(html).toContain('A &lt;b&gt;');
    expect(html).not.toContain('A <b>');
    expect(html).toContain('4 leads');
  });
});
