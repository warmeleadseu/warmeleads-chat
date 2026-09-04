import { describe, it, expect } from 'vitest';
import {
  isVerseLead,
  isVerseToewijzing,
  verseToewijzingFilter,
  NIET_VERSE_TOEWIJZING_BRONNEN,
} from '../leadMetrics';

/**
 * Het periodeoverzicht liet in de week van 31 augustus 2026 "98 leads geworven"
 * naast "160 leads uitgedeeld" zien. In die 160 zaten 55 bulkverkoop-rijen,
 * waarvan er 54 gingen over leads van weken eerder. Deze tests leggen vast dat
 * bulk, demo en masterportaal-kopieën nooit meer als verse uitdeling tellen.
 */

describe('isVerseToewijzing', () => {
  it('telt gewone verdeling mee', () => {
    expect(isVerseToewijzing({ source: 'distribution' })).toBe(true);
  });

  it('telt een lege source mee (historisch gelijk aan distribution)', () => {
    expect(isVerseToewijzing({ source: null })).toBe(true);
    expect(isVerseToewijzing({})).toBe(true);
  });

  it('telt losse bulkverkoop niet mee', () => {
    expect(isVerseToewijzing({ source: 'bulk_assign' })).toBe(false);
  });

  it('telt bulk-export niet mee', () => {
    expect(isVerseToewijzing({ source: 'bulk_export' })).toBe(false);
  });

  it('telt demo-toewijzingen niet mee', () => {
    expect(isVerseToewijzing({ source: 'demo' })).toBe(false);
  });

  it('telt masterportaal-kopieën niet mee', () => {
    expect(isVerseToewijzing({ source: 'mirror' })).toBe(false);
  });

  it('sluit precies de vier bulk-/demo-bronnen uit en niets anders', () => {
    expect([...NIET_VERSE_TOEWIJZING_BRONNEN].sort()).toEqual([
      'bulk_assign',
      'bulk_export',
      'demo',
      'mirror',
    ]);
  });
});

describe('isVerseLead', () => {
  it('telt Zapier- en Meta-instroom mee', () => {
    expect(isVerseLead({ bron: 'zapier' })).toBe(true);
    expect(isVerseLead({ bron: 'meta' })).toBe(true);
  });

  it('telt ingelezen bestanden en demo niet mee', () => {
    expect(isVerseLead({ bron: 'excel_import' })).toBe(false);
    expect(isVerseLead({ bron: 'demo' })).toBe(false);
  });
});

describe('verseToewijzingFilter', () => {
  it('laat lege sources door en sluit de bulkbronnen uit', () => {
    expect(verseToewijzingFilter()).toBe(
      'source.is.null,source.not.in.(bulk_export,bulk_assign,demo,mirror)',
    );
  });
});
