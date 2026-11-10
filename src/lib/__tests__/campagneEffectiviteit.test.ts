import { describe, expect, it } from 'vitest';
import {
  berekenCampagnes, berekenHerkomst, bestemmingVan, gekoppeldOp, signalen, type Context, type Koppeling, type Toewijzing,
} from '../campagneEffectiviteit';

const nu = new Date('2026-11-20T12:00:00Z');
const k = (over: Partial<Koppeling> = {}): Koppeling => ({ batch_id: 'B1', campaign_id: 'C1', van: '2026-11-01T00:00:00Z', tot: null, bron: 'wijziging', ...over });
const ctx = (over: Partial<Context> = {}): Context => ({
  koppelingen: [],
  toewijzingen: new Map(),
  klanten: new Map([
    ['K1', { naam: 'Klant Een', betaalt: true }],
    ['K2', { naam: 'Klant Twee', betaalt: true }],
    ['IS', { naam: 'Infinite Scale', betaalt: false }],
  ]),
  extraLeadsBatches: new Set(['EXTRA']),
  gepland: new Set(),
  nu,
  ...over,
});
const toew = (lead: string, ...t: [string, string | null][]): [string, Toewijzing[]] => [lead, t.map(([customer_id, batch_id]) => ({ lead_id: lead, customer_id, batch_id }))];
const lead = (id: string, created_at = '2026-11-10T10:00:00Z', phone_valid: boolean | null = true) => ({ id, campaign_id: 'C1', created_at, phone_valid });

describe('koppeling op het moment van binnenkomst', () => {
  it('van is inclusief, tot exclusief', () => {
    const kk = [k({ van: '2026-11-01T00:00:00Z', tot: '2026-11-10T00:00:00Z' })];
    expect(gekoppeldOp(kk, '2026-11-01T00:00:00Z')).toHaveLength(1);
    expect(gekoppeldOp(kk, '2026-11-09T23:59:59Z')).toHaveLength(1);
    expect(gekoppeldOp(kk, '2026-11-10T00:00:00Z')).toHaveLength(0);
    expect(gekoppeldOp(kk, '2026-10-31T23:59:59Z')).toHaveLength(0);
  });
  it('een ontkoppelde campagne telt voor leads van toen nog als eigen campagne', () => {
    const kk = [k({ tot: '2026-11-15T00:00:00Z' })];
    const c = ctx({ toewijzingen: new Map([toew('L1', ['K1', 'B1'])]) });
    expect(bestemmingVan(lead('L1', '2026-11-10T10:00:00Z'), kk, c).bestemming).toBe('gekoppeld');
    /* Na het ontkoppelen is dezelfde batch "een andere klant" voor deze campagne. */
    expect(bestemmingVan(lead('L1', '2026-11-16T10:00:00Z'), kk, c).bestemming).toBe('andere_klant');
  });
});

describe('bestemming van een lead', () => {
  const kk = [k()];
  it('volgorde: gekoppeld, extra leads, andere klant, intern', () => {
    const c = ctx({
      toewijzingen: new Map([
        toew('A', ['K2', 'B9'], ['K1', 'B1']),
        toew('B', ['K2', 'EXTRA']),
        toew('C', ['K2', 'B9'], ['IS', 'B8']),
        toew('D', ['IS', 'B8']),
      ]),
    });
    expect(['A', 'B', 'C', 'D'].map(id => bestemmingVan(lead(id), kk, c).bestemming)).toEqual(['gekoppeld', 'extra_leads', 'andere_klant', 'intern']);
  });
  it('zonder klant: wachtrij, te koop, of verloren (te oud of ongeldig nummer)', () => {
    const c = ctx({ gepland: new Set(['W']) });
    expect(bestemmingVan(lead('W'), kk, c).bestemming).toBe('wacht');
    expect(bestemmingVan(lead('T', '2026-11-15T10:00:00Z'), kk, c).bestemming).toBe('te_koop');
    expect(bestemmingVan(lead('O', '2026-11-05T10:00:00Z'), kk, c).bestemming).toBe('verloren');
    expect(bestemmingVan(lead('X', '2026-11-19T10:00:00Z', false), kk, c).bestemming).toBe('verloren');
  });
  it('een startstand-koppeling maakt het geschat', () => {
    const c = ctx({ toewijzingen: new Map([toew('L', ['K1', 'B1'])]) });
    expect(bestemmingVan(lead('L'), [k({ bron: 'startstand' })], c).geschat).toBe(true);
    expect(bestemmingVan(lead('L'), [k()], c).geschat).toBe(false);
  });
});

describe('campagne-overzicht', () => {
  const c = ctx({
    koppelingen: [k(), k({ campaign_id: 'C2', batch_id: 'B2' })],
    toewijzingen: new Map([toew('L1', ['K1', 'B1'], ['K2', 'B9']), toew('L2', ['K2', 'B9']), toew('L3', ['K1', 'B1'])]),
  });
  const rijen = berekenCampagnes({
    uitgaven: [
      { campaign_id: 'C1', naam: 'Thuisbatterij NL', spend: 60, meta_leads: 3 },
      { campaign_id: 'C1', naam: 'Thuisbatterij NL', spend: 30, meta_leads: 2 },
      { campaign_id: 'C9', naam: 'Pakketadvies energie', spend: 500, meta_leads: 50 },
    ],
    leads: [lead('L1'), lead('L2'), lead('L3'), lead('L4', '2026-11-18T10:00:00Z')],
    ctx: c,
    batchKlant: new Map([['B1', 'Klant Een'], ['B2', 'Klant Twee']]),
    van: '2026-11-01',
    tot: '2026-11-20',
  });
  const r = rijen.find(x => x.campaign_id === 'C1')!;
  it('telt Meta-leads, binnengekomen en bestemmingen', () => {
    expect(r.uitgaven).toBe(90);
    expect(r.meta_leads).toBe(5);
    expect(r.binnen).toBe(4);
    expect(r.binnen_pct).toBe(80);
    expect(r.per_bestemming).toMatchObject({ gekoppeld: 2, andere_klant: 1, te_koop: 1 });
    expect(r.leveringen).toBe(4);
    expect(r.gekoppeld_ook_elders).toBe(1);
    expect(r.gekoppeld_pct).toBe(50);
    expect(r.kosten_per_lead).toBe(22.5);
    expect(r.kosten_per_gekoppelde_lead).toBe(45);
    expect(r.gekoppeld_aan.map(g => g.klant)).toEqual(['Klant Een']);
    expect(r.per_klant).toEqual([{ klant: 'Klant Een', leads: 2, gekoppeld: true }, { klant: 'Klant Twee', leads: 2, gekoppeld: false }]);
  });
  it('energie- en pakketadviescampagnes doen niet mee', () => {
    expect(rijen.some(x => x.campaign_id === 'C9')).toBe(false);
  });
  it('een gekoppelde campagne zonder leads of uitgaven in de periode verschijnt niet', () => {
    expect(rijen.some(x => x.campaign_id === 'C2')).toBe(false);
  });
  it('signalen', () => {
    const basis = { ...r, binnen: 20, meta_leads: 40, binnen_pct: 50, gekoppeld_pct: 30, per_bestemming: { ...r.per_bestemming, te_koop: 4, verloren: 3 } };
    expect(signalen(basis).map(s => s.soort)).toEqual(['rood', 'oranje', 'oranje']);
    expect(signalen({ ...basis, gekoppeld_aan: [], gekoppeld_pct: null }).map(s => s.tekst)).toContain('Niet gekoppeld aan een batch');
  });
  it('partnerwerving zonder consumentenleads: geen signalen', () => {
    expect(signalen({ ...r, binnen: 0, meta_leads: 30, binnen_pct: 0, gekoppeld_aan: [], uitgaven: 100, partner_aanmeldingen: 12 })).toEqual([]);
  });
});

describe('herkomst van een batch', () => {
  it('eigen campagne op het moment van binnenkomst, andere campagnes en zonder campagne', () => {
    const h = berekenHerkomst({
      batchId: 'B1',
      geleverd: [
        { lead_id: 'L1', campaign_id: 'OUD', created_at: '2026-11-05T10:00:00Z' },
        { lead_id: 'L2', campaign_id: 'OUD', created_at: '2026-11-12T10:00:00Z' },
        { lead_id: 'L3', campaign_id: 'NIEUW', created_at: '2026-11-12T10:00:00Z' },
        { lead_id: 'L4', campaign_id: 'ANDER', created_at: '2026-11-12T10:00:00Z' },
        { lead_id: 'L5', campaign_id: null, created_at: '2026-11-12T10:00:00Z' },
      ],
      campagneLeads: new Map([
        ['OUD', [{ lead_id: 'L1', campaign_id: 'OUD', created_at: '2026-11-05T10:00:00Z' }, { lead_id: 'LX', campaign_id: 'OUD', created_at: '2026-11-06T10:00:00Z' }]],
        ['NIEUW', [{ lead_id: 'L3', campaign_id: 'NIEUW', created_at: '2026-11-12T10:00:00Z' }]],
      ]),
      koppelingen: [
        k({ campaign_id: 'OUD', van: '2026-11-01T00:00:00Z', tot: '2026-11-10T00:00:00Z' }),
        k({ campaign_id: 'NIEUW', van: '2026-11-10T00:00:00Z' }),
        k({ campaign_id: 'ELDERS', batch_id: 'B2' }),
      ],
      uitgavenPerDag: new Map([['OUD', new Map([['2026-11-02', 40], ['2026-11-11', 99]])], ['NIEUW', new Map([['2026-11-11', 25]])]]),
      namen: new Map([['OUD', 'Oude campagne'], ['ANDER', 'Andere campagne']]),
      nu,
    });
    expect([h.leveringen, h.uit_gekoppeld, h.uit_andere, h.zonder_campagne]).toEqual([5, 2, 2, 1]);
    expect(h.andere_campagnes).toEqual([{ campaign_id: 'OUD', naam: 'Oude campagne', leads: 1 }, { campaign_id: 'ANDER', naam: 'Andere campagne', leads: 1 }]);
    expect(h.koppelingen.map(x => [x.campaign_id, x.binnen, x.naar_batch, x.uitgaven, x.kosten_per_lead_naar_batch])).toEqual([
      ['NIEUW', 1, 1, 25, 25],
      ['OUD', 2, 1, 40, 40],
    ]);
  });

  it('gedeelde campagne: elke batch telt zijn deel van de uitgaven, niet alles', () => {
    const h = berekenHerkomst({
      batchId: 'B1',
      geleverd: [{ lead_id: 'L1', campaign_id: 'C', created_at: '2026-11-05T10:00:00Z' }],
      campagneLeads: new Map([['C', [{ lead_id: 'L1', campaign_id: 'C', created_at: '2026-11-05T10:00:00Z' }]]]),
      koppelingen: [
        k({ campaign_id: 'C', van: '2026-11-01T00:00:00Z' }),
        k({ campaign_id: 'C', batch_id: 'B2', van: '2026-11-03T00:00:00Z' }),
        k({ campaign_id: 'C', batch_id: 'B3', van: '2026-10-01T00:00:00Z', tot: '2026-10-20T00:00:00Z' }),
      ],
      uitgavenPerDag: new Map([['C', new Map([['2026-11-04', 100]])]]),
      namen: new Map(),
      nu,
    });
    expect(h.koppelingen[0]).toMatchObject({ uitgaven: 100, gedeeld_met: 1, uitgaven_aandeel: 50, kosten_per_lead_naar_batch: 50 });
  });

});
