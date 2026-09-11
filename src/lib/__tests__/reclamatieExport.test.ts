import { describe, it, expect } from 'vitest';
import {
  buildReclamatieCsv,
  reclamatieNaarRij,
  reclamatieBestandsnaam,
  RECLAMATIE_KOLOMMEN,
  type ReclamatieRij,
} from '../reclamatieExport';

function rij(over: Partial<ReclamatieRij> = {}): ReclamatieRij {
  return {
    created_at: '2026-09-01T10:00:00Z',
    status: 'pending',
    reason: 'foutief_telefoonnummer',
    description: 'Nummer bestaat niet',
    resolved_at: null,
    admin_notes: null,
    customers: { name: 'Mediabink', email: 'info@mediabink.nl' },
    leads: {
      naam_klant: 'Jan Jansen',
      telefoonnummer: '0612345678',
      email: 'jan@example.nl',
      postcode: '1011 AB',
      plaatsnaam: 'Amsterdam',
      provincie: 'Noord-Holland',
      branch: 'thuisbatterij',
    },
    ...over,
  };
}

describe('buildReclamatieCsv', () => {
  it('zet een BOM vooraan zodat Excel de accenten goed leest', () => {
    expect(buildReclamatieCsv([])).toMatch(/^﻿/);
  });

  it('begint met de kopregel, ook zonder rijen', () => {
    const regels = buildReclamatieCsv([]).replace(/^﻿/, '').split('\r\n');
    expect(regels).toHaveLength(1);
    expect(regels[0].split(';')).toEqual([...RECLAMATIE_KOLOMMEN]);
  });

  it('geeft per reclamatie één regel met evenveel kolommen als de kop', () => {
    const csv = buildReclamatieCsv([rij(), rij()]).replace(/^﻿/, '');
    const regels = csv.split('\r\n');
    expect(regels).toHaveLength(3);
    for (const r of regels) {
      expect(r.split(';')).toHaveLength(RECLAMATIE_KOLOMMEN.length);
    }
  });

  it('vertaalt status en reden naar leesbare tekst', () => {
    const velden = reclamatieNaarRij(rij());
    expect(velden[1]).toBe('Openstaand');
    expect(velden[2]).toBe('Foutief telefoonnummer');
  });

  it('laat een onbekende reden staan zoals hij is', () => {
    expect(reclamatieNaarRij(rij({ reason: 'iets_nieuws' }))[2]).toBe('iets_nieuws');
  });

  it('overleeft een ontbrekende klant of lead', () => {
    const velden = reclamatieNaarRij(rij({ customers: null, leads: null }));
    expect(velden).toHaveLength(RECLAMATIE_KOLOMMEN.length);
    expect(velden.slice(6)).toEqual(['', '', '', '', '', '', '', '', '']);
  });

  it('laat een lege afhandeldatum leeg in plaats van "Invalid Date"', () => {
    expect(reclamatieNaarRij(rij({ resolved_at: null }))[4]).toBe('');
    expect(reclamatieNaarRij(rij({ created_at: 'onzin' }))[0]).toBe('');
  });

  it('zet een toelichting met puntkomma tussen aanhalingstekens', () => {
    /* Zonder ontsnappen zou deze ene lead de kolommen van de hele regel
       verschuiven en het bestand in Excel onleesbaar maken. */
    const csv = buildReclamatieCsv([rij({ description: 'fout; en dubbel' })]);
    expect(csv).toContain('"fout; en dubbel"');
    expect(csv.replace(/^﻿/, '').split('\r\n')[1].split('";"').length).toBeGreaterThan(0);
  });

  it('verdubbelt aanhalingstekens in de tekst', () => {
    expect(buildReclamatieCsv([rij({ description: 'klant zei "nee"' })]))
      .toContain('"klant zei ""nee"""');
  });

  it('houdt een regeleinde binnen één cel', () => {
    const csv = buildReclamatieCsv([rij({ admin_notes: 'regel 1\nregel 2' })]);
    expect(csv).toContain('"regel 1\nregel 2"');
  });
});

describe('reclamatieBestandsnaam', () => {
  it('noemt de status in de bestandsnaam', () => {
    expect(reclamatieBestandsnaam('pending')).toMatch(/^reclamaties-openstaand-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(reclamatieBestandsnaam('all')).toMatch(/^reclamaties-alle-/);
    expect(reclamatieBestandsnaam('rejected')).toMatch(/^reclamaties-afgewezen-/);
  });
});
