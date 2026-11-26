import { describe, expect, it, vi } from 'vitest';
import { leesSeintje, prospectPopupFase, seintjeNu, taakWijzigingen } from '../prospectTerugbellen';
import { stuurProspectSeintjes } from '../terugbelMeldingen';

vi.mock('../email', () => ({ EMAIL_BASE_URL: 'https://x', layout: (_: string, h: string) => h, sendEmail: vi.fn() }));
const verstuurPush = vi.fn(async (subs: unknown[]) => ({ sent: subs.length, failed: 0, cleaned: 0 }));
vi.mock('../pushNotification', () => ({ verstuurPush: (...a: unknown[]) => verstuurPush(...(a as [unknown[]])) }));

const T = '2026-11-26T13:00:00.000Z';
const op = (min: number) => Date.parse(T) + min * 60_000;

describe('seintje vooraf', () => {
  it('alleen 5 of 15 minuten', () => {
    expect(leesSeintje(5)).toBe(5);
    expect(leesSeintje('15')).toBe(15);
    expect(leesSeintje(10)).toBeNull();
    expect(leesSeintje('')).toBeNull();
    expect(leesSeintje(null)).toBeNull();
  });
  it('pop-up vanaf het seintje tot 30 minuten erna', () => {
    expect(prospectPopupFase({ due_at: T, seintje_min: 5 }, op(-6))).toBeNull();
    expect(prospectPopupFase({ due_at: T, seintje_min: 5 }, op(-5))).toBe('vooraf');
    expect(prospectPopupFase({ due_at: T, seintje_min: 15 }, op(-15))).toBe('vooraf');
    expect(prospectPopupFase({ due_at: T, seintje_min: 15 }, op(-16))).toBeNull();
    expect(prospectPopupFase({ due_at: T, seintje_min: 5 }, op(0))).toBe('nu');
    expect(prospectPopupFase({ due_at: T, seintje_min: 5 }, op(30))).toBe('nu');
    expect(prospectPopupFase({ due_at: T, seintje_min: 5 }, op(31))).toBeNull();
    expect(seintjeNu({ due_at: T, seintje_min: 15 }, new Date(op(-10)))).toBe(true);
    expect(seintjeNu({ due_at: T, seintje_min: 5 }, new Date(op(-10)))).toBe(false);
  });
  it('na verzetten komt het seintje opnieuw, anders niet', () => {
    expect(taakWijzigingen({ due_at: '2026-11-26T14:00:00Z' }, { due_at: T })).toEqual({ herinnerd_op: null });
    expect(taakWijzigingen({ due_at: '2026-11-26T13:00:00+00:00' }, { due_at: T })).toEqual({});
    expect(taakWijzigingen({ seintje_min: 15 }, { due_at: T })).toEqual({ seintje_min: 15, herinnerd_op: null });
    expect(taakWijzigingen({ seintje_min: 'x' }, { due_at: T })).toEqual({ seintje_min: null, herinnerd_op: null });
    expect(taakWijzigingen({ title: 'x' } as never, { due_at: T })).toEqual({});
  });
});

/** Minimale nep-Supabase: één select-lijst en een claim die één keer lukt. */
function nepSupabase(taken: Record<string, unknown>[], subs: Record<string, unknown>[]) {
  const geclaimd = new Set<string>();
  const ketting = (eind: () => unknown) => {
    const k: Record<string, unknown> = {};
    for (const m of ['select', 'is', 'not', 'gte', 'lte', 'order', 'limit', 'eq']) k[m] = (...a: unknown[]) => { void a; return k; };
    k.then = (ok: (v: unknown) => unknown) => Promise.resolve(eind()).then(ok);
    return k;
  };
  return {
    from(tabel: string) {
      if (tabel === 'admin_push_subscriptions') return ketting(() => ({ data: subs, error: null }));
      return {
        ...ketting(() => ({ data: taken, error: null })),
        update() {
          let id = '';
          const k = ketting(() => {
            if (geclaimd.has(id)) return { data: [], error: null };
            geclaimd.add(id);
            return { data: [{ id }], error: null };
          });
          const eq = k.eq as (...a: unknown[]) => unknown;
          k.eq = (kol: unknown, v: unknown) => { if (kol === 'id') id = String(v); return eq(kol, v); };
          return k;
        },
      };
    },
  };
}

describe('pushmelding voor accountmanagers', () => {
  const taak = (id: string, due_at: string, seintje_min: number) => ({
    id, due_at, seintje_min, title: 'Terugbellen', description: 'Over offerte', prospect_id: 'p1', assigned_to_admin_id: 'a1',
    prospect: { company_name: 'Bakkerij Jansen', contact_person: 'Piet', city: 'Zwolle' },
  });
  it('stuurt binnen het seintje, één keer per taak', async () => {
    verstuurPush.mockClear();
    const sb = nepSupabase(
      [taak('t1', T, 15), taak('t2', T, 5)],
      [{ id: 's1', endpoint: 'https://push', p256dh: 'x', auth: 'y' }],
    );
    const nu = new Date(op(-10));
    const eerste = await stuurProspectSeintjes(sb as never, nu);
    expect(eerste).toEqual({ momenten: 1, verstuurd: 1 });
    expect(verstuurPush).toHaveBeenCalledTimes(1);
    const [, payload, tabel] = verstuurPush.mock.calls[0] as unknown as [unknown, { title: string; body: string; url: string }, string];
    expect(payload.title).toBe('Terugbellen om 14:00');
    expect(payload.body).toBe('Bakkerij Jansen · Piet · Over offerte');
    expect(payload.url).toBe('/admin/prospects?id=p1');
    expect(tabel).toBe('admin_push_subscriptions');
    const tweede = await stuurProspectSeintjes(sb as never, nu);
    expect(tweede.momenten).toBe(0);
  });
});

describe('zolang migratie 203 ontbreekt', () => {
  it('herkent de ontbrekende kolom en slaat dan zonder seintje op', async () => {
    const { seintjeKolomOntbreekt, zonderSeintje } = await import('../prospectTerugbellen');
    expect(seintjeKolomOntbreekt({ code: 'PGRST204', message: "Could not find the 'seintje_min' column of 'prospect_tasks'" })).toBe(true);
    expect(seintjeKolomOntbreekt({ code: '42703', message: 'column "herinnerd_op" does not exist' })).toBe(true);
    expect(seintjeKolomOntbreekt({ code: '42703', message: 'column "iets" does not exist' })).toBe(false);
    expect(seintjeKolomOntbreekt(null)).toBe(false);
    expect(zonderSeintje({ due_at: 'x', seintje_min: 5, herinnerd_op: null })).toEqual({ due_at: 'x' });
  });
});
