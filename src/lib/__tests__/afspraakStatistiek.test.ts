import { describe, it, expect } from 'vitest';
import { berekenStatistiek, berekenPerSleutel, topRedenen, type StatistiekAfspraak } from '../afspraakStatistiek';

const NU = new Date('2026-09-22T12:00:00.000Z');
const VERLEDEN = '2026-09-20T10:00:00.000Z';
const TOEKOMST = '2026-09-25T10:00:00.000Z';

function a(over: Partial<StatistiekAfspraak> = {}): StatistiekAfspraak {
  return { status: 'scheduled', starts_at: TOEKOMST, ...over };
}

describe('berekenStatistiek', () => {
  it('telt niets bij een lege lijst en deelt niet door nul', () => {
    const s = berekenStatistiek([], NU);
    expect(s.totaal).toBe(0);
    expect(s.conversiePct).toBe(0);
    expect(s.noShowPct).toBe(0);
    expect(s.gemiddeldeDeal).toBe(0);
  });

  it('telt per status', () => {
    const s = berekenStatistiek([
      a({ status: 'scheduled' }),
      a({ status: 'completed' }),
      a({ status: 'no_show' }),
      a({ status: 'cancelled' }),
      a({ status: 'rescheduled' }),
    ], NU);
    expect([s.ingepland, s.bezocht, s.nietVerschenen, s.geannuleerd, s.verzet]).toEqual([1, 1, 1, 1, 1]);
    expect(s.totaal).toBe(5);
  });

  it('telt alleen verstreken ingeplande afspraken als openstaand', () => {
    const s = berekenStatistiek([
      a({ starts_at: VERLEDEN }),
      a({ starts_at: TOEKOMST }),
      a({ status: 'completed', starts_at: VERLEDEN }),
    ], NU);
    expect(s.openstaand).toBe(1);
  });

  it('telt omzet op en middelt over deals mét bedrag', () => {
    /* Een deal zonder bedrag mag het gemiddelde niet omlaag trekken: het
       bedrag is onbekend, niet nul. */
    const s = berekenStatistiek([
      a({ status: 'completed', outcome: 'deal', deal_value: 8000 }),
      a({ status: 'completed', outcome: 'deal', deal_value: 4000 }),
      a({ status: 'completed', outcome: 'deal', deal_value: null }),
    ], NU);
    expect(s.deals).toBe(3);
    expect(s.omzet).toBe(12000);
    expect(s.gemiddeldeDeal).toBe(6000);
  });

  it('rekent conversie over de bezochte afspraken', () => {
    const s = berekenStatistiek([
      a({ status: 'completed', outcome: 'deal' }),
      a({ status: 'completed', outcome: 'no_deal', outcome_reason: 'prijs' }),
      a({ status: 'completed', outcome: 'follow_up' }),
      a({ status: 'completed', outcome: 'deal' }),
      a({ status: 'no_show' }),
    ], NU);
    expect(s.bezocht).toBe(4);
    expect(s.conversiePct).toBe(50);
  });

  it('laat een geannuleerde afspraak buiten het no-showpercentage', () => {
    /* Vooraf afzeggen is geen no-show. Zou die meetellen in de noemer, dan
       lijkt het probleem kleiner dan het is. */
    const s = berekenStatistiek([
      a({ status: 'completed' }),
      a({ status: 'no_show' }),
      a({ status: 'cancelled' }),
      a({ status: 'cancelled' }),
    ], NU);
    expect(s.noShowPct).toBe(50);
  });

  it('negeert een uitkomst op een afspraak die niet bezocht is', () => {
    const s = berekenStatistiek([a({ status: 'no_show', outcome: 'deal', deal_value: 9999 })], NU);
    expect(s.deals).toBe(0);
    expect(s.omzet).toBe(0);
  });

  it('rondt percentages af op één decimaal', () => {
    const s = berekenStatistiek([
      a({ status: 'completed', outcome: 'deal' }),
      a({ status: 'completed', outcome: 'no_deal', outcome_reason: 'prijs' }),
      a({ status: 'completed', outcome: 'no_deal', outcome_reason: 'prijs' }),
    ], NU);
    expect(s.conversiePct).toBe(33.3);
  });
});

describe('berekenPerSleutel', () => {
  it('splitst per branche en sorteert op aantal', () => {
    const rijen = berekenPerSleutel([
      a({ branch: 'thuisbatterij', status: 'completed', outcome: 'deal' }),
      a({ branch: 'thuisbatterij', status: 'completed', outcome: 'no_deal', outcome_reason: 'prijs' }),
      a({ branch: 'kozijnen', status: 'completed', outcome: 'deal' }),
    ], 'branch', NU);
    expect(rijen[0].waarde).toBe('thuisbatterij');
    expect(rijen[0].stat.conversiePct).toBe(50);
    expect(rijen[1].stat.conversiePct).toBe(100);
  });

  it('groepeert ontbrekende waarden onder onbekend', () => {
    const rijen = berekenPerSleutel([a({ portal_user_id: null })], 'portal_user_id', NU);
    expect(rijen[0].waarde).toBe('(onbekend)');
  });
});

describe('topRedenen', () => {
  it('telt de redenen en zet de meest genoemde voorop', () => {
    const r = topRedenen([
      a({ status: 'completed', outcome: 'no_deal', outcome_reason: 'prijs' }),
      a({ status: 'completed', outcome: 'no_deal', outcome_reason: 'prijs' }),
      a({ status: 'completed', outcome: 'no_deal', outcome_reason: 'concurrent' }),
      a({ status: 'completed', outcome: 'deal' }),
    ]);
    expect(r).toEqual([{ reden: 'prijs', aantal: 2 }, { reden: 'concurrent', aantal: 1 }]);
  });

  it('geeft niets terug als er geen redenen zijn', () => {
    expect(topRedenen([a({ status: 'completed', outcome: 'deal' })])).toEqual([]);
  });
});
