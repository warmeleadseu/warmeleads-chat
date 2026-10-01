import { describe, it, expect } from 'vitest';
import {
  batchVroegsteLead,
  leadPastInBatchVenster,
  kiesDerdeKlantLeads,
  DERDE_KLANT_MAX_PER_RONDE,
} from '../verdeelGrenzen';
import { automatischeStatus } from '../restleads';

/* De batch van Deal Dynasty: aangemaakt 30 sep 2026 09:22 (NL), lookback 0. */
const DEAL_DYNASTY = { created_at: '2026-09-30T07:22:57Z', starts_at: null, lookback_days: 0 };

describe('lookback van de batch in de gewone verdeling', () => {
  it('geeft een batch zonder lookback geen leads van vóór zijn start', () => {
    expect(leadPastInBatchVenster({ created_at: '2026-09-28T10:00:00Z' }, DEAL_DYNASTY)).toBe(false);
    expect(leadPastInBatchVenster({ created_at: '2026-09-24T10:00:00Z' }, DEAL_DYNASTY)).toBe(false);
  });

  it('laat leads door die na de start binnenkwamen', () => {
    expect(leadPastInBatchVenster({ created_at: '2026-09-30T14:00:00Z' }, DEAL_DYNASTY)).toBe(true);
  });

  it('rekt het venster op met de lookback', () => {
    const metLookback = { ...DEAL_DYNASTY, lookback_days: 3 };
    expect(leadPastInBatchVenster({ created_at: '2026-09-28T10:00:00Z' }, metLookback)).toBe(true);
    expect(leadPastInBatchVenster({ created_at: '2026-09-26T10:00:00Z' }, metLookback)).toBe(false);
  });

  it('gebruikt een geplande start in plaats van het aanmaakmoment', () => {
    const gepland = { created_at: '2026-09-20T07:00:00Z', starts_at: '2026-10-01T06:00:00Z', lookback_days: 0 };
    expect(batchVroegsteLead(gepland).toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(leadPastInBatchVenster({ created_at: '2026-09-25T10:00:00Z' }, gepland)).toBe(false);
  });

  it('behandelt een lege lookback als nul, en blokkeert geen lead zonder datum', () => {
    expect(leadPastInBatchVenster({ created_at: '2026-09-29T10:00:00Z' }, { ...DEAL_DYNASTY, lookback_days: null })).toBe(false);
    expect(leadPastInBatchVenster({ created_at: null }, DEAL_DYNASTY)).toBe(true);
  });
});

describe('derde klant: alleen vers, en gedoseerd', () => {
  const NU = new Date('2026-09-30T18:17:00Z'); // het moment van de golf
  /* 43 leads van 24 t/m 29 september die al twee klanten hadden. */
  const golf = Array.from({ length: 43 }, (_, i) => ({
    id: `l${i}`,
    created_at: new Date(Date.UTC(2026, 8, 24 + (i % 6), 9 + (i % 10))).toISOString(),
  }));

  it('had van de 43 hooguit een handvol verse leads doorgelaten', () => {
    const gekozen = kiesDerdeKlantLeads(golf, {
      nu: NU, leadsMetKlant: 300, klantenTotaal: 590, streefGemiddelde: 2,
    });
    expect(gekozen.length).toBeLessThanOrEqual(DERDE_KLANT_MAX_PER_RONDE);
    for (const l of gekozen) {
      expect(NU.getTime() - new Date(l.created_at).getTime()).toBeLessThanOrEqual(72 * 3_600_000);
    }
  });

  it('neemt niet meer dan nodig om het gemiddelde op 2 te krijgen', () => {
    const vers = Array.from({ length: 10 }, (_, i) => ({ created_at: new Date(NU.getTime() - i * 3_600_000).toISOString() }));
    /* 100 leads, 199 klanten: er is er precies één nodig. */
    expect(kiesDerdeKlantLeads(vers, { nu: NU, leadsMetKlant: 100, klantenTotaal: 199, streefGemiddelde: 2 })).toHaveLength(1);
    /* Gemiddelde al op 2: niets. */
    expect(kiesDerdeKlantLeads(vers, { nu: NU, leadsMetKlant: 100, klantenTotaal: 200, streefGemiddelde: 2 })).toHaveLength(0);
  });

  it('kiest de nieuwste leads eerst', () => {
    const vers = [
      { created_at: '2026-09-29T10:00:00Z' },
      { created_at: '2026-09-30T17:00:00Z' },
      { created_at: '2026-09-30T09:00:00Z' },
    ];
    const gekozen = kiesDerdeKlantLeads(vers, { nu: NU, leadsMetKlant: 10, klantenTotaal: 10, streefGemiddelde: 2 });
    expect(gekozen.map(l => l.created_at)).toEqual([
      '2026-09-30T17:00:00Z', '2026-09-30T09:00:00Z', '2026-09-29T10:00:00Z',
    ]);
  });

  it('laat leads ouder dan 72 uur nooit door, ook niet bij een groot tekort', () => {
    const oud = [{ created_at: '2026-09-26T10:00:00Z' }, { created_at: '2026-09-25T10:00:00Z' }];
    expect(kiesDerdeKlantLeads(oud, { nu: NU, leadsMetKlant: 100, klantenTotaal: 100, streefGemiddelde: 2 })).toHaveLength(0);
  });
});

describe('Restleads toont de lookbackregel', () => {
  it('noemt een kandidaat-batch die na de lead startte handwerk', () => {
    const s = automatischeStatus(0, { created_at: DEAL_DYNASTY.created_at, lookback_days: 0 }, null, new Date('2026-10-01T08:00:00Z'), '2026-09-28T10:00:00Z');
    expect(s.status).toBe('handwerk');
    expect(s.uitleg).toContain('lookback');
  });
});
