import { describe, it, expect } from 'vitest';
import {
  afstandBuitenGebied,
  geldendeMarge,
  vindKandidaten,
  lijstVoor,
  beschrijfKandidaat,
  STANDAARD_INSTELLINGEN,
  type RestLead,
  type KandidaatBatch,
} from '../restleads';

const ROERMOND = { lat: 51.1942, lng: 5.9873 };
const ZWOLLE = { lat: 52.5168, lng: 6.0830 };
const altijdWaar = () => true;

function lead(over: Partial<RestLead> = {}): RestLead {
  return {
    id: 'l1', naam_klant: 'Jan', plaatsnaam: 'Roermond', provincie: 'Limburg',
    postcode: '6041 AA', land: 'NL', branch: 'thuisbatterij',
    ...ROERMOND, phone_valid: true, wervingsdatum: '2026-09-20',
    created_at: new Date().toISOString(),
    ...over,
  };
}

function batch(over: Partial<KandidaatBatch> = {}): KandidaatBatch {
  return {
    batch_id: 'b1', customer_id: 'k1', klant: 'Klant A', branch: 'thuisbatterij',
    prijs_per_lead: 30, ruimte: 10, distribution_priority: false, droog_dagen: 0,
    doelen: [{ target_type: 'radius', ...ROERMOND, radius_km: 20, country: 'NL' }],
    lead_filters: [], uitsluitingen: [],
    ...over,
  };
}

describe('afstandBuitenGebied', () => {
  it('geeft nul binnen de straal', () => {
    expect(afstandBuitenGebied(lead(), batch().doelen)).toBe(0);
  });

  it('geeft de afstand erbuiten', () => {
    const doelen = [{ target_type: 'radius', ...ZWOLLE, radius_km: 20, country: 'NL' }];
    const d = afstandBuitenGebied(lead(), doelen);
    expect(d).toBeGreaterThan(100);
  });

  it('geeft nul bij een passende provincie', () => {
    const doelen = [{ target_type: 'province', provinces: ['NL:Limburg'], country: 'NL' }];
    expect(afstandBuitenGebied(lead(), doelen)).toBe(0);
  });

  it('kan niets zeggen zonder coordinaten en zonder provinciedoel', () => {
    expect(afstandBuitenGebied(lead({ lat: null, lng: null }), batch().doelen)).toBeNull();
  });

  it('neemt het dichtstbijzijnde doel', () => {
    const doelen = [
      { target_type: 'radius', ...ZWOLLE, radius_km: 20, country: 'NL' },
      { target_type: 'radius', ...ROERMOND, radius_km: 10, country: 'NL' },
    ];
    expect(afstandBuitenGebied(lead(), doelen)).toBe(0);
  });
});

describe('geldendeMarge', () => {
  it('houdt de standaardmarge bij een actieve klant en een geplaatste lead', () => {
    const m = geldendeMarge(STANDAARD_INSTELLINGEN, { droog_dagen: 0 }, 1);
    expect(m.km).toBe(5);
    expect(m.ruim).toBe(false);
  });

  it('rekt op bij een klant die droog staat', () => {
    const m = geldendeMarge(STANDAARD_INSTELLINGEN, { droog_dagen: 70 }, 1);
    expect(m.km).toBe(10);
    expect(m.waarom).toContain('70 dagen droog');
  });

  it('rekt op bij een klant die nog nooit een lead kreeg', () => {
    const m = geldendeMarge(STANDAARD_INSTELLINGEN, { droog_dagen: null }, 1);
    expect(m.km).toBe(10);
    expect(m.waarom).toContain('nog nooit');
  });

  it('rekt op bij een lead die nergens is geplaatst', () => {
    /* Die staat volledig in het rood; elke plaatsing is winst. */
    const m = geldendeMarge(STANDAARD_INSTELLINGEN, { droog_dagen: 0 }, 0);
    expect(m.km).toBe(10);
    expect(m.waarom).toContain('nergens geplaatst');
  });

  it('noemt beide redenen als ze allebei gelden', () => {
    const m = geldendeMarge(STANDAARD_INSTELLINGEN, { droog_dagen: 30 }, 0);
    expect(m.waarom).toContain('droog');
    expect(m.waarom).toContain('nergens geplaatst');
  });
});

describe('vindKandidaten', () => {
  it('vindt een klant binnen het gebied', () => {
    const k = vindKandidaten(lead(), [batch()], new Set(), STANDAARD_INSTELLINGEN, altijdWaar);
    expect(k).toHaveLength(1);
    expect(k[0].reden).toBe('binnen het gebied');
  });

  it('slaat een andere branche over', () => {
    expect(vindKandidaten(lead(), [batch({ branch: 'kozijnen' })], new Set(), STANDAARD_INSTELLINGEN, altijdWaar)).toHaveLength(0);
  });

  it('slaat een klant over die de lead al heeft', () => {
    expect(vindKandidaten(lead(), [batch()], new Set(['k1']), STANDAARD_INSTELLINGEN, altijdWaar)).toHaveLength(0);
  });

  it('slaat een volle batch over', () => {
    expect(vindKandidaten(lead(), [batch({ ruimte: 0 })], new Set(), STANDAARD_INSTELLINGEN, altijdWaar)).toHaveLength(0);
  });

  it('respecteert het plafond van drie klanten', () => {
    const al = new Set(['a', 'b', 'c']);
    expect(vindKandidaten(lead(), [batch()], al, STANDAARD_INSTELLINGEN, altijdWaar)).toHaveLength(0);
  });

  it('respecteert uitsluitingen tussen klanten', () => {
    const b = batch({ uitsluitingen: ['concurrent'] });
    expect(vindKandidaten(lead(), [b], new Set(['concurrent']), STANDAARD_INSTELLINGEN, altijdWaar)).toHaveLength(0);
  });

  it('slaat een lead met een ongeldig telefoonnummer over', () => {
    /* Dat is juist de reden dat hij blijft liggen; uitdelen lost niets op. */
    expect(vindKandidaten(lead({ phone_valid: false }), [batch()], new Set(), STANDAARD_INSTELLINGEN, altijdWaar)).toHaveLength(0);
  });

  it('respecteert de batchfilters', () => {
    expect(vindKandidaten(lead(), [batch({ lead_filters: [{}] })], new Set(), STANDAARD_INSTELLINGEN, () => false)).toHaveLength(0);
  });

  it('neemt een klant net buiten de marge niet mee, met de ruime marge wel', () => {
    /* 27 km van Roermond, straal 20: dus 7 km buiten. */
    const ver = { target_type: 'radius', lat: 51.1942, lng: 6.3728, radius_km: 20, country: 'NL' };
    const strak = batch({ doelen: [ver], droog_dagen: 0 });
    expect(vindKandidaten(lead(), [strak], new Set(['x']), STANDAARD_INSTELLINGEN, altijdWaar)).toHaveLength(0);

    const droog = batch({ doelen: [ver], droog_dagen: 70 });
    const k = vindKandidaten(lead(), [droog], new Set(['x']), STANDAARD_INSTELLINGEN, altijdWaar);
    expect(k).toHaveLength(1);
    expect(k[0].reden).toContain('droog');
  });

  it('zet voorrangsbatches bovenaan, daarna de dichtstbijzijnde', () => {
    const b1 = batch({ batch_id: 'ver', customer_id: 'k2', klant: 'Ver', doelen: [{ target_type: 'radius', lat: 51.2242, lng: 6.03, radius_km: 3, country: 'NL' }] });
    const b2 = batch({ batch_id: 'dichtbij', customer_id: 'k3', klant: 'Dichtbij' });
    const b3 = batch({ batch_id: 'voorrang', customer_id: 'k4', klant: 'Voorrang', distribution_priority: true, doelen: b1.doelen });
    const k = vindKandidaten(lead(), [b1, b2, b3], new Set(), STANDAARD_INSTELLINGEN, altijdWaar);
    expect(k[0].klant).toBe('Voorrang');
    expect(k[1].klant).toBe('Dichtbij');
  });
});

describe('lijstVoor', () => {
  const nu = new Date('2026-09-23T12:00:00Z');
  it('zet een verse lead in kansrijk', () => {
    expect(lijstVoor({ created_at: '2026-09-20T12:00:00Z' }, nu)).toBe('kansrijk');
  });
  it('zet een oudere lead in verlopen', () => {
    expect(lijstVoor({ created_at: '2026-09-01T12:00:00Z' }, nu)).toBe('verlopen');
  });
  it('laat een lead ouder dan 90 dagen buiten beide lijsten', () => {
    expect(lijstVoor({ created_at: '2026-05-01T12:00:00Z' }, nu)).toBeNull();
  });
  it('valt niet over een onleesbare datum', () => {
    expect(lijstVoor({ created_at: 'onzin' }, nu)).toBeNull();
  });
});

describe('beschrijfKandidaat', () => {
  it('beschrijft binnen, buiten en de ruime reden', () => {
    expect(beschrijfKandidaat(0, null)).toBe('binnen het gebied');
    expect(beschrijfKandidaat(3.4, null)).toBe('3 km buiten');
    expect(beschrijfKandidaat(0.4, null)).toBe('<1 km buiten');
    expect(beschrijfKandidaat(8, 'klant staat 70 dagen droog')).toBe('8 km buiten, klant staat 70 dagen droog');
  });
});
