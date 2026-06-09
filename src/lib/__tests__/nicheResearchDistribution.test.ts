import { describe, it, expect } from 'vitest';
import { nicheLeadMatchesCustomerTargets } from '../nicheResearchDistribution';

describe('nicheLeadMatchesCustomerTargets', () => {
  describe('geen targets → geen match', () => {
    it('lege array', () => {
      expect(nicheLeadMatchesCustomerTargets({ lat: 50.5, lng: 4.5 }, [])).toBe(false);
    });
  });

  describe('radius targets', () => {
    const beTarget = {
      customer_id: 'c1',
      target_type: 'radius',
      lat: 50.5039,
      lng: 4.4699, // ~Namen, midden BE
      radius_km: 170,
      provinces: null,
    };

    it('Belgische lead in radius matcht', () => {
      expect(
        nicheLeadMatchesCustomerTargets(
          { lat: 50.85, lng: 4.35, provincie: 'Brussel', land: 'BE' }, // Brussel ~38km
          [beTarget],
        ),
      ).toBe(true);
    });

    it('NL Groningen-lead buiten radius matcht NIET (echte case nu-isoleren.be)', () => {
      expect(
        nicheLeadMatchesCustomerTargets(
          { lat: 53.2265, lng: 6.5969, provincie: 'Groningen', land: 'NL' },
          [beTarget],
        ),
      ).toBe(false);
    });

    it('lead zonder lat/lng kan niet matchen op radius-target', () => {
      expect(
        nicheLeadMatchesCustomerTargets({ provincie: 'Brussel', land: 'BE' }, [beTarget]),
      ).toBe(false);
    });

    it('target zonder lat/lng/radius wordt overgeslagen', () => {
      const broken = { ...beTarget, lat: null, lng: null, radius_km: null };
      expect(nicheLeadMatchesCustomerTargets({ lat: 50.5, lng: 4.5 }, [broken])).toBe(false);
    });
  });

  describe('province targets', () => {
    const beLimburgTarget = {
      customer_id: 'c1',
      target_type: 'province',
      lat: null,
      lng: null,
      radius_km: null,
      provinces: ['BE:Limburg'],
    };

    it('BE Limburg-lead matcht BE:Limburg target', () => {
      expect(
        nicheLeadMatchesCustomerTargets(
          { provincie: 'Limburg', land: 'BE' },
          [beLimburgTarget],
        ),
      ).toBe(true);
    });

    it('NL Limburg-lead matcht GEEN BE:Limburg target', () => {
      expect(
        nicheLeadMatchesCustomerTargets(
          { provincie: 'Limburg', land: 'NL' },
          [beLimburgTarget],
        ),
      ).toBe(false);
    });
  });

  describe('country-restrictie (migratie 136)', () => {
    it('NL-only radius-target weigert Belgische lead in radius (echte case Den Held Dakwerk)', () => {
      const heelNlTarget = {
        customer_id: 'c1',
        target_type: 'radius',
        lat: 52.1326,
        lng: 5.2913, // Utrecht
        radius_km: 200,
        provinces: null,
        country: 'NL',
      };
      // Destelbergen (Oost-Vlaanderen) ligt geometrisch in radius (~158km),
      // maar lead.land=BE moet hem wegfilteren door country='NL'.
      expect(
        nicheLeadMatchesCustomerTargets(
          { lat: 51.06, lng: 3.80, provincie: 'Oost-Vlaanderen', land: 'BE' },
          [heelNlTarget],
        ),
      ).toBe(false);
    });

    it('NL-only radius-target accepteert wel NL-lead in radius', () => {
      const heelNlTarget = {
        customer_id: 'c1',
        target_type: 'radius',
        lat: 52.1326,
        lng: 5.2913,
        radius_km: 200,
        provinces: null,
        country: 'NL',
      };
      expect(
        nicheLeadMatchesCustomerTargets(
          { lat: 53.20, lng: 7.09, provincie: 'Groningen', land: 'NL' },
          [heelNlTarget],
        ),
      ).toBe(true);
    });

    it('country=NULL houdt oude gedrag: cross-border via radius blijft toegestaan', () => {
      const eindhovenTarget = {
        customer_id: 'c1',
        target_type: 'radius',
        lat: 51.45,
        lng: 5.46,
        radius_km: 50,
        provinces: null,
        country: null, // Total Energy-stijl: bewust grensoverschrijdend
      };
      // Maaseik BE (~40km) — moet matchen want geen land-restrictie.
      expect(
        nicheLeadMatchesCustomerTargets(
          { lat: 51.10, lng: 5.79, provincie: 'Limburg', land: 'BE' },
          [eindhovenTarget],
        ),
      ).toBe(true);
    });
  });

  describe('mixed targets (any-match)', () => {
    const targets = [
      {
        customer_id: 'c1',
        target_type: 'province',
        lat: null,
        lng: null,
        radius_km: null,
        provinces: ['NL:Groningen'],
      },
      {
        customer_id: 'c1',
        target_type: 'radius',
        lat: 52.37,
        lng: 4.89, // Amsterdam
        radius_km: 50,
        provinces: null,
      },
    ];

    it('matcht via province-target', () => {
      expect(
        nicheLeadMatchesCustomerTargets(
          { provincie: 'Groningen', land: 'NL' },
          targets,
        ),
      ).toBe(true);
    });

    it('matcht via radius-target', () => {
      expect(
        nicheLeadMatchesCustomerTargets(
          { lat: 52.37, lng: 4.89, provincie: 'Noord-Holland', land: 'NL' },
          targets,
        ),
      ).toBe(true);
    });

    it('matcht geen van beide', () => {
      expect(
        nicheLeadMatchesCustomerTargets(
          { lat: 51.0, lng: 3.7, provincie: 'Oost-Vlaanderen', land: 'BE' }, // Gent
          targets,
        ),
      ).toBe(false);
    });
  });
});
