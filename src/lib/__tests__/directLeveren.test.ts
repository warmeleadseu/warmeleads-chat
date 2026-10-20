import { describe, expect, it } from 'vitest';
import { directHerkomst, effectiefDirect, leesDirectStand, vergelijkKandidaten, type Kandidaat } from '../directLeveren';
import { orderPipelineBatchesFifo, pickPipelineFifoHeadBatch } from '../pipelineBatchFifo';

describe('effectiefDirect: batch gaat voor klantkaart', () => {
  it.each([
    ['aan', false, true], ['aan', true, true],
    ['uit', false, false], ['uit', true, false],
    [null, false, false], [null, true, true],
    [undefined, true, true], [undefined, undefined, false],
  ] as const)('batch %s, klant %s -> %s', (batch, klant, verwacht) => {
    expect(effectiefDirect(batch as never, klant as never)).toBe(verwacht);
  });
  it('onbekende waarde op de batch: volgt de klantkaart', () => {
    expect(effectiefDirect('iets' as never, true)).toBe(true);
    expect(effectiefDirect('iets' as never, false)).toBe(false);
  });
});

describe('directHerkomst', () => {
  it('labels', () => {
    expect(directHerkomst('aan', false)).toEqual({ direct: true, label: 'Direct (batch)' });
    expect(directHerkomst(null, true)).toEqual({ direct: true, label: 'Direct (klantkaart)' });
    expect(directHerkomst('uit', true)).toEqual({ direct: false, label: 'Niet direct (batch wijkt af)' });
    expect(directHerkomst(null, false)).toEqual({ direct: false, label: 'Normaal' });
  });
});

describe('leesDirectStand', () => {
  it('geldige invoer', () => {
    expect(leesDirectStand('aan')).toBe('aan');
    expect(leesDirectStand('uit')).toBe('uit');
    expect(leesDirectStand(null)).toBeNull();
    expect(leesDirectStand('volgt')).toBeNull();
    expect(leesDirectStand('')).toBeNull();
  });
  it('ongeldige invoer: undefined (API weigert)', () => {
    expect(leesDirectStand(true)).toBeUndefined();
    expect(leesDirectStand('ja')).toBeUndefined();
    expect(leesDirectStand(1)).toBeUndefined();
  });
});

/* De sortering van vóór direct leveren, letterlijk overgenomen. */
function oudeVolgorde(a: Kandidaat, b: Kandidaat, prefer?: string | null): number {
  if (prefer) {
    const aPref = a.customer_id === prefer;
    const bPref = b.customer_id === prefer;
    if (aPref !== bPref) return aPref ? -1 : 1;
  }
  if (a.distribution_priority !== b.distribution_priority) return a.distribution_priority ? -1 : 1;
  if (a.min_radius !== b.min_radius) return a.min_radius - b.min_radius;
  if (a.recent_24h !== b.recent_24h) return a.recent_24h - b.recent_24h;
  return a.distance_km - b.distance_km;
}

/* Kleine deterministische random, zodat de test elke keer hetzelfde doet. */
function rng(seed: number) {
  let x = seed;
  return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
}

function kandidaten(r: () => number, n: number, directKans: number): Kandidaat[] {
  return Array.from({ length: n }, (_, i) => ({
    customer_id: `k${i}`,
    direct: r() < directKans,
    distribution_priority: r() < 0.3,
    min_radius: [25, 50, 999][Math.floor(r() * 3)],
    recent_24h: Math.floor(r() * 5),
    distance_km: Math.round(r() * 800) / 10,
  }));
}

describe('vergelijkKandidaten', () => {
  it('zonder direct: precies dezelfde volgorde als voorheen (5.000 willekeurige rondes)', () => {
    const r = rng(42);
    for (let i = 0; i < 5000; i++) {
      const lijst = kandidaten(r, 1 + Math.floor(r() * 6), 0);
      const prefer = r() < 0.2 ? lijst[Math.floor(r() * lijst.length)].customer_id : null;
      const nieuw = [...lijst].sort((a, b) => vergelijkKandidaten(a, b, prefer)).map(k => k.customer_id);
      const oud = [...lijst].sort((a, b) => oudeVolgorde(a, b, prefer)).map(k => k.customer_id);
      expect(nieuw).toEqual(oud);
    }
  });

  it('een direct-kandidaat wint altijd van niet-direct, ook met voorrang, kleiner gebied of kortere afstand', () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const lijst = kandidaten(r, 2 + Math.floor(r() * 5), 0.3);
      const winnaar = [...lijst].sort((a, b) => vergelijkKandidaten(a, b, null))[0];
      if (lijst.some(k => k.direct)) expect(winnaar.direct).toBe(true);
    }
  });

  it('meerdere direct-kandidaten: onderling de gewone volgorde', () => {
    const a: Kandidaat = { customer_id: 'a', direct: true, distribution_priority: false, min_radius: 50, recent_24h: 0, distance_km: 10 };
    const b: Kandidaat = { ...a, customer_id: 'b', min_radius: 25 };
    const c: Kandidaat = { ...a, customer_id: 'c', distribution_priority: true, min_radius: 999 };
    expect([a, b, c].sort((x, y) => vergelijkKandidaten(x, y)).map(k => k.customer_id)).toEqual(['c', 'b', 'a']);
  });

  it('een expliciet gekozen klant (preferCustomerId) blijft bovenaan, ook boven direct', () => {
    const a: Kandidaat = { customer_id: 'a', direct: true, distribution_priority: true, min_radius: 25, recent_24h: 0, distance_km: 1 };
    const b: Kandidaat = { ...a, customer_id: 'b', direct: false, distribution_priority: false };
    expect([a, b].sort((x, y) => vergelijkKandidaten(x, y, 'b'))[0].customer_id).toBe('b');
  });
});

describe('volgorde van batches binnen één klant', () => {
  const basis = { customer_id: 'k', branch: 'thuisbatterij', leads_delivered: 0, batch_size: 50, delivery_model: 'capped', batch_kind: 'leads' };
  it('batch op "altijd direct" gaat voor een oudere en voor een voorrang-batch', () => {
    const oud = { ...basis, id: 'oud', created_at: '2026-09-01T00:00:00Z' };
    const voorrang = { ...basis, id: 'voorrang', created_at: '2026-09-15T00:00:00Z', distribution_priority: true };
    const direct = { ...basis, id: 'direct', created_at: '2026-10-01T00:00:00Z', direct_leveren: 'aan' };
    expect(orderPipelineBatchesFifo([oud, voorrang, direct]).map(b => b.id)).toEqual(['direct', 'voorrang', 'oud']);
    expect(pickPipelineFifoHeadBatch([oud, voorrang, direct])?.id).toBe('direct');
  });
  it('direct + voorrang gaat voor alleen direct', () => {
    const direct = { ...basis, id: 'direct', created_at: '2026-09-01T00:00:00Z', direct_leveren: 'aan' };
    const beide = { ...basis, id: 'beide', created_at: '2026-10-01T00:00:00Z', direct_leveren: 'aan', distribution_priority: true };
    expect(orderPipelineBatchesFifo([direct, beide]).map(b => b.id)).toEqual(['beide', 'direct']);
  });
  it('klantkaart op direct verandert de eigen wachtrij niet: voorrang blijft voorgaan', () => {
    /* De klantkaart geldt voor alle batches tegelijk; die staan dus niet als "aan" op de batch. */
    const oud = { ...basis, id: 'oud', created_at: '2026-09-01T00:00:00Z', direct_leveren: null };
    const voorrang = { ...basis, id: 'voorrang', created_at: '2026-10-01T00:00:00Z', distribution_priority: true, direct_leveren: null };
    expect(pickPipelineFifoHeadBatch([oud, voorrang])?.id).toBe('voorrang');
  });
  it('"nooit direct" schuift een oudere batch niet naar achteren', () => {
    const oudUit = { ...basis, id: 'oud-uit', created_at: '2026-09-01T00:00:00Z', direct_leveren: 'uit' };
    const nieuw = { ...basis, id: 'nieuw', created_at: '2026-10-01T00:00:00Z', direct_leveren: null };
    expect(pickPipelineFifoHeadBatch([nieuw, oudUit])?.id).toBe('oud-uit');
  });
  it('zonder direct: zoals voorheen (voorrang, dan oudste)', () => {
    const oud = { ...basis, id: 'oud', created_at: '2026-09-01T00:00:00Z' };
    const nieuw = { ...basis, id: 'nieuw', created_at: '2026-10-01T00:00:00Z' };
    const voorrang = { ...basis, id: 'voorrang', created_at: '2026-10-05T00:00:00Z', distribution_priority: true };
    expect(orderPipelineBatchesFifo([nieuw, oud, voorrang]).map(b => b.id)).toEqual(['voorrang', 'oud', 'nieuw']);
  });
});
