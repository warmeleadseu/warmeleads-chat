import { beforeEach, describe, expect, it, vi } from 'vitest';

/* Alles rond de verdeling dat niet over de keuze gaat, buiten spel. */
vi.mock('../masterPortalMirror', () => ({
  MIRROR_ASSIGNMENT_SOURCE: 'mirror',
  MASTER_PORTAL_MIRROR_BY_BRANCH: {},
  getMirrorCustomerIdForBranch: () => null,
  mirrorLeadToMasterPortal: vi.fn(async () => {}),
}));
vi.mock('../nicheResearchDistribution', () => ({ tryAssignLeadToNicheResearchBatch: vi.fn(async () => null) }));
vi.mock('../batchTargets', () => ({ fetchActiveBatchTargetsByBatch: vi.fn(async () => new Map()) }));
vi.mock('../batchDelivered', () => ({ countDeliveredForBatch: vi.fn(async () => 0), countDistinctLeadsForBatch: vi.fn(async () => 0) }));
vi.mock('../batchSync', () => ({ syncBatchDelivered: vi.fn(async () => {}) }));
vi.mock('../email', () => ({ sendLeadNotification: vi.fn() }));
vi.mock('../pushNotification', () => ({ sendNewLeadPush: vi.fn(async () => {}) }));
vi.mock('@/lib/integrations/onLeadAssigned', () => ({ onLeadAssignedToCustomer: vi.fn() }));
vi.mock('../supabase', () => ({ createServerClient: () => { throw new Error('gebruik ctx.supabase'); } }));

import { distributeLead } from '../distribution';

type Batch = Record<string, unknown>;

/**
 * Nep-database: per tabel (en voor lead_assignments per soort query) vaste
 * rijen; inserts in lead_assignments worden vastgelegd.
 */
function nepDb(opties: {
  batches: Batch[];
  targets: Record<string, unknown>[];
  bestaand?: Record<string, unknown>[];
  periode?: Record<string, unknown>[];
  /** Foutcode voor de eerste insert in lead_assignments (een gelijktijdige verdeling). */
  eersteInsertFout?: string;
  /** Wat de hercontrole na zo'n fout vindt. */
  nuToegewezen?: Record<string, unknown>[];
}) {
  const inserts: Record<string, unknown>[] = [];
  const db = {
    from(tabel: string) {
      let selectie = '';
      let isInsert = false;
      const b: Record<string, unknown> = {};
      const rijen = (): unknown[] => {
        if (tabel === 'customer_batches') return opties.batches;
        if (tabel === 'customer_targets') return opties.targets;
        if (tabel === 'customers') return opties.batches.map(x => ({ id: x.customer_id, exclude_customers: [], name: 'k', email: null, email_notifications: false }));
        if (tabel === 'lead_assignments') {
          if (selectie.includes('customer_batches(batch_kind)')) return opties.bestaand ?? [];
          if (selectie === 'batch_id, assigned_at') return opties.periode ?? [];
          if (selectie === 'assigned_at') return opties.nuToegewezen ?? [];
          return [];
        }
        return [];
      };
      for (const m of ['eq', 'neq', 'in', 'gte', 'lte', 'order', 'limit', 'or', 'not', 'contains', 'is', 'range']) b[m] = () => b;
      b.select = (s?: string) => { if (!isInsert) selectie = s ?? ''; return b; };
      b.insert = (row: Record<string, unknown>) => { isInsert = true; inserts.push({ tabel, ...row }); return b; };
      b.update = () => b;
      b.single = async () => {
        if (isInsert && opties.eersteInsertFout && tabel === 'lead_assignments' && inserts.filter(i => i.tabel === 'lead_assignments').length === 1) {
          return { data: null, error: { code: opties.eersteInsertFout, message: 'gelijktijdig' } };
        }
        return { data: isInsert ? { id: `nieuw-${inserts.length}` } : rijen()[0] ?? null, error: null };
      };
      b.maybeSingle = b.single;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rijen(), error: null }).then(ok);
      return b;
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { db, inserts: () => inserts.filter(i => i.tabel === 'lead_assignments') };
}

/* Een lead in Utrecht. */
const LEAD = {
  id: 'lead-1', branch: 'thuisbatterij', lat: 52.09, lng: 5.12, provincie: 'Utrecht', land: 'NL',
  bron: 'zapier', phone_valid: true, created_at: new Date().toISOString(), custom_fields: {},
};

const batch = (klant: string, extra: Batch = {}): Batch => ({
  id: `batch-${klant}`, customer_id: klant, branch: 'thuisbatterij', batch_size: 100, leads_delivered: 0,
  leads_delivered_external: 0, leads_per_week: null, leads_per_day: null, lead_filters: [],
  created_at: '2026-10-01T00:00:00Z', is_paid: true, starts_at: null, distribution_priority: false,
  direct_leveren: null, delivery_model: 'capped', batch_kind: 'leads', lookback_days: 30,
  customers: { id: klant, is_active: true, portal_active: true, direct_leveren: false },
  ...extra,
});
const klantDirect = (klant: string, extra: Batch = {}) => batch(klant, { customers: { id: klant, is_active: true, portal_active: true, direct_leveren: true }, ...extra });

/* A: klein gebied vlakbij (wint normaal). B: groot gebied verder weg. */
const TARGETS = [
  { customer_id: 'A', target_type: 'radius', lat: 52.09, lng: 5.12, radius_km: 20, marge_km: 0, is_active: true, country: 'NL' },
  { customer_id: 'B', target_type: 'radius', lat: 52.37, lng: 4.9, radius_km: 60, marge_km: 0, is_active: true, country: 'NL' },
];

describe('distributeLead met direct leveren', () => {
  beforeEach(() => vi.clearAllMocks());

  it('niemand op direct: de gewone winnaar (kleinste gebied) krijgt de lead, via_direct false', async () => {
    const { db, inserts } = nepDb({ batches: [batch('A'), batch('B')], targets: TARGETS });
    const r = await distributeLead(LEAD as never, { supabase: db as never });
    expect(r.assignments.map(a => a.customer_id)).toEqual(['A']);
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0]).toMatchObject({ customer_id: 'A', via_direct: false });
  });

  it('klantkaart op direct: die klant wint, ook met een groter gebied, via_direct true', async () => {
    const { db, inserts } = nepDb({ batches: [batch('A'), klantDirect('B')], targets: TARGETS });
    const r = await distributeLead(LEAD as never, { supabase: db as never });
    expect(r.assignments.map(a => a.customer_id)).toEqual(['B']);
    expect(inserts()[0]).toMatchObject({ customer_id: 'B', via_direct: true });
  });

  it('alleen de batch op direct (klantkaart uit): ook direct', async () => {
    const { db, inserts } = nepDb({ batches: [batch('A'), batch('B', { direct_leveren: 'aan' })], targets: TARGETS });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()[0]).toMatchObject({ customer_id: 'B', via_direct: true });
  });

  it('klantkaart op direct maar batch op "nooit direct": gewone verdeling', async () => {
    const { db, inserts } = nepDb({ batches: [batch('A'), klantDirect('B', { direct_leveren: 'uit' })], targets: TARGETS });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()[0]).toMatchObject({ customer_id: 'A', via_direct: false });
  });

  it('direct gaat voor voorrang', async () => {
    const { db, inserts } = nepDb({ batches: [batch('A', { distribution_priority: true }), klantDirect('B')], targets: TARGETS });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()[0]).toMatchObject({ customer_id: 'B' });
  });

  it('dagmaximum van de direct-klant vol: de volgende kandidaat krijgt hem', async () => {
    const vandaag = new Date().toISOString();
    const { db, inserts } = nepDb({
      batches: [batch('A'), klantDirect('B', { leads_per_day: 2 })],
      targets: TARGETS,
      periode: [{ batch_id: 'batch-B', assigned_at: vandaag }, { batch_id: 'batch-B', assigned_at: vandaag }],
    });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()[0]).toMatchObject({ customer_id: 'A', via_direct: false });
  });

  it('lead buiten het gebied van de direct-klant: gewone verdeling', async () => {
    const ver = { ...LEAD, lat: 51.44, lng: 5.48, provincie: 'Noord-Brabant' }; /* Eindhoven */
    const targets = [
      { customer_id: 'A', target_type: 'radius', lat: 51.44, lng: 5.48, radius_km: 30, marge_km: 0, is_active: true, country: 'NL' },
      TARGETS[1],
    ];
    const { db, inserts } = nepDb({ batches: [batch('A'), klantDirect('B')], targets });
    await distributeLead(ver as never, { supabase: db as never });
    expect(inserts()[0]).toMatchObject({ customer_id: 'A', via_direct: false });
  });

  it('lead die net een andere klant kreeg: geen tweede klant binnen 12 uur, ook niet voor direct', async () => {
    const { db, inserts } = nepDb({
      batches: [batch('A'), klantDirect('B')],
      targets: TARGETS,
      bestaand: [{ customer_id: 'A', assigned_at: new Date().toISOString(), batch_id: 'batch-A', customer_batches: { batch_kind: 'leads' } }],
    });
    const r = await distributeLead(LEAD as never, { supabase: db as never });
    expect(r.assignments).toEqual([]);
    expect(inserts()).toHaveLength(0);
  });

  it('twee direct-klanten: onderling de gewone volgorde (kleinste gebied)', async () => {
    const { db, inserts } = nepDb({ batches: [klantDirect('A'), klantDirect('B')], targets: TARGETS });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()[0]).toMatchObject({ customer_id: 'A', via_direct: true });
  });

  it('tweede klant (na de 12 uur): direct telt niet, gewone volgorde en via_direct false', async () => {
    const dertienUurGeleden = new Date(Date.now() - 13 * 3_600_000).toISOString();
    const { db, inserts } = nepDb({
      batches: [batch('A'), klantDirect('B')],
      targets: TARGETS,
      bestaand: [{ customer_id: 'C', assigned_at: dertienUurGeleden, batch_id: 'batch-C', customer_batches: { batch_kind: 'leads' } }],
    });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()[0]).toMatchObject({ customer_id: 'A', via_direct: false });
  });

  it('gelijktijdige verdeling won de lead net (dubbele sleutel): geen tweede klant erbij', async () => {
    const { db, inserts } = nepDb({
      batches: [klantDirect('B'), batch('A')],
      targets: TARGETS,
      eersteInsertFout: '23505',
      nuToegewezen: [{ assigned_at: new Date().toISOString() }],
    });
    const r = await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()).toHaveLength(1);
    expect(r.assignments).toEqual([]);
  });

  it('plafondfout van de database bij een gelijktijdige verdeling: ook stoppen', async () => {
    const { db, inserts } = nepDb({
      batches: [klantDirect('B'), batch('A')],
      targets: TARGETS,
      eersteInsertFout: '23514',
      nuToegewezen: [{ assigned_at: new Date().toISOString() }],
    });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts()).toHaveLength(1);
  });

  it('dubbele sleutel door een oude toewijzing (geen verse klant): volgende kandidaat krijgt hem', async () => {
    const { db, inserts } = nepDb({ batches: [klantDirect('B'), batch('A')], targets: TARGETS, eersteInsertFout: '23505', nuToegewezen: [] });
    const r = await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts().map(i => i.customer_id)).toEqual(['B', 'A']);
    expect(r.assignments.map(a => a.customer_id)).toEqual(['A']);
  });

  it('andere insertfout: gewoon de volgende kandidaat (zoals voorheen)', async () => {
    const { db, inserts } = nepDb({ batches: [klantDirect('B'), batch('A')], targets: TARGETS, eersteInsertFout: '42501' });
    await distributeLead(LEAD as never, { supabase: db as never });
    expect(inserts().map(i => i.customer_id)).toEqual(['B', 'A']);
  });

  describe('exclusieve en uitgesloten campagnes', () => {
    const uur = (u: number) => new Date(Date.now() - u * 3_600_000).toISOString();
    const leadUit = (campagne: string | null, uurGeleden = 0.1) => ({ ...LEAD, meta_campaign_id: campagne, created_at: uur(uurGeleden) });
    const metRegel = (klant: string, extra: Batch) => batch(klant, { status: 'active', meta_campagne_exclusief: {}, meta_campagne_uitgesloten: [], ...extra });

    it('24 uur exclusief voor B: B krijgt hem, ook al wint A normaal', async () => {
      const { db, inserts } = nepDb({ batches: [metRegel('A', {}), metRegel('B', { meta_campagne_exclusief: { '111': '24u' } })], targets: TARGETS });
      await distributeLead(leadUit('111') as never, { supabase: db as never });
      expect(inserts().map(i => i.customer_id)).toEqual(['B']);
    });

    it('na 24 uur: weer de gewone verdeling', async () => {
      const { db, inserts } = nepDb({ batches: [metRegel('A', {}), metRegel('B', { meta_campagne_exclusief: { '111': '24u' } })], targets: TARGETS });
      await distributeLead(leadUit('111', 25) as never, { supabase: db as never });
      expect(inserts().map(i => i.customer_id)).toEqual(['A']);
    });

    it('altijd exclusief en de exclusieve batch is vol: niemand anders krijgt hem', async () => {
      const { db, inserts } = nepDb({
        batches: [metRegel('A', {}), metRegel('B', { meta_campagne_exclusief: { '111': 'altijd' }, batch_size: 5, leads_delivered: 5 })],
        targets: TARGETS,
      });
      await distributeLead(leadUit('111', 80) as never, { supabase: db as never });
      expect(inserts()).toHaveLength(0);
    });

    it('A sluit de campagne uit: B krijgt hem', async () => {
      const { db, inserts } = nepDb({ batches: [metRegel('A', { meta_campagne_uitgesloten: ['111'] }), metRegel('B', {})], targets: TARGETS });
      await distributeLead(leadUit('111') as never, { supabase: db as never });
      expect(inserts().map(i => i.customer_id)).toEqual(['B']);
    });

    it('lead uit een andere campagne of zonder campagne: niets verandert', async () => {
      const regels = [metRegel('A', {}), metRegel('B', { meta_campagne_exclusief: { '111': 'altijd' } })];
      const een = nepDb({ batches: regels, targets: TARGETS });
      await distributeLead(leadUit('222') as never, { supabase: een.db as never });
      expect(een.inserts().map(i => i.customer_id)).toEqual(['A']);
      const twee = nepDb({ batches: regels, targets: TARGETS });
      await distributeLead(leadUit(null) as never, { supabase: twee.db as never });
      expect(twee.inserts().map(i => i.customer_id)).toEqual(['A']);
    });

    it('exclusief voor een gepauzeerde batch: blijft exclusief (geen andere klant)', async () => {
      const gepauzeerd = { id: 'batch-B', customer_id: 'B', status: 'paused', meta_campagne_exclusief: { '111': '24u' }, meta_campagne_uitgesloten: [] };
      const { db, inserts } = nepDb({ batches: [metRegel('A', {}), gepauzeerd as Batch], targets: TARGETS });
      await distributeLead(leadUit('111') as never, { supabase: db as never });
      expect(inserts()).toHaveLength(0);
    });
  });

  it('demo-lead: nooit verdeeld', async () => {
    const { db, inserts } = nepDb({ batches: [klantDirect('B')], targets: TARGETS });
    await distributeLead({ ...LEAD, bron: 'demo' } as never, { supabase: db as never });
    expect(inserts()).toHaveLength(0);
  });
});
