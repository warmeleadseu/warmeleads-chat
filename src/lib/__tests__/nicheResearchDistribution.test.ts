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
