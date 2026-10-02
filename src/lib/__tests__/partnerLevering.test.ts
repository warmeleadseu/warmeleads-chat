import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Externe afhankelijkheden van de levering nabootsen: het netwerk, de
   configuratie (met ontsleuteld token) en de adres- en branchegegevens. */
const verstuur = vi.fn();
vi.mock('../integrations/partners/transport', () => ({ verstuurNaarPartner: (...a: unknown[]) => verstuur(...a) }));

let config: Record<string, unknown> | null = null;
vi.mock('../integrations/partners/repo', async orig => ({
  ...(await orig<typeof import('../integrations/partners/repo')>()),
  haalPartnerConfig: async () => config,
}));
vi.mock('@/lib/pdok', () => ({ resolveStreetName: async () => 'Hoofdstraat' }));
vi.mock('../integrations/outboundWebhook/branchFields', () => ({
  getWebhookDynamicFields: async () => [{ key: 'stroomverbruik', label: 'Stroomverbruik' }],
}));
vi.mock('@/lib/supabase', () => ({ createServerClient: () => db }));

import { leverAanPartner, PartnerTijdelijkFout, PARTNER_MAX_POGINGEN } from '../integrations/partners/sync';
import { SNELRAAK } from '../integrations/partners/snelraak';

const TOKEN = 'VqFfxtlM93Y6muAjU-5yr5ZEOXSlko29P-ge';

/* Een kleine nagebootste database met precies de vragen die de levering stelt. */
type Rij = Record<string, unknown>;
let tabellen: Record<string, Rij[]>;

function query(tabel: string) {
  const filters: [string, unknown][] = [];
  let actie: 'select' | 'update' | 'insert' | 'delete' = 'select';
  let waarden: Rij = {};
  /* Alleen de vorm die de claim gebruikt: status.neq.pending,updated_at.lt.<tijd> */
  let claimGrens: string | null = null;
  const passend = () => (tabellen[tabel] ||= []).filter(r =>
    filters.every(([k, v]) => r[k] === v) &&
    (claimGrens === null || r.status !== 'pending' || String(r.updated_at) < claimGrens));
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    in: () => q,
    or: (expr: string) => { claimGrens = /updated_at.lt.(.+)$/.exec(expr)?.[1] ?? null; return q; },
    update: (w: Rij) => { actie = 'update'; waarden = w; return q; },
    delete: () => { actie = 'delete'; return q; },
    insert: (w: Rij) => {
      const al = (tabellen[tabel] ||= []).some(r => r.assignment_id === w.assignment_id && r.provider === w.provider);
      if (al) return Promise.resolve({ error: { code: '23505' } });
      tabellen[tabel].push({ id: `rij-${tabellen[tabel].length + 1}`, ...w });
      return Promise.resolve({ error: null });
    },
    maybeSingle: async () => ({ data: passend()[0] ?? null }),
    then: (klaar: (v: unknown) => void) => {
      if (actie === 'update') { const geraakt = passend(); geraakt.forEach(r => Object.assign(r, waarden)); claimGrens = null; klaar({ data: geraakt, error: null }); return; }
      if (actie === 'delete') { const weg = new Set(passend()); tabellen[tabel] = tabellen[tabel].filter(r => !weg.has(r)); }
      klaar({ data: passend(), error: null });
    },
  };
  return q;
}
const db = { from: (t: string) => query(t) } as never;

const ARGS = { partner: SNELRAAK, customerId: 'klant-1', leadId: 'lead-1', assignmentId: 'toew-1', supabase: db };
const log = () => tabellen.integration_sync_log?.[0];

/* Tijden relatief aan nu: de levering kijkt naar de leeftijd van een toewijzing. */
const geleden = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const TOEGEWEZEN = geleden(1);
const NA_TOEWIJZING = geleden(-60);

beforeEach(() => {
  verstuur.mockReset();
  config = { id: 'i1', customer_id: 'klant-1', token: TOKEN, settings: { enabled: true }, connected_at: 'x' };
  tabellen = {
    lead_assignments: [{ id: 'toew-1', customer_id: 'klant-1', lead_id: 'lead-1', assigned_at: TOEGEWEZEN }],
    leads: [{
      id: 'lead-1', branch: 'thuisbatterij', naam_klant: 'Jan Jansen', email: 'jan@example.com',
      telefoonnummer: '+31612345678', postcode: '1234AB', huisnummer: '1', plaatsnaam: 'Groningen',
      provincie: 'Groningen', land: 'NL', created_at: '2026-10-02T11:59:00Z', bron: 'zapier',
      custom_fields: { stroomverbruik: '4500 kWh', meta_leadgen_id: 'intern' },
    }],
    branches: [{ slug: 'thuisbatterij', name: 'Thuisbatterij' }],
    integration_sync_log: [],
  };
});

const ok = { status: 200, body: '{"ok":true}', timeout: false, netwerkfout: false, retryAfter: null };

describe('Levering aan Snelraak', () => {
  it('levert af bij het juiste adres, met lead_id en zonder interne velden', async () => {
    verstuur.mockResolvedValue(ok);
    expect(await leverAanPartner(ARGS)).toBe('gelukt');
    const [url, payload, opties] = verstuur.mock.calls[0];
    expect(url).toBe(`https://snelraak.nl/api/v1/ingest/${TOKEN}`);
    expect(payload).toMatchObject({ lead_id: 'lead-1', phone: '+31612345678', first_name: 'Jan', product: 'Thuisbatterij', street: 'Hoofdstraat' });
    expect(payload).not.toHaveProperty('meta_leadgen_id');
    expect(opties).toMatchObject({ idempotencyKey: 'toew-1', timeoutMs: SNELRAAK.timeoutMs });
    expect(log()).toMatchObject({ status: 'success', provider: 'partner_snelraak', attempts: 1, error_message: null });
  });

  it('levert een toewijzing maar één keer', async () => {
    verstuur.mockResolvedValue(ok);
    await leverAanPartner(ARGS);
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');
    expect(verstuur).toHaveBeenCalledTimes(1);
  });

  it('legt een 404 blijvend vast en probeert niet opnieuw', async () => {
    verstuur.mockResolvedValue({ ...ok, status: 404, body: `not found ${TOKEN}` });
    expect(await leverAanPartner(ARGS)).toBe('blijvend');
    expect(log()).toMatchObject({ status: 'failed', attempts: PARTNER_MAX_POGINGEN });
    expect(String(log()?.error_message)).toContain('404');
  });

  it('gooit bij een storing, zodat de retry-cron het later opnieuw probeert', async () => {
    verstuur.mockResolvedValue({ ...ok, status: 503, body: '' });
    await expect(leverAanPartner(ARGS)).rejects.toBeInstanceOf(PartnerTijdelijkFout);
    expect(log()).toMatchObject({ status: 'failed', attempts: 1 });

    verstuur.mockResolvedValue(ok);
    expect(await leverAanPartner(ARGS)).toBe('gelukt');
    expect(log()).toMatchObject({ status: 'success', attempts: 2 });
  });

  it('geeft bij een 429 de wachttijd door aan de cron', async () => {
    verstuur.mockResolvedValue({ ...ok, status: 429, retryAfter: '60' });
    await expect(leverAanPartner(ARGS)).rejects.toMatchObject({ wachtSeconden: 60 });
  });

  it('zet het geheime adres nooit in het synclog', async () => {
    verstuur.mockResolvedValue({ ...ok, status: 400, body: `bad request voor https://snelraak.nl/api/v1/ingest/${TOKEN}` });
    await leverAanPartner(ARGS);
    expect(String(log()?.error_message)).not.toContain(TOKEN);
  });

  it('slaat over: gepauzeerd, buiten de leverperiode, andere branche of demo-lead', async () => {
    config = { ...config!, settings: { enabled: false } };
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');

    config = { ...config!, settings: { enabled: true, leveren_vanaf: NA_TOEWIJZING } };
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');

    config = { ...config!, settings: { enabled: true, branches: ['warmtepomp'] } };
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');

    config = { ...config!, settings: { enabled: true } };
    tabellen.leads[0].bron = 'demo';
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');

    expect(verstuur).not.toHaveBeenCalled();
  });

  it('ruimt een openstaande regel op voor een lead van vóór de leverperiode', async () => {
    verstuur.mockResolvedValue({ ...ok, status: 503 });
    await expect(leverAanPartner(ARGS)).rejects.toBeInstanceOf(PartnerTijdelijkFout);
    expect(tabellen.integration_sync_log).toHaveLength(1);

    /* Daarna gepauzeerd en hervat: leveren vanaf na deze toewijzing. */
    config = { ...config!, settings: { enabled: true, leveren_vanaf: NA_TOEWIJZING } };
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');
    expect(tabellen.integration_sync_log).toHaveLength(0);
    expect(verstuur).toHaveBeenCalledTimes(1);
  });

  it('stuurt een toewijzing van meer dan 72 uur oud nooit meer (WhatsApp-opvolging heeft dan geen zin)', async () => {
    tabellen.lead_assignments[0].assigned_at = geleden(73 * 60);
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');
    tabellen.lead_assignments[0].assigned_at = geleden(71 * 60);
    verstuur.mockResolvedValue(ok);
    expect(await leverAanPartner(ARGS)).toBe('gelukt');
  });

  it('verstuurt niet als een andere poging de regel net heeft geclaimd', async () => {
    tabellen.integration_sync_log.push({
      id: 'bezig', assignment_id: 'toew-1', provider: 'partner_snelraak', status: 'pending', attempts: 1,
      updated_at: new Date().toISOString(),
    });
    expect(await leverAanPartner(ARGS)).toBe('overgeslagen');
    expect(verstuur).not.toHaveBeenCalled();
  });

  it('neemt een regel over die al minuten op pending hangt', async () => {
    tabellen.integration_sync_log.push({
      id: 'hangt', assignment_id: 'toew-1', provider: 'partner_snelraak', status: 'pending', attempts: 1,
      updated_at: geleden(10),
    });
    verstuur.mockResolvedValue(ok);
    expect(await leverAanPartner(ARGS)).toBe('gelukt');
  });

  it('weigert een toewijzing die niet bij deze klant hoort', async () => {
    expect(await leverAanPartner({ ...ARGS, customerId: 'andere-klant' })).toBe('overgeslagen');
    expect(verstuur).not.toHaveBeenCalled();
  });
});
