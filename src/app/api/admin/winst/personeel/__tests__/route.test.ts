import { beforeEach, describe, expect, it, vi } from 'vitest';

type Regel = { id: string; ingang: string; einde: string | null; bedrag_per_maand: number };
let regels: Regel[] = [];
let rol = 'superadmin';
const audit = vi.fn(async () => {});

vi.mock('@/lib/adminAuth', () => ({
  requireSuperAdmin: async () => (rol === 'superadmin'
    ? { admin: { id: 'a', name: 'Rick', role: 'superadmin' }, error: null }
    : { admin: null, error: new Response(null, { status: 403 }) }),
}));
vi.mock('@/lib/audit', () => ({ logAudit: (...a: unknown[]) => audit(...(a as [])) }));
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => {
      let filterId: string | null = null;
      let actie: 'lees' | 'update' | 'delete' | 'insert' = 'lees';
      let payload: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      const uitvoeren = () => {
        if (actie === 'update') regels = regels.map(r => (r.id === filterId ? { ...r, ...payload } as Regel : r));
        if (actie === 'delete') regels = regels.filter(r => r.id !== filterId);
      };
      b.select = () => b;
      b.order = () => b;
      b.update = (p: Record<string, unknown>) => { actie = 'update'; payload = p; return b; };
      b.delete = () => { actie = 'delete'; return b; };
      b.insert = (p: Record<string, unknown>) => {
        actie = 'insert';
        const nieuw = { id: `n${regels.length}`, ...p } as Regel;
        regels.push(nieuw);
        payload = nieuw;
        return b;
      };
      b.eq = (_k: string, v: string) => { filterId = v; return b; };
      b.single = async () => ({ data: payload, error: null });
      b.then = (ok: (v: unknown) => unknown) => {
        uitvoeren();
        return Promise.resolve({ data: [...regels].sort((x, y) => x.ingang.localeCompare(y.ingang)), error: null }).then(ok);
      };
      return b;
    },
  }),
}));

import { DELETE, POST } from '../route';
import { leesBedrag } from '@/lib/bedrag';

const post = (body: Record<string, unknown>) => POST({ json: async () => body } as never);
const del = (id: string) => DELETE({ nextUrl: new URL(`http://x/?id=${id}`) } as never);

beforeEach(() => {
  rol = 'superadmin';
  regels = [{ id: 'r1', ingang: '2026-05-01', einde: null, bedrag_per_maand: 8500 }];
  audit.mockClear();
});

describe('personeelskosten', () => {
  it('nieuw bedrag: de lopende regel eindigt de dag ervoor, de nieuwe loopt door', async () => {
    const res = await post({ bedrag_per_maand: '9.000', ingang: '2026-11-01' });
    expect(res.status).toBe(200);
    expect(regels.find(r => r.id === 'r1')?.einde).toBe('2026-10-31');
    const nieuw = regels.find(r => r.id !== 'r1')!;
    expect(nieuw).toMatchObject({ ingang: '2026-11-01', einde: null, bedrag_per_maand: 9000 });
    expect(audit).toHaveBeenCalled();
  });

  it('bedragen zoals een mens ze typt', () => {
    expect(leesBedrag('8500')).toBe(8500);
    expect(leesBedrag('8.500')).toBe(8500);
    expect(leesBedrag('8.500,50')).toBe(8500.5);
    expect(leesBedrag('8500,5')).toBe(8500.5);
    expect(leesBedrag('8500.50')).toBe(8500.5);
    expect(leesBedrag('€ 8.500')).toBe(8500);
    expect(leesBedrag('')).toBeNaN();
  });

  it('bedrag met komma wordt goed gelezen', async () => {
    await post({ bedrag_per_maand: '8750,50', ingang: '2026-12-01' });
    expect(regels.find(r => r.ingang === '2026-12-01')?.bedrag_per_maand).toBe(8750.5);
  });

  it('nieuw bedrag vóór een bestaande regel: loopt tot de dag vóór die regel', async () => {
    await post({ bedrag_per_maand: 8000, ingang: '2026-04-01' });
    expect(regels.find(r => r.ingang === '2026-04-01')?.einde).toBe('2026-04-30');
    expect(regels.find(r => r.id === 'r1')?.einde).toBeNull();
  });

  it('dubbele ingangsdatum, ongeldig bedrag of datum: geweigerd', async () => {
    expect((await post({ bedrag_per_maand: 9000, ingang: '2026-05-01' })).status).toBe(400);
    expect((await post({ bedrag_per_maand: -5, ingang: '2026-11-01' })).status).toBe(400);
    expect((await post({ bedrag_per_maand: 'abc', ingang: '2026-11-01' })).status).toBe(400);
    expect((await post({ bedrag_per_maand: 9000, ingang: '1-11-2026' })).status).toBe(400);
    expect(regels).toHaveLength(1);
  });

  it('verwijderen: de vorige regel loopt weer door', async () => {
    await post({ bedrag_per_maand: 9000, ingang: '2026-11-01' });
    const nieuw = regels.find(r => r.id !== 'r1')!;
    expect((await del(nieuw.id)).status).toBe(200);
    expect(regels).toHaveLength(1);
    expect(regels[0].einde).toBeNull();
  });

  it('geen superadmin: geen toegang', async () => {
    rol = 'admin';
    expect((await post({ bedrag_per_maand: 9000, ingang: '2026-11-01' })).status).toBe(403);
    expect((await del('r1')).status).toBe(403);
    expect(regels).toHaveLength(1);
  });
});
