import { describe, it, expect } from 'vitest';
import {
  planMomenten,
  naarWerkbaarMoment,
  beschrijfMoment,
  dagSleutel,
  herverdeel,
  nlKlok,
  nlMoment,
  COOLDOWN_UREN,
  VROEGSTE_UUR,
  LAATSTE_UUR,
  type WachtrijItem,
} from '../restleadPlanning';

/* Alle tijden in UTC (…Z), zodat de tests hetzelfde uitvallen op een laptop in
   Nederland en op een server in UTC. Dat verschil was precies de fout: de code
   rekende in servertijd, waardoor 08:00 bij de klant 10:00 werd. */

/** 24 sep 2026, 12:00 in Nederland (zomertijd, UTC+2). */
const NU = new Date('2026-09-24T10:00:00Z');

const klok = (d: Date) => {
  const k = nlKlok(d);
  return `${k.uur}:${String(k.minuut).padStart(2, '0')}`;
};

describe('Nederlandse tijd', () => {
  it('zet een Nederlandse kloktijd om naar het juiste moment, zomer en winter', () => {
    expect(nlMoment(2026, 9, 26, 9).toISOString()).toBe('2026-09-26T07:00:00.000Z');
    expect(nlMoment(2026, 12, 1, 9).toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });

  it('rolt een dag voorbij het maandeinde netjes door', () => {
    expect(dagSleutel(nlMoment(2026, 9, 31, 12))).toBe('2026-10-01');
  });

  it('telt de dag in Nederlandse tijd, niet in UTC', () => {
    /* 23:30 UTC is in Nederland al de volgende dag. */
    expect(dagSleutel(new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-25');
  });
});

describe('naarWerkbaarMoment', () => {
  it('laat een moment overdag met rust', () => {
    const d = new Date('2026-09-24T12:00:00Z'); // 14:00 NL
    expect(naarWerkbaarMoment(d).getTime()).toBe(d.getTime());
  });

  it('schuift een nachtelijk moment naar 09:00 Nederlandse tijd diezelfde ochtend', () => {
    const r = naarWerkbaarMoment(new Date('2026-09-24T01:00:00Z')); // 03:00 NL
    expect(klok(r)).toBe('9:00');
    expect(dagSleutel(r)).toBe('2026-09-24');
  });

  it('schuift een avondmoment naar de volgende ochtend', () => {
    const r = naarWerkbaarMoment(new Date('2026-09-24T16:30:00Z')); // 18:30 NL
    expect(klok(r)).toBe('9:00');
    expect(dagSleutel(r)).toBe('2026-09-25');
  });

  it('levert niet meer om 20:48 zoals in de oude wachtrij', () => {
    const r = naarWerkbaarMoment(new Date('2026-09-25T18:48:00Z')); // 20:48 NL
    expect(dagSleutel(r)).toBe('2026-09-26');
    expect(nlKlok(r).uur).toBe(VROEGSTE_UUR);
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
    for (let i = 1; i < m.length; i++) {
      expect((m[i].getTime() - m[i - 1].getTime()) / 3600_000).toBeGreaterThanOrEqual(COOLDOWN_UREN);
    }
  });

  it('wacht niet opnieuw als de vorige toewijzing al lang geleden is', () => {
    const driedagen = new Date(NU.getTime() - 3 * 86_400_000);
    const [eerste] = planMomenten({ laatsteToewijzing: driedagen, aantal: 1, nu: NU });
    expect(eerste.getTime()).toBe(NU.getTime());
  });

  it('wacht wel als de vorige toewijzing net is geweest', () => {
    const uurGeleden = new Date(NU.getTime() - 3600_000);
    const [eerste] = planMomenten({ laatsteToewijzing: uurGeleden, aantal: 1, nu: NU });
    expect((eerste.getTime() - uurGeleden.getTime()) / 3600_000).toBeGreaterThanOrEqual(COOLDOWN_UREN);
  });

  it('plant alleen binnen werktijd, in Nederlandse tijd', () => {
    const avond = new Date('2026-09-24T17:00:00Z'); // 19:00 NL
    for (const d of planMomenten({ laatsteToewijzing: null, aantal: 3, nu: avond })) {
      expect(nlKlok(d).uur).toBeGreaterThanOrEqual(VROEGSTE_UUR);
      expect(nlKlok(d).uur).toBeLessThan(LAATSTE_UUR);
    }
  });

  it('geeft een lege lijst bij nul leveringen', () => {
    expect(planMomenten({ laatsteToewijzing: null, aantal: 0, nu: NU })).toEqual([]);
  });
});

describe('dagplafond van de klant', () => {
  const NU2 = new Date('2026-09-25T08:00:00Z'); // 10:00 NL

  it('schuift naar de volgende ochtend als de klant die dag vol zit', () => {
    const [m] = planMomenten({
      laatsteToewijzing: null, aantal: 1, nu: NU2,
      dagplafond: 1, alGepland: { '2026-09-25': 1 },
    });
    expect(dagSleutel(m)).toBe('2026-09-26');
    expect(klok(m)).toBe('9:00');
  });

  it('telt de eigen planning mee, zodat je er niet overheen plant', () => {
    const m = planMomenten({ laatsteToewijzing: null, aantal: 3, nu: NU2, dagplafond: 1 });
    expect(new Set(m.map(dagSleutel)).size).toBe(3);
  });

  it('loopt niet vast bij een plafond van nul', () => {
    const m = planMomenten({ laatsteToewijzing: null, aantal: 2, nu: NU2, dagplafond: 0 });
    expect(m).toHaveLength(2);
    expect(dagSleutel(m[0])).toBe('2026-09-25');
  });

  it('respecteert het plafond ook als de dag al vol zat bij binnenkomst', () => {
    const [m] = planMomenten({
      laatsteToewijzing: null, aantal: 1, nu: NU2,
      dagplafond: 2, alGepland: { '2026-09-25': 2, '2026-09-26': 2 },
    });
    expect(dagSleutel(m)).toBe('2026-09-27');
  });
});

describe('herverdeel over de werkdag', () => {
  /* De situatie van de klacht: elf leveringen voor één klant, allemaal op
     26 september om 10:00, ingepland op de avond ervoor. */
  const avondErvoor = new Date('2026-09-25T19:00:00Z');
  const tienUur = new Date('2026-09-26T08:00:00Z');
  const elf: WachtrijItem[] = Array.from({ length: 11 }, (_, i) => ({
    id: `rij-${i}`,
    customer_id: 'eco',
    gepland: tienUur,
    vroegst: avondErvoor,
  }));

  it('zet ze niet meer allemaal op hetzelfde moment', () => {
    const nieuw = herverdeel(elf, avondErvoor);
    const tijden = elf.map(r => (nieuw.get(r.id) ?? r.gepland).getTime());
    expect(new Set(tijden).size).toBe(11);
  });

  it('houdt ze binnen 09:00–17:00 Nederlandse tijd op dezelfde dag', () => {
    const nieuw = herverdeel(elf, avondErvoor);
    for (const r of elf) {
      const m = nieuw.get(r.id) ?? r.gepland;
      expect(dagSleutel(m)).toBe('2026-09-26');
      expect(nlKlok(m).uur).toBeGreaterThanOrEqual(VROEGSTE_UUR);
      expect(nlKlok(m).uur).toBeLessThan(LAATSTE_UUR);
    }
  });

  it('verdeelt ze gelijkmatig: geen gaten van uren en geen propjes', () => {
    const nieuw = herverdeel(elf, avondErvoor);
    const tijden = elf.map(r => nieuw.get(r.id)!.getTime()).sort((a, b) => a - b);
    const gaten = tijden.slice(1).map((t, i) => (t - tijden[i]) / 60_000);
    /* Acht uur over elf leveringen is ruim 43 minuten; de variatie is klein. */
    expect(Math.min(...gaten)).toBeGreaterThan(25);
    expect(Math.max(...gaten)).toBeLessThan(60);
  });

  it('houdt klanten apart: elke klant krijgt zijn eigen verdeling', () => {
    const twee: WachtrijItem[] = [
      { id: 'a1', customer_id: 'a', gepland: tienUur, vroegst: avondErvoor },
      { id: 'a2', customer_id: 'a', gepland: tienUur, vroegst: avondErvoor },
      { id: 'b1', customer_id: 'b', gepland: tienUur, vroegst: avondErvoor },
    ];
    const nieuw = herverdeel(twee, avondErvoor);
    const a = ['a1', 'a2'].map(id => nieuw.get(id)!.getTime());
    expect(Math.abs(a[0] - a[1]) / 3600_000).toBeGreaterThan(3);
  });

  it('zet niets vóór de cooldown', () => {
    const vroegst = new Date('2026-09-26T13:00:00Z'); // 15:00 NL
    const items: WachtrijItem[] = [
      { id: 'x', customer_id: 'c', gepland: tienUur, vroegst },
      { id: 'y', customer_id: 'c', gepland: tienUur, vroegst: avondErvoor },
      { id: 'z', customer_id: 'c', gepland: tienUur, vroegst: avondErvoor },
    ];
    const nieuw = herverdeel(items, avondErvoor);
    expect((nieuw.get('x') ?? tienUur).getTime()).toBeGreaterThanOrEqual(vroegst.getTime());
  });

  it('zet niets in het verleden of vlak voor nu', () => {
    const nu = new Date('2026-09-26T11:00:00Z'); // 13:00 NL
    const items: WachtrijItem[] = [
      { id: 'p', customer_id: 'c', gepland: new Date('2026-09-26T12:00:00Z'), vroegst: nu },
      { id: 'q', customer_id: 'c', gepland: new Date('2026-09-26T12:00:00Z'), vroegst: nu },
    ];
    const nieuw = herverdeel(items, nu);
    for (const id of ['p', 'q']) {
      expect(nieuw.get(id)!.getTime()).toBeGreaterThan(nu.getTime());
    }
  });

  it('verplaatst één losse levering alleen als die buiten werktijd valt', () => {
    const overdag: WachtrijItem = { id: 'o', customer_id: 'c', gepland: new Date('2026-09-26T12:10:00Z'), vroegst: NU };
    expect(herverdeel([overdag], NU).size).toBe(0);

    const avond: WachtrijItem = { id: 'e', customer_id: 'c', gepland: new Date('2026-09-25T18:48:00Z'), vroegst: NU };
    const m = herverdeel([avond], NU).get('e')!;
    expect(dagSleutel(m)).toBe('2026-09-26');
    expect(klok(m)).toBe('9:00');
  });

  it('geeft bij een tweede keer draaien hetzelfde resultaat', () => {
    const eerste = herverdeel(elf, avondErvoor);
    const na = elf.map(r => ({ ...r, gepland: eerste.get(r.id)! }));
    expect(herverdeel(na, avondErvoor).size).toBe(0);
  });
});

describe('beschrijfMoment', () => {
  it('noemt nu, vandaag en morgen in Nederlandse tijd', () => {
    expect(beschrijfMoment(NU, NU)).toBe('nu');
    expect(beschrijfMoment(new Date('2026-09-24T14:00:00Z'), NU)).toBe('vandaag 16:00');
    expect(beschrijfMoment(new Date('2026-09-25T07:00:00Z'), NU)).toBe('morgen 09:00');
  });

  it('noemt de dag bij verder weg', () => {
    expect(beschrijfMoment(new Date('2026-09-27T07:00:00Z'), NU)).toContain('09:00');
  });
});
