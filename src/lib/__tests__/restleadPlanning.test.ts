import { describe, it, expect } from 'vitest';
import { planMomenten, naarWerkbaarMoment, beschrijfMoment, dagSleutel, COOLDOWN_UREN, VROEGSTE_UUR, SPREIDING_UREN } from '../restleadPlanning';

const NU = new Date('2026-09-24T10:00:00');

describe('naarWerkbaarMoment', () => {
  it('laat een moment overdag met rust', () => {
    const d = new Date('2026-09-24T14:00:00');
    expect(naarWerkbaarMoment(d).getHours()).toBe(14);
  });

  it('schuift een nachtelijk moment naar 08:00 diezelfde ochtend', () => {
    const d = new Date('2026-09-24T03:00:00');
    const r = naarWerkbaarMoment(d);
    expect(r.getHours()).toBe(8);
    expect(r.getDate()).toBe(24);
  });

  it('schuift een avondmoment naar de volgende ochtend', () => {
    /* Een lead die om 23:00 binnenkomt wordt toch pas 's ochtends gebeld. */
    const d = new Date('2026-09-24T23:00:00');
    const r = naarWerkbaarMoment(d);
    expect(r.getHours()).toBe(8);
    expect(r.getDate()).toBe(25);
  });
});

describe('planMomenten', () => {
  it('levert de eerste meteen als de lead nog nergens stond', () => {
    const [eerste] = planMomenten({ laatsteToewijzing: null, aantal: 1, nu: NU });
    expect(eerste.getTime()).toBe(NU.getTime());
  });

  it('houdt 12 uur tussen opeenvolgende leveringen', () => {
    const m = planMomenten({ laatsteToewijzing: null, aantal: 3, nu: NU });
    expect(m).toHaveLength(3);
    const uur1 = (m[1].getTime() - m[0].getTime()) / 3600_000;
    expect(uur1).toBeGreaterThanOrEqual(COOLDOWN_UREN);
  });

  it('wacht niet opnieuw als de vorige toewijzing al lang geleden is', () => {
    /* Kreeg de lead drie dagen geleden al een klant, dan is de cooldown
       allang verstreken en mag de eerste gewoon nu. */
    const driedagen = new Date(NU.getTime() - 3 * 86_400_000);
    const [eerste] = planMomenten({ laatsteToewijzing: driedagen, aantal: 1, nu: NU });
    expect(eerste.getTime()).toBe(NU.getTime());
  });

  it('wacht wel als de vorige toewijzing net is geweest', () => {
    const uurGeleden = new Date(NU.getTime() - 3600_000);
    const [eerste] = planMomenten({ laatsteToewijzing: uurGeleden, aantal: 1, nu: NU });
    expect(eerste.getTime()).toBeGreaterThan(NU.getTime());
    expect((eerste.getTime() - uurGeleden.getTime()) / 3600_000).toBeGreaterThanOrEqual(COOLDOWN_UREN - 0.01);
  });

  it('plant nooit midden in de nacht', () => {
    const avond = new Date('2026-09-24T19:00:00');
    const m = planMomenten({ laatsteToewijzing: null, aantal: 3, nu: avond });
    for (const d of m) {
      expect(d.getHours()).toBeGreaterThanOrEqual(8);
      expect(d.getHours()).toBeLessThan(20);
    }
  });

  it('geeft een lege lijst bij nul leveringen', () => {
    expect(planMomenten({ laatsteToewijzing: null, aantal: 0, nu: NU })).toEqual([]);
  });
});

describe('beschrijfMoment', () => {
  it('noemt nu, vandaag en morgen', () => {
    expect(beschrijfMoment(NU, NU)).toBe('nu');
    expect(beschrijfMoment(new Date('2026-09-24T16:00:00'), NU)).toBe('vandaag 16:00');
    expect(beschrijfMoment(new Date('2026-09-25T08:00:00'), NU)).toBe('morgen 08:00');
  });

  it('noemt de dag bij verder weg', () => {
    expect(beschrijfMoment(new Date('2026-09-27T08:00:00'), NU)).toContain('08:00');
  });
});

describe('dagplafond van de klant', () => {
  const NU2 = new Date('2026-09-25T09:00:00');

  it('plant zonder plafond gewoon door', () => {
    const m = planMomenten({ laatsteToewijzing: null, aantal: 2, nu: NU2 });
    expect(m).toHaveLength(2);
  });

  it('schuift naar de volgende dag als de klant die dag vol zit', () => {
    /* Plafond 1 en er staat er al een vandaag: de nieuwe moet naar morgen. */
    const m = planMomenten({
      laatsteToewijzing: null, aantal: 1, nu: NU2,
      dagplafond: 1, alGepland: { '2026-09-25': 1 },
    });
    expect(dagSleutel(m[0])).toBe('2026-09-26');
    expect(m[0].getHours()).toBe(8);
  });

  it('telt de eigen planning mee, zodat je er niet overheen plant', () => {
    /* Drie leveringen bij een plafond van 1 moeten op drie verschillende dagen
       landen; zou de eigen planning niet meetellen, dan kwamen ze op dezelfde. */
    const m = planMomenten({ laatsteToewijzing: null, aantal: 3, nu: NU2, dagplafond: 1 });
    const dagen = m.map(dagSleutel);
    expect(new Set(dagen).size).toBe(3);
  });

  it('vult een dag tot het plafond voordat hij doorschuift', () => {
    const m = planMomenten({ laatsteToewijzing: null, aantal: 4, nu: NU2, dagplafond: 5 });
    /* De cooldown van 12 uur verdeelt ze al over dagen; het plafond mag daar
       niets extra's aan toevoegen zolang er ruimte is. */
    const perDag: Record<string, number> = {};
    for (const d of m) perDag[dagSleutel(d)] = (perDag[dagSleutel(d)] ?? 0) + 1;
    expect(Object.values(perDag).every(n => n <= 5)).toBe(true);
  });

  it('loopt niet vast bij een plafond van nul', () => {
    /* Nul betekent "geen plafond", niet "nooit leveren". */
    const m = planMomenten({ laatsteToewijzing: null, aantal: 2, nu: NU2, dagplafond: 0 });
    expect(m).toHaveLength(2);
    expect(dagSleutel(m[0])).toBe('2026-09-25');
  });

  it('respecteert het plafond ook als de dag al vol zat bij binnenkomst', () => {
    const m = planMomenten({
      laatsteToewijzing: null, aantal: 2, nu: NU2,
      dagplafond: 2, alGepland: { '2026-09-25': 2, '2026-09-26': 2 },
    });
    expect(dagSleutel(m[0])).toBe('2026-09-27');
  });
});

describe('uitsmeren over vier uur', () => {
  it('zet opeenvolgende leveringen niet allemaal op 08:00', () => {
    /* Dit was de klacht: deel je er vijftig uit, dan stonden ze allemaal op
       precies 08:00 en kreeg de klant ze in één klap binnen. */
    const bezet: Record<string, number> = {};
    const momenten: Date[] = [];
    const nu = new Date('2026-09-25T22:00:00');
    for (let i = 0; i < 5; i++) {
      const [m] = planMomenten({ laatsteToewijzing: null, aantal: 1, nu, alGepland: { ...bezet } });
      momenten.push(m);
      const d = dagSleutel(m);
      bezet[d] = (bezet[d] ?? 0) + 1;
    }
    const tijden = momenten.map((m) => `${m.getHours()}:${String(m.getMinutes()).padStart(2, '0')}`);
    expect(tijden).toEqual(['8:00', '8:10', '8:20', '8:30', '8:40']);
    expect(new Set(tijden).size).toBe(5);
  });

  it('blijft binnen het venster van vier uur', () => {
    const bezet: Record<string, number> = {};
    const nu = new Date('2026-09-25T22:00:00');
    let laatste: Date | null = null;
    for (let i = 0; i < 40; i++) {
      const [m] = planMomenten({ laatsteToewijzing: null, aantal: 1, nu, alGepland: { ...bezet } });
      const d = dagSleutel(m);
      bezet[d] = (bezet[d] ?? 0) + 1;
      laatste = m;
    }
    expect(laatste!.getHours()).toBeGreaterThanOrEqual(VROEGSTE_UUR);
    expect(laatste!.getHours()).toBeLessThan(VROEGSTE_UUR + SPREIDING_UREN);
  });

  it('laat een moment binnen werktijd ongemoeid', () => {
    /* Wie om 14:00 uitdeelt wil dat het om 14:00 gebeurt, niet morgenvroeg. */
    const nu = new Date('2026-09-25T14:00:00');
    const [m] = planMomenten({ laatsteToewijzing: null, aantal: 1, nu });
    expect(m.getHours()).toBe(14);
    expect(m.getMinutes()).toBe(0);
  });
});
