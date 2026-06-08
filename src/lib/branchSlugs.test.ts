import { describe, it, expect } from 'vitest';
import { resolveBranchSlugsAgainst } from './branchSlugs';

const VALID = new Set([
  'zonnepanelen',
  'thuisbatterij',
  'airco',
  'warmtepomp',
  'badkamer',
  'kozijnen',
  'glas',
  'isolatie',
  'elektricien',
]);

describe('resolveBranchSlugsAgainst', () => {
  describe('directe matches', () => {
    it('behoudt geldige slugs in array-input', () => {
      expect(resolveBranchSlugsAgainst(['zonnepanelen', 'thuisbatterij'], VALID)).toEqual({
        valid: ['zonnepanelen', 'thuisbatterij'],
        dropped: [],
      });
    });

    it('behoudt geldige slugs in komma-gescheiden string', () => {
      expect(resolveBranchSlugsAgainst('zonnepanelen, thuisbatterij', VALID)).toEqual({
        valid: ['zonnepanelen', 'thuisbatterij'],
        dropped: [],
      });
    });

    it('dedupliceert', () => {
      expect(resolveBranchSlugsAgainst('airco, airco, AIRCO', VALID)).toEqual({
        valid: ['airco'],
        dropped: [],
      });
    });
  });

  describe('suffix-strippen', () => {
    it('strip " leads"', () => {
      expect(resolveBranchSlugsAgainst('thuisbatterij leads', VALID)).toEqual({
        valid: ['thuisbatterij'],
        dropped: [],
      });
    });

    it('strip " Leads" (case-insensitive)', () => {
      expect(resolveBranchSlugsAgainst('Airco Leads', VALID)).toEqual({
        valid: ['airco'],
        dropped: [],
      });
    });

    it('strip " aanvragen"', () => {
      expect(resolveBranchSlugsAgainst('zonnepanelen aanvragen', VALID)).toEqual({
        valid: ['zonnepanelen'],
        dropped: [],
      });
    });
  });

  describe('synoniemen via alias-map', () => {
    it('airconditioning → airco', () => {
      expect(resolveBranchSlugsAgainst('airconditioning', VALID)).toEqual({
        valid: ['airco'],
        dropped: [],
      });
    });

    it('warmtepompen (plural) → warmtepomp', () => {
      expect(resolveBranchSlugsAgainst('warmtepompen', VALID)).toEqual({
        valid: ['warmtepomp'],
        dropped: [],
      });
    });

    it('solar → zonnepanelen', () => {
      expect(resolveBranchSlugsAgainst('solar', VALID)).toEqual({
        valid: ['zonnepanelen'],
        dropped: [],
      });
    });
  });

  describe('composities splitsen', () => {
    it('"kozijnen / glas" wordt twee slugs', () => {
      expect(resolveBranchSlugsAgainst('kozijnen / glas', VALID)).toEqual({
        valid: ['kozijnen', 'glas'],
        dropped: [],
      });
    });

    it('"airco & warmtepomp" wordt twee slugs', () => {
      expect(resolveBranchSlugsAgainst('airco & warmtepomp', VALID)).toEqual({
        valid: ['airco', 'warmtepomp'],
        dropped: [],
      });
    });

    it('"airco en warmtepomp" (NL) wordt twee slugs', () => {
      expect(resolveBranchSlugsAgainst('airco en warmtepomp', VALID)).toEqual({
        valid: ['airco', 'warmtepomp'],
        dropped: [],
      });
    });
  });

  describe('ambigue/onbekende waarden droppen', () => {
    it('beide → silent drop', () => {
      expect(resolveBranchSlugsAgainst('beide', VALID)).toEqual({
        valid: [],
        dropped: ['beide'],
      });
    });

    it('anders → silent drop', () => {
      expect(resolveBranchSlugsAgainst('anders', VALID)).toEqual({
        valid: [],
        dropped: ['anders'],
      });
    });

    it('onbekende string → drop met behoud van originele weergave', () => {
      expect(resolveBranchSlugsAgainst('randomstring', VALID)).toEqual({
        valid: [],
        dropped: ['randomstring'],
      });
    });
  });

  describe('mix-scenario\'s (echte import-strings)', () => {
    it('"beide, zonnepanelen" → behoudt zonnepanelen, dropt beide', () => {
      expect(resolveBranchSlugsAgainst('beide, zonnepanelen', VALID)).toEqual({
        valid: ['zonnepanelen'],
        dropped: ['beide'],
      });
    });

    it('echte case: "Thuisbatterij Leads" → thuisbatterij', () => {
      expect(resolveBranchSlugsAgainst('Thuisbatterij Leads', VALID)).toEqual({
        valid: ['thuisbatterij'],
        dropped: [],
      });
    });

    it('echte case: "Kozijnen / Glas" → kozijnen + glas', () => {
      expect(resolveBranchSlugsAgainst('Kozijnen / Glas', VALID)).toEqual({
        valid: ['kozijnen', 'glas'],
        dropped: [],
      });
    });
  });

  describe('lege/null input', () => {
    it.each([null, undefined, '', '   ', [], [null], [undefined]])(
      'lege input %s geeft lege resolution',
      (input) => {
        expect(resolveBranchSlugsAgainst(input as unknown, VALID)).toEqual({
          valid: [],
          dropped: [],
        });
      },
    );
  });

  describe('case-/whitespace-tolerant', () => {
    it('extra whitespace en hoofdletters', () => {
      expect(resolveBranchSlugsAgainst('  ZONNEPANELEN  ', VALID)).toEqual({
        valid: ['zonnepanelen'],
        dropped: [],
      });
    });
  });
});
