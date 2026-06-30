import { describe, it, expect } from 'vitest';
import { buildLeadExportTable } from '../leadExportTable';

const CORE_COUNT = 17; // aantal vaste kernkolommen

describe('buildLeadExportTable', () => {
  it('neemt branche-specifieke custom_fields mee als kolommen', () => {
    const { headers, rows } = buildLeadExportTable([
      {
        branch: 'thuisbatterij',
        naam_klant: 'Jan Jansen',
        custom_fields: {
          zonnepanelen: 'Ja',
          dynamisch_contract: 'Nee',
          stroomverbruik: '10000',
          reden_thuisbatterij: 'Verduurzamen',
        },
      },
    ]);
    expect(headers).toContain('Zonnepanelen');
    expect(headers).toContain('Dynamisch contract');
    expect(headers).toContain('Stroomverbruik');
    expect(headers).toContain('Reden thuisbatterij');

    const row = rows[0];
    expect(row[headers.indexOf('Zonnepanelen')]).toBe('Ja');
    expect(row[headers.indexOf('Stroomverbruik')]).toBe('10000');
    expect(row[headers.indexOf('Naam')]).toBe('Jan Jansen');
  });

  it('sluit interne custom_fields-sleutels uit', () => {
    const { headers } = buildLeadExportTable([
      { branch: 'thuisbatterij', custom_fields: { zonnepanelen: 'Ja', max_customer_assignments: 2, meta_lead_form_id: 'x' } },
    ]);
    expect(headers).toContain('Zonnepanelen');
    expect(headers).not.toContain('Max customer assignments');
    expect(headers).not.toContain('Meta lead form id');
  });

  it('vult lege custom_fields-cellen netjes als lege string (sparse over leads)', () => {
    const { headers, rows } = buildLeadExportTable([
      { branch: 'zonnepanelen', custom_fields: { verbruik_in_kwh: '5000', orientatie_dak: 'Zuid' } },
      { branch: 'isolatie', custom_fields: { interesse: 'Spouwmuur' } },
    ]);
    expect(headers).toContain('Verbruik in kWh');
    expect(headers).toContain('Interesse');
    // lead 2 heeft geen verbruik_in_kwh -> lege cel, geen crash
    expect(rows[1][headers.indexOf('Verbruik in kWh')]).toBe('');
    expect(rows[0][headers.indexOf('Interesse')]).toBe('');
  });

  it('zet booleans om naar Ja/Nee en arrays naar komma-lijst', () => {
    const { headers, rows } = buildLeadExportTable([
      { branch: 'x', custom_fields: { akkoord: true, categorieen: ['A', 'B'] } },
    ]);
    expect(rows[0][headers.indexOf('Akkoord')]).toBe('Ja');
    expect(rows[0][headers.indexOf('Categorieen')]).toBe('A, B');
  });

  it('neemt een gevulde legacy-kolom mee als die niet in custom_fields zit', () => {
    const { headers, rows } = buildLeadExportTable([
      { branch: 'airco', type_airco: 'Mono-split', custom_fields: {} },
    ]);
    expect(headers).toContain('Type airco');
    expect(rows[0][headers.indexOf('Type airco')]).toBe('Mono-split');
  });

  it('houdt alleen kernkolommen aan als er geen branche-data is', () => {
    const { headers } = buildLeadExportTable([{ branch: 'x', custom_fields: {} }]);
    expect(headers).toHaveLength(CORE_COUNT);
  });
});
