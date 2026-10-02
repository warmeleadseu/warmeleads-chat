import { describe, it, expect, vi, beforeEach } from 'vitest';

let bestaand: Record<string, unknown> | null = null;
const opgeslagen: Record<string, unknown>[] = [];
const audit: Record<string, unknown>[] = [];

vi.mock('../integrations/partners/repo', async orig => ({
  ...(await orig<typeof import('../integrations/partners/repo')>()),
  haalPartnerConfig: async () => bestaand,
  slaPartnerConfigOp: async (_s: unknown, _c: unknown, _p: unknown, invoer: Record<string, unknown>) => { opgeslagen.push(invoer); },
}));
vi.mock('@/lib/audit', () => ({ logAudit: async (e: Record<string, unknown>) => { audit.push(e); } }));
vi.mock('../integrations/partners/sync', () => ({
  leverReeks: async () => ({ gelukt: 0, mislukt: 0, resterend: 0 }),
  PARTNER_MAX_POGINGEN: 8,
}));

import { partnerOpslaan } from '../integrations/partners/service';
import { SNELRAAK } from '../integrations/partners/snelraak';

const TOKEN = 'VqFfxtlM93Y6muAjU-5yr5ZEOXSlko29P-ge';
const URL_OK = `https://snelraak.nl/api/v1/ingest/${TOKEN}`;
const db = {} as never;
const ADMIN = { soort: 'admin' as const, id: 'a1', naam: 'Rick' };
const PORTAAL = { soort: 'portaal' as const, id: 'u1', naam: 'BNDGO' };
const uurGeleden = (iso: unknown) => (Date.now() - new Date(String(iso)).getTime()) / 3_600_000;

beforeEach(() => { bestaand = null; opgeslagen.length = 0; audit.length = 0; });

describe('Partnerkoppeling opslaan', () => {
  it('eerste koppeling: levert vanaf nu, met versleuteld token', async () => {
    const u = await partnerOpslaan(db, 'k1', SNELRAAK, { url: URL_OK, enabled: true }, ['thuisbatterij'], ADMIN);
    expect(u.ok).toBe(true);
    expect(opgeslagen[0]).toMatchObject({ token: TOKEN, enabled: true });
    expect(uurGeleden(opgeslagen[0].leveren_vanaf)).toBeLessThan(0.01);
  });

  it('admin mag bij het koppelen tot 3 dagen laten nasturen; meer wordt 3', async () => {
    await partnerOpslaan(db, 'k1', SNELRAAK, { url: URL_OK, enabled: true, nasturen_dagen: 2 }, [], ADMIN);
    expect(Math.round(uurGeleden(opgeslagen[0].leveren_vanaf))).toBe(48);
    await partnerOpslaan(db, 'k1', SNELRAAK, { url: URL_OK, enabled: true, nasturen_dagen: 30 }, [], ADMIN);
    expect(Math.round(uurGeleden(opgeslagen[1].leveren_vanaf))).toBe(72);
  });

  it('de klant zelf kan niet laten nasturen', async () => {
    await partnerOpslaan(db, 'k1', SNELRAAK, { url: URL_OK, enabled: true, nasturen_dagen: 3 }, [], PORTAAL);
    expect(uurGeleden(opgeslagen[0].leveren_vanaf)).toBeLessThan(0.01);
  });

  it('een nieuw adres verschuift de leverperiode niet: mislukte leads gaan na herstel alsnog mee', async () => {
    bestaand = { token: 'oudtoken-1234567890', settings: { enabled: true, leveren_vanaf: '2026-10-01T10:00:00Z' } };
    await partnerOpslaan(db, 'k1', SNELRAAK, { url: URL_OK }, [], ADMIN);
    expect(opgeslagen[0]).not.toHaveProperty('leveren_vanaf');
    expect(opgeslagen[0].token).toBe(TOKEN);
  });

  it('hervatten na een pauze levert vanaf nu: wat in de pauze binnenkwam gaat niet alsnog', async () => {
    bestaand = { token: TOKEN, settings: { enabled: false, leveren_vanaf: '2026-10-01T10:00:00Z' } };
    await partnerOpslaan(db, 'k1', SNELRAAK, { enabled: true }, [], PORTAAL);
    expect(uurGeleden(opgeslagen[0].leveren_vanaf)).toBeLessThan(0.01);
  });

  it('weigert een ander adres dan Snelraak, en een koppeling zonder adres', async () => {
    const a = await partnerOpslaan(db, 'k1', SNELRAAK, { url: 'https://evil.example/api/v1/ingest/' + TOKEN }, [], ADMIN);
    expect(a.ok).toBe(false);
    const b = await partnerOpslaan(db, 'k1', SNELRAAK, { enabled: true }, [], ADMIN);
    expect(b.ok).toBe(false);
    expect(opgeslagen).toHaveLength(0);
  });

  it('houdt alleen branches van de klant over', async () => {
    await partnerOpslaan(db, 'k1', SNELRAAK, { url: URL_OK, branches: ['thuisbatterij', 'kozijnen'] }, ['thuisbatterij'], ADMIN);
    expect(opgeslagen[0].branches).toEqual(['thuisbatterij']);
  });

  it('legt elke wijziging vast in het auditlog, zonder het geheime adres', async () => {
    await partnerOpslaan(db, 'k1', SNELRAAK, { url: URL_OK, enabled: true }, [], ADMIN);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'update_integration', adminId: 'a1' });
    expect(JSON.stringify(audit[0])).not.toContain(TOKEN);
  });
});
