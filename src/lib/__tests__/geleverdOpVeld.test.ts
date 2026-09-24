import { describe, it, expect } from 'vitest';
import { PORTAL_STANDARD_FIELDS } from '../teamleader/standardFields';
import { getLeadFieldValue, getPortalFieldsForBranch } from '../teamleader/fieldMappingLogic';
import { buildSheetRowValues } from '../googleSheets/fieldMappingLogic';

/**
 * De spreadsheet van een klant toonde de wervingsdatum, terwijl het portaal de
 * leverdatum toont (received_at). Twee schermen die iets anders zeggen over
 * dezelfde lead. Dit veld maakt de leverdatum koppelbaar zodat ze gelijk staan.
 */

describe('het veld geleverd_op', () => {
  it('staat tussen de standaardvelden en is dus koppelbaar', () => {
    const veld = PORTAL_STANDARD_FIELDS.find(f => f.key === 'geleverd_op');
    expect(veld).toBeDefined();
    expect(veld!.label).toBe('Geleverd op');
  });

  it('verschijnt in de keuzelijst naast de wervingsdatum', () => {
    const velden = getPortalFieldsForBranch([]);
    const sleutels = velden.map(v => v.key);
    expect(sleutels).toContain('geleverd_op');
    expect(sleutels).toContain('wervingsdatum');
  });

  it('vervangt de wervingsdatum niet', () => {
    /* Beide moeten kunnen bestaan: wie de herkomst wil tonen houdt de
       wervingsdatum, wie de leverdatum wil koppelt dit veld. */
    expect(PORTAL_STANDARD_FIELDS.find(f => f.key === 'wervingsdatum')).toBeDefined();
  });

  it('wordt uit het leadobject gelezen zoals elk ander veld', () => {
    const lead = { geleverd_op: '24-9-2026', wervingsdatum: '2026-06-25' };
    expect(getLeadFieldValue(lead, 'geleverd_op')).toBe('24-9-2026');
    expect(getLeadFieldValue(lead, 'wervingsdatum')).toBe('2026-06-25');
  });

  it('belandt in de juiste kolom van de spreadsheetrij', () => {
    const rij = buildSheetRowValues(
      { naam_klant: 'Jan', geleverd_op: '24-9-2026' },
      { naam_klant: '0', geleverd_op: '1' },
      2,
    );
    expect(rij).toEqual(['Jan', '24-9-2026']);
  });

  it('laat de cel leeg als de waarde ontbreekt in plaats van "undefined"', () => {
    const rij = buildSheetRowValues({ naam_klant: 'Jan' }, { naam_klant: '0', geleverd_op: '1' }, 2);
    expect(rij).toEqual(['Jan', '']);
  });
});
