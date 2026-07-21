import { describe, expect, it } from 'vitest';
import { matchLeadToTargets } from '../matchLeadToTargets';
import {
  checkBranchGuardrail,
  checkGeoGuardrail,
  checkRecentAssignmentGuardrail,
} from '../manualAssignmentGuardrails';

describe('matchLeadToTargets', () => {
  it('matches radius target', () => {
    const result = matchLeadToTargets(
      { lat: 53.2, lng: 5.8 },
      [{ target_type: 'radius', lat: 53.2, lng: 5.8, radius_km: 10 }],
    );
    expect(result.matches).toBe(true);
    expect(result.matched_target_type).toBe('radius');
  });

  it('rejects out-of-radius lead', () => {
    const result = matchLeadToTargets(
      { lat: 52.0, lng: 4.9 },
      [{ target_type: 'radius', lat: 53.2, lng: 5.8, radius_km: 5 }],
    );
    expect(result.matches).toBe(false);
  });
});

describe('manualAssignmentGuardrails', () => {
  it('blocks branch mismatch', () => {
    const issue = checkBranchGuardrail(
      { id: '1', branch: 'airco' },
      { id: 'c1', branches: ['thuisbatterij'] },
    );
    expect(issue?.code).toBe('branch_mismatch');
  });

  it('allows matching branch', () => {
    expect(
      checkBranchGuardrail(
        { id: '1', branch: 'thuisbatterij' },
        { id: 'c1', branches: ['thuisbatterij'] },
      ),
    ).toBeNull();
  });

  it('blocks recent assignment', () => {
    const issue = checkRecentAssignmentGuardrail(new Date().toISOString());
    expect(issue?.code).toBe('recent_assignment');
  });

  it('blocks geo mismatch when targets exist', () => {
    const issue = checkGeoGuardrail(
      { id: '1', lat: 52.0, lng: 4.9 },
      [{ target_type: 'radius', lat: 53.2, lng: 5.8, radius_km: 5 }],
    );
    expect(issue?.code).toBe('geo_mismatch');
  });

  it('explains missing coordinates against radius targets', () => {
    const issue = checkGeoGuardrail(
      { id: '1', lat: null, lng: null },
      [{ target_type: 'radius', lat: 53.2, lng: 5.8, radius_km: 40 }],
    );
    expect(issue?.code).toBe('geo_mismatch');
    expect(issue?.message).toMatch(/geen coördinaten/i);
  });
});
