import { describe, expect, it } from 'vitest';
import {
  formatValueForTeamleader,
  getLeadFieldValue,
  hasSavedFieldMappings,
  suggestDefaultFieldMapping,
  suggestFieldMapping,
  getPortalFieldsForBranch,
} from '@/lib/teamleader/fieldMappingLogic';
import type { TeamleaderCustomFieldDefinition } from '@/lib/teamleader/customFieldDefinitions';

describe('getLeadFieldValue', () => {
  it('reads standard and custom_fields', () => {
    expect(
      getLeadFieldValue(
        { email: 'a@b.nl', custom_fields: { daktype: 'Plat' } },
        'daktype',
      ),
    ).toBe('Plat');
    expect(getLeadFieldValue({ email: 'a@b.nl' }, 'email')).toBe('a@b.nl');
  });
});

describe('suggestFieldMapping', () => {
  it('matches email label to contact field', () => {
    const portal = getPortalFieldsForBranch([{ key: 'daktype', label: 'Type dak' }]);
    const tlContact: TeamleaderCustomFieldDefinition[] = [
      { id: 'tl-1', label: 'E-mailadres', type: 'email', context: 'contact' },
    ];
    const mapping = suggestFieldMapping(portal, tlContact, []);
    expect(mapping.contact.email).toBe('tl-1');
  });
});

describe('suggestDefaultFieldMapping', () => {
  it('maps native standard fields to contact and branch fields to deal summary', () => {
    const portal = getPortalFieldsForBranch([{ key: 'daktype', label: 'Type dak' }]);
    const mapping = suggestDefaultFieldMapping(portal);
    expect(mapping.contact.email).toBe('_native');
    expect(mapping.contact.naam_klant).toBe('_native');
    expect(mapping.deal.daktype).toBe('_summary');
    expect(mapping.deal.provincie).toBe('_summary');
  });
});

describe('hasSavedFieldMappings', () => {
  it('returns false when empty', () => {
    expect(hasSavedFieldMappings(undefined, ['zonnepanelen'])).toBe(false);
    expect(hasSavedFieldMappings({ zonnepanelen: { contact: {}, deal: {} } }, ['zonnepanelen'])).toBe(
      false,
    );
  });

  it('returns true when a branch has mappings', () => {
    expect(
      hasSavedFieldMappings(
        { zonnepanelen: { contact: { email: 'tl-1' }, deal: {} } },
        ['zonnepanelen'],
      ),
    ).toBe(true);
  });
});

describe('formatValueForTeamleader', () => {
  it('formats boolean ja/nee', () => {
    expect(formatValueForTeamleader('ja', { id: '1', label: 'X', type: 'boolean', context: 'deal' })).toBe(
      true,
    );
  });

  it('matches single_select option', () => {
    const def: TeamleaderCustomFieldDefinition = {
      id: 'f1',
      label: 'Dak',
      type: 'single_select',
      context: 'deal',
      options: [{ id: 'opt-a', value: 'Plat dak' }],
    };
    expect(formatValueForTeamleader('Plat dak', def)).toBe('opt-a');
  });
});
