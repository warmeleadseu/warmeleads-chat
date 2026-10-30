import { describe, expect, it } from 'vitest';
import { STAFFEL_NOTITIE, groepeerStaffels, leesStaffels, maandTargets, ontbrekend, type StaffelInstelling } from '../amStaffel';

/* De standaardstaffel van Luigi Pani (30 okt 2026). */
const LUIGI: StaffelInstelling = {
  admin_user_id: 'luigi',
  target_type: 'revenue',
  vanaf: '2026-11',
  treden: [
    { waarde: 12500, bonus: 500 }, { waarde: 17500, bonus: 750 }, { waarde: 22500, bonus: 1000 },
    { waarde: 27500, bonus: 1250 }, { waarde: 35000, bonus: 1500 },
  ],
};

describe('bonusstaffels', () => {
  it('leest de opgeslagen staffels en laat ongeldige weg', () => {
    expect(leesStaffels(JSON.stringify([LUIGI]))).toEqual([LUIGI]);
    expect(leesStaffels(JSON.stringify([{ ...LUIGI, treden: [{ waarde: 17500, bonus: 750 }, { waarde: 12500, bonus: 500 }] }]))[0].treden[0].waarde).toBe(12500);
    expect(leesStaffels(JSON.stringify([{ ...LUIGI, vanaf: 'november' }]))).toEqual([]);
    expect(leesStaffels(JSON.stringify([{ ...LUIGI, target_type: 'iets' }]))).toEqual([]);
    expect(leesStaffels('geen json')).toEqual([]);
    expect(leesStaffels(null)).toEqual([]);
  });

  it('maakt per maand de treden als targets aan, pas vanaf de startmaand', () => {
    expect(maandTargets(LUIGI, '2026-10')).toEqual([]);
    const nov = maandTargets(LUIGI, '2026-11');
    expect(nov).toHaveLength(5);
    expect(nov[0]).toMatchObject({
      label: 'Omzet november 2026 · trede 1/5', target_type: 'revenue', target_value: 12500, bonus_amount: 500,
      period_start: '2026-11-01', period_end: '2026-11-30', notes: STAFFEL_NOTITIE, status: 'active',
    });
    expect(maandTargets(LUIGI, '2027-02')[0].period_end).toBe('2027-02-28');
    expect(maandTargets(LUIGI, '2026-12')[4]).toMatchObject({ target_value: 35000, bonus_amount: 1500, period_end: '2026-12-31' });
  });

  it('maakt nooit dubbel aan', () => {
    const nov = maandTargets(LUIGI, '2026-11');
    const bestaand = nov.slice(0, 2).map(t => ({ ...t, target_value: String(t.target_value) }));
    expect(ontbrekend(nov, bestaand).map(t => t.target_value)).toEqual([22500, 27500, 35000]);
    expect(ontbrekend(nov, nov)).toEqual([]);
  });

  it('toont de staffel als één regel met de bonus van de hoogste gehaalde trede', () => {
    const targets = maandTargets(LUIGI, '2026-11').map((t, i) => ({
      ...t, id: `t${i}`, am_name: 'Luigi Pani', current_value: 23000,
    }));
    const los = { id: 'los', admin_user_id: 'sanne', am_name: 'Sanne', target_type: 'revenue', target_value: 20000, bonus_amount: 500, current_value: 5000, period_start: '2026-11-01', period_end: '2026-11-30', notes: null };
    const g = groepeerStaffels([...targets, los]);
    expect(g).toHaveLength(2);
    const s = g.find(x => x.soort === 'staffel');
    expect(s).toMatchObject({ am_name: 'Luigi Pani', huidig: 23000, bonus: 1000, volgende: { waarde: 27500, bonus: 1250, nog: 4500 } });
    expect(s && s.soort === 'staffel' && s.treden.map(t => t.gehaald)).toEqual([true, true, true, false, false]);
    expect(g.find(x => x.soort === 'los')).toMatchObject({ target: { id: 'los' } });
    /* Nog niets gehaald, en alles gehaald. */
    const niets = groepeerStaffels(targets.map(t => ({ ...t, current_value: 1000 })))[0];
    expect(niets).toMatchObject({ bonus: 0, volgende: { waarde: 12500, nog: 11500 } });
    const alles = groepeerStaffels(targets.map(t => ({ ...t, current_value: 40000 })))[0];
    expect(alles).toMatchObject({ bonus: 1500, volgende: null });
  });
});
