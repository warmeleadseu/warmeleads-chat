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
