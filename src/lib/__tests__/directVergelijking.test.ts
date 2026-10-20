import { describe, expect, it } from 'vitest';
import { berekenHerbestelling, berekenKengetallen, groepVan, voorNaVensters, binnen, type LeveringRij, type BatchRij } from '../directVergelijking';

const NU = new Date('2026-10-20T12:00:00Z');
const dagen = (d: number) => new Date(NU.getTime() - d * 86_400_000).toISOString();
let n = 0;
const rij = (x: Partial<LeveringRij>): LeveringRij => ({
  assignment_id: `a${n++}`, customer_id: 'k', lead_id: `l${n}`, branch: 'thuisbatterij', assigned_at: dagen(10), lead_created_at: dagen(10),
  status: 'nieuw', via_direct: false, snelraak: false, eerste_status_at: null, reclamatie: false, eerste_klant: true, ...x,
});

describe('berekenKengetallen', () => {
  it('snelheid alleen over eerste klanten: mediaan en aandeel binnen een minuut', () => {
    const t0 = new Date(dagen(10));
    const plus = (s: number) => new Date(t0.getTime() + s * 1000).toISOString();
    const k = berekenKengetallen([
      rij({ lead_created_at: t0.toISOString(), assigned_at: plus(2) }),
      rij({ lead_created_at: t0.toISOString(), assigned_at: plus(40) }),
      rij({ lead_created_at: t0.toISOString(), assigned_at: plus(900) }),
      rij({ lead_created_at: t0.toISOString(), assigned_at: plus(99999), eerste_klant: false }),
    ], NU);
    expect(k.snelheid).toEqual({ aantal: 3, mediaanSec: 40, binnenMinuutPct: 66.7 });
  });

  it('datakwaliteit: alleen leads ouder dan 7 dagen tellen', () => {
    const k = berekenKengetallen([
      rij({ assigned_at: dagen(10), status: 'gecontacteerd' }),
      rij({ assigned_at: dagen(10), status: 'nieuw' }),
      rij({ assigned_at: dagen(2), status: 'nieuw' }),
    ], NU);
    expect(k.bijgewerktBasis).toBe(2);
    expect(k.bijgewerktPct).toBe(50);
  });

  it('opvolging alleen over bijgewerkte leads', () => {
    const k = berekenKengetallen([
      rij({ status: 'afspraak' }), rij({ status: 'afspraak' }), rij({ status: 'verkocht' }), rij({ status: 'nieuw' }), rij({ status: 'nieuw' }),
    ], NU);
    expect(k.opvolgingBasis).toBe(3);
    expect(k.opvolging.afspraak).toBe(2);
    expect(k.opvolging.verkocht).toBe(1);
  });

  it('uren tot eerste statuswijziging en reclamaties', () => {
    const toegewezen = dagen(10);
    const k = berekenKengetallen([
      rij({ assigned_at: toegewezen, eerste_status_at: new Date(new Date(toegewezen).getTime() + 2 * 3_600_000).toISOString() }),
      rij({ assigned_at: toegewezen, eerste_status_at: new Date(new Date(toegewezen).getTime() + 6 * 3_600_000).toISOString(), reclamatie: true }),
    ], NU);
    expect(k.urenTotEersteStatus).toBe(4);
    expect(k.reclamatiePct).toBe(50);
  });

  it('betrouwbaarheid: te weinig leads, of te weinig bijgewerkt', () => {
    expect(berekenKengetallen([rij({})], NU).waarschuwing).toMatch(/Te weinig leads/);
    const veel = Array.from({ length: 40 }, () => rij({ status: 'nieuw' }));
    const k = berekenKengetallen(veel, NU);
    expect(k.betrouwbaar).toBe(false);
    expect(k.waarschuwing).toMatch(/Maar 0% van de leads is bijgewerkt/);
    const goed = Array.from({ length: 40 }, (_, i) => rij({ status: i % 4 === 0 ? 'nieuw' : 'gecontacteerd' }));
    expect(berekenKengetallen(goed, NU).betrouwbaar).toBe(true);
  });

  it('lege lijst: niets kapot', () => {
    const k = berekenKengetallen([], NU);
    expect(k.leveringen).toBe(0);
    expect(k.snelheid.mediaanSec).toBeNull();
    expect(k.reclamatiePct).toBeNull();
  });
});

describe('berekenHerbestelling', () => {
  const b = (x: Partial<BatchRij>): BatchRij => ({ id: 'b', customer_id: 'k', branch: 'thuisbatterij', created_at: dagen(80), completed_at: dagen(60), is_paid: true, ...x });
  it('dagen tot de volgende betaalde batch, en het aandeel binnen 30 dagen', () => {
    const a1 = b({ id: 'a1', customer_id: 'k1', created_at: dagen(80), completed_at: dagen(60) });
    const v1 = b({ id: 'v1', customer_id: 'k1', created_at: dagen(50), completed_at: null });
    const a2 = b({ id: 'a2', customer_id: 'k2', created_at: dagen(80), completed_at: dagen(60) });
    const h = berekenHerbestelling([a1, a2], [a1, v1, a2], NU);
    expect(h).toMatchObject({ afgerond: 2, herbesteld: 1, binnenTermijnPct: 50, mediaanDagen: 10 });
  });
  it('net afgerond zonder herbestelling: nog niet beoordelen', () => {
    const a = b({ id: 'a', created_at: dagen(20), completed_at: dagen(5) });
    expect(berekenHerbestelling([a], [a], NU).binnenTermijnPct).toBeNull();
  });
  it('onbetaalde vervolgbatch telt niet als herbestelling', () => {
    const a = b({ id: 'a' });
    const onb = b({ id: 'o', created_at: dagen(50), completed_at: null, is_paid: false });
    expect(berekenHerbestelling([a], [a, onb], NU).herbesteld).toBe(0);
  });
});

describe('groepen en vensters', () => {
  it('vier groepen', () => {
    expect(groepVan({ via_direct: true, snelraak: true })).toBe('direct_snelraak');
    expect(groepVan({ via_direct: true, snelraak: false })).toBe('direct');
    expect(groepVan({ via_direct: false, snelraak: true })).toBe('snelraak');
    expect(groepVan({ via_direct: false, snelraak: false })).toBe('geen');
  });
  it('even lange periodes voor en na, maximaal 90 dagen', () => {
    const sinds = new Date(dagen(10));
    const v = voorNaVensters(sinds, NU);
    expect(v.voor[0].toISOString()).toBe(dagen(20));
    expect(v.na[1].toISOString()).toBe(NU.toISOString());
    const lang = voorNaVensters(new Date(dagen(200)), NU);
    expect((lang.voor[1].getTime() - lang.voor[0].getTime()) / 86_400_000).toBe(90);
    expect(binnen(dagen(15), v.voor)).toBe(true);
    expect(binnen(dagen(15), v.na)).toBe(false);
  });
});
