import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leadVoorTerugzetten, quarantaineReden, vrijgegevenLeadIds, zetInQuarantaine } from '../leadQuarantaine';
import { checkLeadProfanity } from '../profanityFilter';

/** Minimale nep-Supabase: elke query-keten eindigt in het volgende antwoord uit de rij. */
function nepDb(antwoorden: { data?: unknown; error?: { code?: string; message: string } | null }[]) {
  const aanroepen: { tabel: string; stappen: [string, unknown[]][] }[] = [];
  const db = {
    from(tabel: string) {
      const aanroep = { tabel, stappen: [] as [string, unknown[]][] };
      aanroepen.push(aanroep);
      const antwoord = antwoorden.shift() ?? { data: null, error: null };
      const keten: Record<string, unknown> = {};
      for (const m of ['select', 'insert', 'update', 'eq', 'in', 'limit', 'single', 'maybeSingle']) {
        keten[m] = (...args: unknown[]) => { aanroep.stappen.push([m, args]); return keten; };
      }
      keten.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...antwoord }).then(ok);
      return keten;
    },
  };
  return { db: db as unknown as SupabaseClient, aanroepen };
}

describe('quarantaineReden', () => {
  it('noemt woord en veld', () => {
    const p = checkLeadProfanity({ naam_klant: 'Jan Pik' });
    expect(p.blocked).toBe(true);
    expect(quarantaineReden(p)).toBe('"pik" in naam_klant');
  });
  it('valt terug zonder veld', () => {
    expect(quarantaineReden({ blocked: true })).toBe('ongepast woord');
  });
});

describe('leadVoorTerugzetten', () => {
  it('laat is_assigned weg en begint zonder toewijzingen', () => {
    const rij = leadVoorTerugzetten({ id: 'a', naam_klant: 'X', is_assigned: true, assigned_customer_ids: ['k1'] });
    expect(rij).toEqual({ id: 'a', naam_klant: 'X', assigned_customer_ids: [] });
  });
  it('voegt assigned_customer_ids niet toe als die er niet was (webhooklead)', () => {
    expect(leadVoorTerugzetten({ naam_klant: 'X' })).toEqual({ naam_klant: 'X' });
  });
  it('wijzigt het origineel niet', () => {
    const lead = { is_assigned: true };
    leadVoorTerugzetten(lead);
    expect(lead).toEqual({ is_assigned: true });
  });
});

describe('zetInQuarantaine', () => {
  it('slaat de lead op met route, reden en Meta-id', async () => {
    const { db, aanroepen } = nepDb([{ data: { id: 'q1' } }]);
    const r = await zetInQuarantaine(db, { route: 'webhook', reden: '"pik" in naam_klant', lead: { naam_klant: 'Jan Pik' }, metaLeadgenId: 'm1' });
    expect(r).toEqual({ ok: true, id: 'q1', bestond: false });
    const insert = aanroepen[0].stappen.find(([m]) => m === 'insert')![1][0];
    expect(insert).toMatchObject({ route: 'webhook', meta_leadgen_id: 'm1', oorspronkelijk_lead_id: null, lead: { naam_klant: 'Jan Pik' } });
  });

  it('dezelfde Meta-lead nog eens telt als bewaard', async () => {
    const { db } = nepDb([{ data: null, error: { code: '23505', message: 'duplicate' } }]);
    const r = await zetInQuarantaine(db, { route: 'meta_inhaalslag', reden: 'x', lead: {}, metaLeadgenId: 'm1' });
    expect(r).toEqual({ ok: true, id: null, bestond: true });
  });

  it('een andere fout is niet bewaard: de lead mag dan niet weg', async () => {
    const { db } = nepDb([{ data: null, error: { code: '42P01', message: 'kapot' } }]);
    const r = await zetInQuarantaine(db, { route: 'webhook', reden: 'x', lead: {} });
    expect(r.ok).toBe(false);
    expect(r.fout).toBe('kapot');
  });

  it('maakt geen tweede rij voor een lead die al open in quarantaine staat', async () => {
    const { db, aanroepen } = nepDb([{ data: [{ id: 'q0' }] }]);
    const r = await zetInQuarantaine(db, { route: 'verdeel_cron', reden: 'x', lead: {}, oorspronkelijkLeadId: 'l1' });
    expect(r).toEqual({ ok: true, id: 'q0', bestond: true });
    expect(aanroepen).toHaveLength(1);
  });

  it('verdeel-cron: nog niet in quarantaine, dan opslaan', async () => {
    const { db, aanroepen } = nepDb([{ data: [] }, { data: { id: 'q2' } }]);
    const r = await zetInQuarantaine(db, { route: 'verdeel_cron', reden: 'x', lead: { id: 'l1' }, oorspronkelijkLeadId: 'l1' });
    expect(r).toEqual({ ok: true, id: 'q2', bestond: false });
    expect(aanroepen).toHaveLength(2);
  });
});

describe('vrijgegevenLeadIds', () => {
  it('vraagt in porties van 150 op', async () => {
    const ids = Array.from({ length: 320 }, (_, i) => `l${i}`);
    const { db, aanroepen } = nepDb([
      { data: [{ vrijgegeven_lead_id: 'l3' }] },
      { data: [] },
      { data: [{ vrijgegeven_lead_id: 'l310' }] },
    ]);
    const uit = await vrijgegevenLeadIds(db, ids);
    expect([...uit].sort()).toEqual(['l3', 'l310']);
    expect(aanroepen).toHaveLength(3);
  });
});
