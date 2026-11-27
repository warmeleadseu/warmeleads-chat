import { describe, expect, it } from 'vitest';
import { bouwAmHistorie, eerdereAms } from '../prospectAmHistorie';

const P = { id: 'p1', created_at: '2026-05-01T10:00:00Z', account_manager_id: 'luigi', assigned_at: '2026-09-01T10:00:00Z' };

describe('bouwAmHistorie', () => {
  it('zonder toewijzingen: alleen de huidige AM sinds aanmaak', () => {
    expect(bouwAmHistorie({ ...P }, [])).toEqual([
      { am_id: 'luigi', vanaf: P.created_at, tot: null, zeker: true },
    ]);
  });

  it('met from: eerste AM vastgelegd, daarna de wissel', () => {
    const h = bouwAmHistorie(P, [
      { type: 'assignment', created_at: '2026-09-01T10:00:00Z', metadata: { from: 'bart', to: 'luigi' }, admin_user_id: 'don' },
    ]);
    expect(h.map(p => [p.am_id, p.vanaf, p.tot, p.zeker])).toEqual([
      ['bart', P.created_at, '2026-09-01T10:00:00Z', true],
      ['luigi', '2026-09-01T10:00:00Z', null, true],
    ]);
    expect(h[1].door).toBe('don');
    expect(eerdereAms(h, 'luigi')).toEqual(['bart']);
  });

  it('oude bulk zonder from: afgeleid uit eerdere contactmomenten', () => {
    const h = bouwAmHistorie(P, [
      { type: 'call', created_at: '2026-06-01T10:00:00Z', metadata: {}, admin_user_id: 'bart' },
      { type: 'created', created_at: '2026-05-01T10:00:00Z', metadata: {}, admin_user_id: 'don' },
      { type: 'assignment', created_at: '2026-09-01T10:00:00Z', metadata: { bulk: true, to: 'luigi' }, admin_user_id: 'don' },
    ]);
    expect(h[0]).toMatchObject({ am_id: 'bart', zeker: false, tot: '2026-09-01T10:00:00Z' });
    expect(h[1]).toMatchObject({ am_id: 'luigi', bulk: true });
  });

  it('oude bulk zonder from en zonder contact: eerste periode niet vastgelegd', () => {
    const h = bouwAmHistorie(P, [
      { type: 'assignment', created_at: '2026-09-01T10:00:00Z', metadata: { bulk: true, to: 'luigi' }, admin_user_id: 'don' },
    ]);
    expect(h[0]).toMatchObject({ am_id: null, onbekend: true });
    expect(eerdereAms(h, 'luigi')).toEqual([]);
  });

  it('dezelfde AM opnieuw toegewezen telt niet als wissel', () => {
    const h = bouwAmHistorie(P, [
      { type: 'assignment', created_at: '2026-06-01T10:00:00Z', metadata: { from: null, to: 'luigi' }, admin_user_id: 'don' },
      { type: 'assignment', created_at: '2026-09-01T10:00:00Z', metadata: { bulk: true, from: 'luigi', to: 'luigi' }, admin_user_id: 'don' },
    ]);
    expect(h.map(p => p.am_id)).toEqual([null, 'luigi']);
    expect(h[1].tot).toBeNull();
  });

  it('huidige AM buiten de knoppen om gewijzigd: extra periode', () => {
    const h = bouwAmHistorie({ ...P, account_manager_id: 'rick', assigned_at: '2026-10-01T10:00:00Z' }, [
      { type: 'assignment', created_at: '2026-09-01T10:00:00Z', metadata: { from: 'bart', to: 'luigi' } },
    ]);
    expect(h.map(p => p.am_id)).toEqual(['bart', 'luigi', 'rick']);
    expect(h[2]).toMatchObject({ vanaf: '2026-10-01T10:00:00Z', zeker: false });
    expect(eerdereAms(h, 'rick')).toEqual(['luigi', 'bart']);
  });
});

describe('bouwAmHistorie: overgezet zonder vastgelegde toewijzing', () => {
  it('leidt de vorige AM af uit wie er vóór de overzetting aan werkte', () => {
    const h = bouwAmHistorie({ id: 'p2', created_at: '2026-05-04T10:00:00Z', account_manager_id: 'luigi', assigned_at: '2026-08-04T09:00:00Z' }, [
      { type: 'import', created_at: '2026-05-04T10:00:00Z', metadata: {}, admin_user_id: 'don' },
      { type: 'status_change', created_at: '2026-05-10T10:00:00Z', metadata: {}, admin_user_id: 'bart' },
      { type: 'note', created_at: '2026-05-11T10:00:00Z', metadata: {}, admin_user_id: 'bart' },
      { type: 'note', created_at: '2026-09-01T10:00:00Z', metadata: {}, admin_user_id: 'luigi' },
    ]);
    expect(h.map(p => [p.am_id, p.tot, p.zeker])).toEqual([
      ['bart', '2026-08-04T09:00:00Z', false],
      ['luigi', null, true],
    ]);
  });

  it('direct bij aanmaak toegewezen: geen afleiding', () => {
    const h = bouwAmHistorie({ id: 'p3', created_at: '2026-05-04T10:00:00Z', account_manager_id: 'luigi', assigned_at: '2026-05-04T10:00:01Z' }, [
      { type: 'note', created_at: '2026-05-05T10:00:00Z', metadata: {}, admin_user_id: 'bart' },
    ]);
    expect(h).toHaveLength(1);
  });
});

describe('eerdereAmsMetNaam', () => {
  it('telt twee accounts met dezelfde naam als één persoon', async () => {
    const { eerdereAmsMetNaam } = await import('../prospectAmHistorie');
    const r = eerdereAmsMetNaam([
      { am_id: 'don-oud', naam: 'Don Keupink', door_naam: null, vanaf: '1', tot: '2', zeker: true },
      { am_id: 'bart', naam: 'Bart-Willem Jansen', door_naam: null, vanaf: '2', tot: '3', zeker: true },
      { am_id: 'don', naam: 'Don Keupink', door_naam: null, vanaf: '3', tot: null, zeker: true },
    ], 'don');
    expect(r).toEqual([{ id: 'bart', naam: 'Bart-Willem Jansen' }]);
  });
});
