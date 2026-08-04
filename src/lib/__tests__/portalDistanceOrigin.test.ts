import { describe, expect, it, vi } from 'vitest';
import {
  applyCustomDistanceOrigin,
  enrichPortalLeadDistances,
  haversineKm,
  minDistanceKm,
  resolveDistanceOrigin,
  resolvePortalGeoFilterContext,
} from '../portalDistanceOrigin';

vi.mock('@/lib/pdok', () => ({
  resolveCity: vi.fn(async (q: string) => {
    if (q.toLowerCase() === 'utrecht') {
      return { naam: 'Utrecht', lat: 52.09, lng: 5.121 };
    }
    return null;
  }),
}));

describe('haversineKm / minDistanceKm', () => {
  it('computes roughly Amsterdam–Utrecht distance', () => {
    const km = haversineKm(52.3676, 4.9041, 52.09, 5.121);
    expect(km).toBeGreaterThan(30);
    expect(km).toBeLessThan(50);
  });

  it('picks nearest of multiple refs', () => {
    const d = minDistanceKm(
      { lat: 52.09, lng: 5.121 },
      [
        { lat: 53.219, lng: 6.566 }, // Groningen
        { lat: 52.09, lng: 5.121 }, // Utrecht
      ],
    );
    expect(d).toBe(0);
  });
});

describe('resolveDistanceOrigin', () => {
  it('resolves place via geocode', async () => {
    const origin = await resolveDistanceOrigin({ place: 'Utrecht' });
    expect(origin?.kind).toBe('place');
    expect(origin?.label).toBe('Utrecht');
    expect(origin?.refs).toHaveLength(1);
  });

  it('returns null for unknown place', async () => {
    expect(await resolveDistanceOrigin({ place: 'Nergenshuizen' })).toBeNull();
  });

  it('resolves province centroids; place wins over provinces', async () => {
    const byProv = await resolveDistanceOrigin({ provinces: ['Overijssel', 'Gelderland'] });
    expect(byProv?.kind).toBe('province');
    expect(byProv?.refs).toHaveLength(2);
    expect(byProv?.label).toBe('2 provincies');

    const placeWins = await resolveDistanceOrigin({
      place: 'Utrecht',
      provinces: ['Overijssel'],
    });
    expect(placeWins?.kind).toBe('place');
    expect(placeWins?.label).toBe('Utrecht');
  });
});

describe('applyCustomDistanceOrigin', () => {
  it('overwrites distance_km', () => {
    const leads = [
      { lat: 52.09, lng: 5.121, distance_km: 99 },
      { lat: null, lng: null, distance_km: 12 },
    ];
    applyCustomDistanceOrigin(leads, {
      refs: [{ lat: 52.09, lng: 5.121 }],
      label: 'Utrecht',
      kind: 'place',
    });
    expect(leads[0].distance_km).toBe(0);
    expect(leads[1].distance_km).toBeNull();
  });
});

describe('enrichPortalLeadDistances', () => {
  const vestiging = [{
    target_type: 'radius',
    lat: 52.09,
    lng: 5.121,
    radius_km: 25,
    created_at: '2024-01-01',
  }];

  it('computes distance vs vestiging for zero/null assignment distance', () => {
    const leads = [
      { lat: 52.3676, lng: 4.9041, distance_km: 0 },
      { lat: 52.09, lng: 5.121, distance_km: null },
    ];
    enrichPortalLeadDistances(leads, vestiging);
    expect(leads[0].distance_km).toBeGreaterThan(30);
    expect(leads[1].distance_km).toBe(0);
  });

  it('keeps real assignment distances', () => {
    const leads = [{ lat: 52.3676, lng: 4.9041, distance_km: 42 }];
    enrichPortalLeadDistances(leads, vestiging);
    expect(leads[0].distance_km).toBe(42);
  });

  it('nulls fake zero without vestiging or coords', () => {
    const leads = [
      { lat: null, lng: null, distance_km: 0 },
      { lat: 52.09, lng: 5.121, distance_km: 0 },
    ];
    enrichPortalLeadDistances(leads, []);
    expect(leads[0].distance_km).toBeNull();
    expect(leads[1].distance_km).toBeNull();
  });
});

describe('resolvePortalGeoFilterContext', () => {
  it('uses plaats as origin when straal is set without explicit origin', async () => {
    const res = await resolvePortalGeoFilterContext({
      plaats: 'Utrecht',
      maxDistanceKm: 25,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ctx.plaatsFilter).toBe('');
    expect(res.ctx.distanceOrigin?.label).toBe('Utrecht');
  });

  it('keeps plaats name filter without straal', async () => {
    const res = await resolvePortalGeoFilterContext({ plaats: 'Enschede' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ctx.plaatsFilter).toBe('Enschede');
    expect(res.ctx.distanceOrigin).toBeNull();
  });

  it('explicit origin wins over plaats', async () => {
    const res = await resolvePortalGeoFilterContext({
      plaats: 'Enschede',
      maxDistanceKm: 50,
      distanceOriginPlace: 'Utrecht',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ctx.plaatsFilter).toBe('Enschede');
    expect(res.ctx.distanceOrigin?.label).toBe('Utrecht');
  });
});
