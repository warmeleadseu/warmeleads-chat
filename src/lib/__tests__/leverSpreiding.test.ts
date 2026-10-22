import { describe, expect, it } from 'vitest';
import {
  amsterdamUur, buitenDeNacht, isNacht, isVers, kiesLevering, kiesMoment, ritmeGewicht, trekTijdstippen,
  KORT_VENSTER_MIN, MIN_AFSTAND_MIN, SPREIDING_VENSTER_UREN,
} from '../leverSpreiding';

/** Vaste reeks "willekeurige" getallen, zodat de tests herhaalbaar zijn. */
function zaad(s: number) {
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
const UUR = 3_600_000;

describe('dagritme', () => {
  it('Nederlandse tijd, ook in de wintertijd', () => {
    expect(amsterdamUur(new Date('2026-10-20T12:00:00Z'))).toBe(14);
    expect(amsterdamUur(new Date('2026-11-20T12:00:00Z'))).toBe(13);
  });
  it('overdag gewoon, de nacht bijna leeg', () => {
    expect(ritmeGewicht(10)).toBe(1);
    expect(ritmeGewicht(22)).toBeLessThan(1);
    expect(ritmeGewicht(3)).toBeLessThan(0.05);
  });
});

describe('trekTijdstippen', () => {
  it('binnen het venster, oplopend, op willekeurige seconden en niet vlak na elkaar', () => {
    const start = new Date('2026-10-20T08:00:00Z'); /* 10:00 in Nederland */
    const t = trekTijdstippen(20, { start, vensterMs: 8 * UUR, rng: zaad(1) });
    expect(t).toHaveLength(20);
    for (let i = 0; i < t.length; i++) {
      expect(t[i].getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(t[i].getTime()).toBeLessThan(start.getTime() + 8 * UUR);
      if (i > 0) expect(t[i].getTime() - t[i - 1].getTime()).toBeGreaterThanOrEqual(MIN_AFSTAND_MIN * 60_000 - 1);
    }
    /* Niet op ronde kwartieren: de seconden verschillen. */
    expect(new Set(t.map(d => d.getUTCSeconds())).size).toBeGreaterThan(10);
  });

  it('gelijke afstanden zijn verleden tijd: de tussenpozen verschillen', () => {
    const t = trekTijdstippen(8, { start: new Date('2026-10-20T08:00:00Z'), vensterMs: 8 * UUR, rng: zaad(7) });
    const gaten = t.slice(1).map((d, i) => Math.round((d.getTime() - t[i].getTime()) / 60_000));
    expect(new Set(gaten).size).toBeGreaterThan(4);
  });

  it('venster dat in de nacht valt: vrijwel alles komt na 06:00', () => {
    const start = new Date('2026-10-20T22:00:00Z'); /* middernacht in Nederland */
    let nacht = 0;
    let totaal = 0;
    for (let s = 1; s <= 30; s++) {
      for (const d of trekTijdstippen(10, { start, vensterMs: 2 * UUR, rng: zaad(s) })) {
        totaal++;
        const u = amsterdamUur(d);
        if (u >= 23 || u < 6) nacht++;
      }
    }
    expect(nacht / totaal).toBeLessThan(0.1);
  });

  it('over een heel etmaal: hooguit een paar procent tussen 23:00 en 06:00', () => {
    let nacht = 0;
    let totaal = 0;
    for (let s = 1; s <= 20; s++) {
      for (const d of trekTijdstippen(40, { start: new Date('2026-10-20T10:00:00Z'), vensterMs: 17 * UUR, rng: zaad(s) })) {
        totaal++;
        const u = amsterdamUur(d);
        if (u >= 23 || u < 6) nacht++;
      }
    }
    expect(nacht / totaal).toBeLessThan(0.05);
  });

  it('niets te trekken', () => {
    expect(trekTijdstippen(0, { start: new Date(), vensterMs: UUR })).toEqual([]);
  });
});

describe('kiesLevering', () => {
  it('direct leveren altijd meteen', () => {
    expect(kiesLevering({ vers: false, direct: true, batchKreegAlLeadDezeRonde: true })).toEqual({ soort: 'meteen' });
  });
  it('verse lead, eerste voor de batch: meteen', () => {
    expect(kiesLevering({ vers: true, direct: false, batchKreegAlLeadDezeRonde: false })).toEqual({ soort: 'meteen' });
  });
  it('verse lead, batch kreeg deze ronde al een lead: kort verspreid', () => {
    expect(kiesLevering({ vers: true, direct: false, batchKreegAlLeadDezeRonde: true })).toEqual({ soort: 'spreiden', vensterMs: KORT_VENSTER_MIN * 60_000 });
  });
  it('oudere lead: verspreid over een paar uur', () => {
    expect(kiesLevering({ vers: false, direct: false, batchKreegAlLeadDezeRonde: false })).toEqual({ soort: 'spreiden', vensterMs: SPREIDING_VENSTER_UREN * UUR });
  });
});

describe('isVers en kiesMoment', () => {
  const nu = new Date('2026-10-20T10:00:00Z');
  it('tot 30 minuten vers', () => {
    expect(isVers(new Date(nu.getTime() - 29 * 60_000).toISOString(), nu)).toBe(true);
    expect(isVers(new Date(nu.getTime() - 31 * 60_000).toISOString(), nu)).toBe(false);
    expect(isVers(null, nu)).toBe(false);
  });
  it('niet vlak op een moment dat al klaarstaat', () => {
    const bezet = [new Date(nu.getTime() + 10 * 60_000), new Date(nu.getTime() + 20 * 60_000)];
    for (let s = 1; s < 20; s++) {
      const m = kiesMoment({ nu, vensterMs: UUR, bezet, rng: zaad(s) });
      expect(m.getTime()).toBeGreaterThanOrEqual(nu.getTime());
      for (const b of bezet) expect(Math.abs(b.getTime() - m.getTime())).toBeGreaterThanOrEqual(MIN_AFSTAND_MIN * 60_000);
    }
  });
});

describe('buitenDeNacht', () => {
  it('overdag ongewijzigd', () => {
    const t = new Date('2026-10-20T12:00:00Z');
    expect(buitenDeNacht(t)).toBe(t);
  });
  it('nacht: naar 07:00 tot 08:30 dezelfde of de volgende ochtend', () => {
    for (const iso of ['2026-10-20T21:30:00Z', '2026-10-20T23:59:00Z', '2026-10-21T03:00:00Z', '2026-11-20T04:30:00Z']) {
      const uit = buitenDeNacht(new Date(iso), zaad(3));
      expect(isNacht(uit)).toBe(false);
      expect([7, 8]).toContain(amsterdamUur(uit));
      expect(uit.getTime()).toBeGreaterThan(new Date(iso).getTime());
      expect(uit.getTime() - new Date(iso).getTime()).toBeLessThan(11 * 3_600_000);
    }
  });
});
