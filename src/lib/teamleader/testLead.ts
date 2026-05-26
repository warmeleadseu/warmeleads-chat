import { normalizeCustomerBranchSlugs } from '@/lib/customerBranches';
import type { TeamleaderLeadRecord } from './syncLeadRecord';

/** Realistische voorbeeldwaarden per branche voor integratietests. */
const BRANCH_SAMPLE_VALUES: Record<string, Record<string, string>> = {
  thuisbatterij: {
    zonnepanelen: 'Ja, 12 panelen sinds 2022',
    dynamisch_contract: 'Ja',
    stroomverbruik: '4500 kWh/jaar',
    budget: '€8.000 - €12.000',
    reden_thuisbatterij: 'Zelfconsumptie verhogen en dynamisch tarief benutten',
  },
  airco: {
    type_airco: 'Split-unit',
    koelen_verwarmen: 'Koelen en verwarmen',
    hoeveel_ruimtes: '3 ruimtes',
    zakelijk: 'Nee, particulier',
    koop_of_huur: 'Koop',
    boorwerkzaamheden_toegestaan: 'Ja',
  },
  zonnepanelen: {
    daktype: 'Schuin dak, pannen',
    stroomverbruik: '5200 kWh/jaar',
    budget: '€6.500 - €9.000',
  },
  warmtepomp: {
    woningtype: 'Tussenwoning',
    bouwjaar: '1998',
    huidige_verwarming: 'CV-ketel op gas',
  },
};

export function pickTestBranchSlug(customerBranches: unknown): string {
  const branches = normalizeCustomerBranchSlugs(customerBranches);
  if (branches.includes('thuisbatterij')) return 'thuisbatterij';
  return branches[0] || 'thuisbatterij';
}

export function buildTeamleaderTestLead(
  branchSlug: string,
  customerId: string,
  branchFieldKeys: string[],
): TeamleaderLeadRecord {
  const samples: Record<string, string> = {
    ...(BRANCH_SAMPLE_VALUES[branchSlug] ?? {}),
  };
  for (const key of branchFieldKeys) {
    if (!samples[key]) {
      samples[key] = `Testwaarde (${key})`;
    }
  }

  const stamp = customerId.slice(0, 8);
  return {
    id: `test-${customerId}`,
    naam_klant: 'Warme Leads Test',
    email: `test+${stamp}@warmeleads.test`,
    telefoonnummer: '+31612345678',
    postcode: '5611AB',
    huisnummer: '12',
    plaatsnaam: 'Eindhoven',
    provincie: 'Noord-Brabant',
    branch: branchSlug,
    bron: 'integration_test',
    wervingsdatum: new Date().toISOString().slice(0, 10),
    notities:
      'Testlead vanuit Warme Leads portaal — veilig te verwijderen. Bevat alle branchevelden voor een volledige koppelingscheck.',
    custom_fields: samples,
  };
}
