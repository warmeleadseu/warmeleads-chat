import { describe, expect, it } from 'vitest';
import {
  parseExportBranchFilter,
  validateExportBranchFilter,
  validatePortalExportBranches,
} from '../exportBranchValidation';

describe('exportBranchValidation', () => {
  it('parseExportBranchFilter splits comma list', () => {
    expect(parseExportBranchFilter('thuisbatterij,airco')).toEqual(['thuisbatterij', 'airco']);
    expect(parseExportBranchFilter('')).toEqual([]);
    expect(parseExportBranchFilter(undefined)).toEqual([]);
  });

  it('validateExportBranchFilter rejects empty', () => {
    expect(validateExportBranchFilter('')).toEqual({
      ok: false,
      error: 'Selecteer minimaal één branche om te exporteren',
    });
    expect(validateExportBranchFilter('thuisbatterij')).toEqual({
      ok: true,
      branches: ['thuisbatterij'],
    });
  });

  it('validatePortalExportBranches rejects branches outside customer', () => {
    expect(validatePortalExportBranches(['airco'], ['thuisbatterij']).ok).toBe(false);
    expect(validatePortalExportBranches(['thuisbatterij'], ['thuisbatterij']).ok).toBe(true);
  });
});

describe('validateExportBranchFilter met een handmatige selectie', () => {
  /**
   * Bug uit productie: met honderd aangevinkte thuisbatterij-leads gaf
   * "Exporteer selectie" de melding "Selecteer minimaal één branche om te
   * exporteren". De branchefilter is bedoeld tegen een ongewilde export over
   * alle branches; bij een selectie is die afbakening er al.
   */
  it('laat een lege branchefilter toe zodra er een selectie is', () => {
    const r = validateExportBranchFilter(undefined, { selectieAanwezig: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.branches).toEqual([]);
  });

  it('eist nog steeds een branche zonder selectie', () => {
    const r = validateExportBranchFilter(undefined, { selectieAanwezig: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('minimaal één branche');
  });

  it('eist nog steeds een branche wanneer de optie ontbreekt', () => {
    expect(validateExportBranchFilter('').ok).toBe(false);
  });

  it('respecteert een meegegeven branche ook bij een selectie', () => {
    const r = validateExportBranchFilter('thuisbatterij', { selectieAanwezig: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.branches).toEqual(['thuisbatterij']);
  });
});
