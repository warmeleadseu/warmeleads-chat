import { describe, expect, it } from 'vitest';
import {
  buildTeamleaderTestLead,
  pickTestBranchSlug,
} from '@/lib/teamleader/testLead';

describe('pickTestBranchSlug', () => {
  it('prefers thuisbatterij when customer has it', () => {
    expect(pickTestBranchSlug(['zonnepanelen', 'thuisbatterij', 'airco'])).toBe('thuisbatterij');
  });

  it('falls back to first branch', () => {
    expect(pickTestBranchSlug(['airco', 'zonnepanelen'])).toBe('airco');
  });

  it('defaults to thuisbatterij when empty', () => {
    expect(pickTestBranchSlug([])).toBe('thuisbatterij');
  });
});

describe('buildTeamleaderTestLead', () => {
  it('includes phone, city and all thuisbatterij branch fields', () => {
    const lead = buildTeamleaderTestLead('thuisbatterij', 'cust-abc-123', [
      'zonnepanelen',
      'dynamisch_contract',
      'stroomverbruik',
      'budget',
      'reden_thuisbatterij',
    ]);

    expect(lead.telefoonnummer).toBeTruthy();
    expect(lead.plaatsnaam).toBe('Eindhoven');
    expect(lead.postcode).toBe('5611AB');
    expect(lead.branch).toBe('thuisbatterij');
    expect(lead.custom_fields?.zonnepanelen).toBeTruthy();
    expect(lead.custom_fields?.dynamisch_contract).toBeTruthy();
    expect(lead.email).toContain('test+cust-abc');
  });

  it('fills unknown branch keys with placeholders', () => {
    const lead = buildTeamleaderTestLead('custom_branch', 'cust-1', ['veld_a', 'veld_b']);
    expect(lead.custom_fields?.veld_a).toContain('veld_a');
    expect(lead.custom_fields?.veld_b).toContain('veld_b');
  });
});
