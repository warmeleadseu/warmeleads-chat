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

import { distributeLead, type VerdeelRonde } from '../distribution';
import { countDeliveredForBatch } from '../batchDelivered';

type Rij = Record<string, unknown>;

/** Nep-database met lead_assignments en de wachtrij. */
function nepDb(o: { batches: Rij[]; targets: Rij[]; bestaand?: Rij[]; periode?: Rij[]; inWachtrij?: Rij[] }) {
  const toegewezen: Rij[] = [];
  const ingepland: Rij[] = [];
  const db = {
    from(tabel: string) {
      let selectie = '';
      let modus: 'lees' | 'insert' | 'upsert' = 'lees';
      let rijenIn: Rij[] = [];
      const b: Record<string, unknown> = {};
      const lees = (): unknown[] => {
        if (modus === 'upsert') return rijenIn.map((_, i) => ({ id: `g${ingepland.length - rijenIn.length + i}` }));
        if (tabel === 'customer_batches') return o.batches;
        if (tabel === 'customer_targets') return o.targets;
        if (tabel === 'customers') return o.batches.map(x => ({ id: x.customer_id, exclude_customers: [], name: 'k', email: null, email_notifications: false }));
        if (tabel === 'lead_assignments') {
          if (selectie.includes('customer_batches(batch_kind)')) return o.bestaand ?? [];
          if (selectie === 'batch_id, assigned_at') return o.periode ?? [];
          return [];
        }
        if (tabel === 'geplande_leadleveringen') {
          if (selectie === 'id') return o.inWachtrij ?? [];
          if (selectie.startsWith('id, lead_id, batch_id')) return o.inWachtrij ?? [];
          return [];
        }
        return [];
      };
      for (const m of ['eq', 'neq', 'in', 'gte', 'lte', 'order', 'limit', 'or', 'not', 'contains', 'is', 'range']) b[m] = () => b;
      b.select = (s?: string) => { if (modus === 'lees') selectie = s ?? ''; return b; };
      b.insert = (row: Rij) => { modus = 'insert'; if (tabel === 'lead_assignments') toegewezen.push(row); return b; };
      b.upsert = (rows: Rij[]) => { modus = 'upsert'; rijenIn = rows; if (tabel === 'geplande_leadleveringen') ingepland.push(...rows); return b; };
      b.update = () => b;
      b.single = async () => ({ data: modus === 'insert' ? { id: `t${toegewezen.length}` } : lees()[0] ?? null, error: null });
      b.maybeSingle = b.single;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: lees(), error: null }).then(ok);
      return b;
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { db, toegewezen, ingepland };
}

const VERS = () => new Date(Date.now() - 5 * 60_000).toISOString();
const OUD = () => new Date(Date.now() - 2 * 86_400_000).toISOString();
const lead = (id: string, created_at: string) => ({
  id, branch: 'thuisbatterij', lat: 52.09, lng: 5.12, provincie: 'Utrecht', land: 'NL', bron: 'zapier', phone_valid: true, created_at, custom_fields: {},
});
const batch = (klant: string, extra: Rij = {}): Rij => ({
  id: `batch-${klant}`, customer_id: klant, branch: 'thuisbatterij', batch_size: 100, leads_delivered: 0,
  leads_delivered_external: 0, leads_per_week: null, leads_per_day: null, lead_filters: [],
  created_at: '2026-01-01T00:00:00Z', is_paid: true, starts_at: null, distribution_priority: false,
  direct_leveren: null, delivery_model: 'capped', batch_kind: 'leads', lookback_days: 30,
  customers: { id: klant, is_active: true, portal_active: true, direct_leveren: false },
  ...extra,
});
const TARGETS = [
  { customer_id: 'A', target_type: 'radius', lat: 52.09, lng: 5.12, radius_km: 20, marge_km: 0, is_active: true, country: 'NL' },
  { customer_id: 'B', target_type: 'radius', lat: 52.37, lng: 4.9, radius_km: 60, marge_km: 0, is_active: true, country: 'NL' },
];
const ronde = (extra: Partial<VerdeelRonde> = {}): VerdeelRonde => ({
  geplandeLeadIds: new Set(), geplandPerBatch: new Map(), batchKreegLead: new Set(), gepland: 0, ...extra,
});

describe('verdeelronde: meteen of verspreid', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(countDeliveredForBatch).mockResolvedValue(0); });

  it('verse lead, eerste voor de batch in deze ronde: meteen', async () => {
    const { db, toegewezen, ingepland } = nepDb({ batches: [batch('A')], targets: TARGETS });
    const r = ronde();
    const uit = await distributeLead(lead('l1', VERS()) as never, { supabase: db as never, ronde: r });
    expect(toegewezen).toHaveLength(1);
    expect(ingepland).toHaveLength(0);
    expect(uit.assignments.map(a => a.customer_id)).toEqual(['A']);
    expect(r.batchKreegLead.has('batch-A')).toBe(true);
  });

  it('tweede verse lead voor dezelfde batch in dezelfde ronde: kort verspreid in de wachtrij', async () => {
    const { db, toegewezen, ingepland } = nepDb({ batches: [batch('A')], targets: TARGETS });
    const r = ronde({ batchKreegLead: new Set(['batch-A']) });
    const voor = Date.now();
    const uit = await distributeLead(lead('l2', VERS()) as never, { supabase: db as never, ronde: r });
    expect(toegewezen).toHaveLength(0);
    expect(ingepland).toHaveLength(1);
    expect(ingepland[0]).toMatchObject({ lead_id: 'l2', customer_id: 'A', batch_id: 'batch-A', soort: 'spreiding', negeer_geo: true });
    const t = new Date(ingepland[0].gepland_voor as string).getTime();
    expect(t).toBeGreaterThanOrEqual(voor);
    expect(t).toBeLessThanOrEqual(voor + 13 * 3_600_000);
    expect(uit.gepland?.customer_id).toBe('A');
    expect(r.gepland).toBe(1);
    expect(r.geplandeLeadIds.has('l2')).toBe(true);
    expect(r.geplandPerBatch.get('batch-A')?.totaal).toBe(1);
  });

  it('oudere lead (2 dagen): nooit meteen, altijd verspreid', async () => {
    const { db, toegewezen, ingepland } = nepDb({ batches: [batch('A')], targets: TARGETS });
    await distributeLead(lead('l3', OUD()) as never, { supabase: db as never, ronde: ronde() });
    expect(toegewezen).toHaveLength(0);
    expect(ingepland).toHaveLength(1);
    expect(ingepland[0].reden).toMatch(/Geen verse lead/);
  });

  it('direct leveren: ook als tweede lead in de ronde meteen', async () => {
    const direct = batch('A', { customers: { id: 'A', is_active: true, portal_active: true, direct_leveren: true } });
    const { db, toegewezen, ingepland } = nepDb({ batches: [direct], targets: TARGETS });
    await distributeLead(lead('l4', VERS()) as never, { supabase: db as never, ronde: ronde({ batchKreegLead: new Set(['batch-A']) }) });
    expect(toegewezen).toHaveLength(1);
    expect(toegewezen[0]).toMatchObject({ via_direct: true });
    expect(ingepland).toHaveLength(0);
  });

  it('lead die al in de wachtrij staat: niet opnieuw verdelen', async () => {
    const { db, toegewezen, ingepland } = nepDb({ batches: [batch('A')], targets: TARGETS });
    await distributeLead(lead('l5', OUD()) as never, { supabase: db as never, ronde: ronde({ geplandeLeadIds: new Set(['l5']) }) });
    expect(toegewezen).toHaveLength(0);
    expect(ingepland).toHaveLength(0);
  });

  it('bij binnenkomst (geen ronde): ook een oudere lead gaat meteen, zoals altijd', async () => {
    const { db, toegewezen, ingepland } = nepDb({ batches: [batch('A')], targets: TARGETS });
    await distributeLead(lead('l6', OUD()) as never, { supabase: db as never });
    expect(toegewezen).toHaveLength(1);
    expect(ingepland).toHaveLength(0);
  });

  it('bij binnenkomst: lead die al in de wachtrij staat wordt niet nog eens verdeeld', async () => {
    const { db, toegewezen } = nepDb({ batches: [batch('A')], targets: TARGETS, inWachtrij: [{ id: 'g1' }] });
    await distributeLead(lead('l7', VERS()) as never, { supabase: db as never });
    expect(toegewezen).toHaveLength(0);
  });

  it('wat in de wachtrij staat telt mee voor het dagmaximum: dan de volgende klant', async () => {
    const vandaag = new Date();
    const r = ronde({ geplandPerBatch: new Map([['batch-A', { totaal: 1, vandaag: 1, week: 1, momenten: [vandaag] }]]) });
    const { db, toegewezen } = nepDb({ batches: [batch('A', { leads_per_day: 1 }), batch('B')], targets: TARGETS });
    await distributeLead(lead('l8', VERS()) as never, { supabase: db as never, ronde: r });
    expect(toegewezen.map(t => t.customer_id)).toEqual(['B']);
  });

  it('wat in de wachtrij staat telt mee voor de ruimte in de batch', async () => {
    const r = ronde({ geplandPerBatch: new Map([['batch-A', { totaal: 1, vandaag: 0, week: 0, momenten: [] }]]) });
    const { db, toegewezen } = nepDb({ batches: [batch('A', { batch_size: 2, leads_delivered: 1 }), batch('B')], targets: TARGETS });
    await distributeLead(lead('l9', VERS()) as never, { supabase: db as never, ronde: r });
    expect(toegewezen.map(t => t.customer_id)).toEqual(['B']);
  });

  it('tweede klant na de 12 uur in een ronde: verspreid, geen piek op het kwartier', async () => {
    const dertienUur = new Date(Date.now() - 13 * 3_600_000).toISOString();
    const { db, toegewezen, ingepland } = nepDb({
      batches: [batch('A'), batch('B')],
      targets: TARGETS,
      bestaand: [{ customer_id: 'C', assigned_at: dertienUur, batch_id: 'batch-C', customer_batches: { batch_kind: 'leads' } }],
    });
    await distributeLead(lead('l10', dertienUur) as never, { supabase: db as never, ronde: ronde() });
    expect(toegewezen).toHaveLength(0);
    expect(ingepland).toHaveLength(1);
    expect(ingepland[0].customer_id).toBe('A');
  });
});
