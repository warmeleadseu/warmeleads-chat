import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  PROSPECT_EXPORT_COLUMNS,
  buildProspectsCsv,
  buildProspectsXlsx,
  prospectToExportRow,
  prospectsExportFilenameBase,
} from '@/lib/prospectsExport';

describe('PROSPECT_EXPORT_COLUMNS', () => {
  it('bevat alle verwachte kolommen in vaste volgorde', () => {
    expect(PROSPECT_EXPORT_COLUMNS).toEqual([
      'Bedrijfsnaam',
      'Contactpersoon',
      'E-mail',
      'Telefoon',
      'Website',
      'KVK-nummer',
      'BTW-ID',
      'Adres',
      'Postcode',
      'Plaats',
      'Land',
      'Branches',
      'Bedrijfsgrootte',
      'Status',
      'Verloren reden',
      'Bron',
      'Accountmanager',
      'Volgende actie',
      'Status sinds',
      'Aangemaakt',
      'Bijgewerkt',
      'Notities',
    ]);
  });
});

describe('prospectToExportRow', () => {
  it('mapt een volle prospect-rij naar de juiste cellen', () => {
    const row = prospectToExportRow(
      {
        company_name: 'Acme BV',
        contact_person: 'Jan Jansen',
        email: 'jan@acme.nl',
        phone: '+31612345678',
        website: 'https://acme.nl',
        kvk_nummer: '12345678',
        vat_id: 'NL123456789B01',
        address: 'Hoofdstraat 1',
        postcode: '1000AA',
        city: 'Amsterdam',
        country: 'NL',
        branches: ['thuisbatterij_partners', 'airco'],
        company_size: '10-49',
        status: 'gekwalificeerd',
        lost_reason: null,
        source: 'meta_partner',
        account_manager_id: 'admin-1',
        next_action_at: '2026-07-01T09:00:00.000Z',
        status_changed_at: '2026-06-10T08:00:00.000Z',
        created_at: '2026-06-01T07:00:00.000Z',
        updated_at: '2026-06-12T10:00:00.000Z',
        notes: 'Belangrijke prospect',
      },
      {
        accountManagerNames: { 'admin-1': 'Rick Schlimback' },
        branchNames: {
          thuisbatterij_partners: 'Thuisbatterij Partners',
          airco: 'Airco',
        },
      },
    );

    expect(row[0]).toBe('Acme BV');
    expect(row[1]).toBe('Jan Jansen');
    expect(row[2]).toBe('jan@acme.nl');
    expect(row[5]).toBe('12345678');
    expect(row[11]).toBe('Thuisbatterij Partners, Airco');
    expect(row[13]).toBe('Gekwalificeerd');
    expect(row[15]).toBe('Meta partner');
    expect(row[16]).toBe('Rick Schlimback');
    expect(row[17]).toMatch(/01-07-2026/);
    expect(row[19]).toMatch(/01-06-2026/);
    expect(row[21]).toBe('Belangrijke prospect');
    expect(row).toHaveLength(PROSPECT_EXPORT_COLUMNS.length);
  });

  it('handelt missende velden af zonder undefined of null in de cellen', () => {
    const row = prospectToExportRow({ company_name: 'Onbekend bedrijf' });
    expect(row[0]).toBe('Onbekend bedrijf');
    for (const cell of row) {
      expect(typeof cell).toBe('string');
      expect(cell).not.toContain('undefined');
      expect(cell).not.toContain('null');
    }
    expect(row).toHaveLength(PROSPECT_EXPORT_COLUMNS.length);
  });

  it('valt terug op de raw slug als er geen branchNames-mapping is', () => {
    const row = prospectToExportRow({ branches: ['niet_bestaande_slug'] });
    expect(row[11]).toBe('niet_bestaande_slug');
  });

  it('valt terug op een lege string als de AM-id niet in de mapping zit', () => {
    const row = prospectToExportRow({ account_manager_id: 'unknown-id' }, {});
    expect(row[16]).toBe('');
  });
});

describe('buildProspectsCsv', () => {
  it('start met BOM, gebruikt `;` als separator en `\\r\\n` als regelscheiding', () => {
    const rows = [
      prospectToExportRow({ company_name: 'A', email: 'a@b.nl' }),
    ];
    const csv = buildProspectsCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(';');
    expect(csv).toContain('\r\n');
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe(PROSPECT_EXPORT_COLUMNS.join(';'));
    expect(lines[1].split(';')[0]).toBe('A');
  });

  it('escapet cellen met `;`, `"` en newlines correct', () => {
    const rows = [
      prospectToExportRow({
        company_name: 'A; B',
        contact_person: 'Naam met "quote"',
        notes: 'Eerste regel\nTweede regel',
      }),
    ];
    const csv = buildProspectsCsv(rows);
    const dataLine = csv.replace(/^\uFEFF/, '').split('\r\n')[1];
    expect(dataLine).toContain('"A; B"');
    expect(dataLine).toContain('"Naam met ""quote"""');
    expect(dataLine).toContain('"Eerste regel\nTweede regel"');
  });

  it('lege rijen → alleen de header (en een eventuele lege regel)', () => {
    const csv = buildProspectsCsv([]);
    const body = csv.replace(/^\uFEFF/, '');
    expect(body).toBe(PROSPECT_EXPORT_COLUMNS.join(';'));
  });
});

describe('buildProspectsXlsx', () => {
  it('produceert een geldig xlsx-bestand met header-row en data', () => {
    const rows = [
      prospectToExportRow({
        company_name: 'Acme',
        email: 'a@b.nl',
        status: 'nieuw',
      }),
      prospectToExportRow({
        company_name: 'Beta BV',
        email: 'b@b.nl',
        status: 'gewonnen',
      }),
    ];
    const buffer = buildProspectsXlsx(rows);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Prospects');

    const ws = wb.Sheets['Prospects'];
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(aoa[0]).toEqual([...PROSPECT_EXPORT_COLUMNS]);
    expect(aoa[1][0]).toBe('Acme');
    expect(aoa[2][0]).toBe('Beta BV');
    expect(aoa[1][13]).toBe('Nieuw');
    expect(aoa[2][13]).toBe('Gewonnen');
  });

  it('zet kolombreedtes op een redelijk maximum (50)', () => {
    const rows = [
      prospectToExportRow({
        company_name: 'X'.repeat(120),
      }),
    ];
    const buffer = buildProspectsXlsx(rows);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets['Prospects'];
    const cols = (ws['!cols'] || []) as { wch?: number }[];
    for (const c of cols) {
      expect(c.wch ?? 0).toBeLessThanOrEqual(50);
    }
  });
});

describe('prospectsExportFilenameBase', () => {
  it('bevat de datum in YYYY-MM-DD-formaat', () => {
    const stamp = prospectsExportFilenameBase(new Date('2026-06-12T10:00:00Z'));
    expect(stamp).toBe('prospects-export-2026-06-12');
  });
});
