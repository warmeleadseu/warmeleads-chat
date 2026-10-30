import { describe, expect, it } from 'vitest';
import { afstandTotWerkgebied, kiesMedewerker, type Medewerker, type Tellingen } from '../agentKeuze';

/* Het team van Smart Sales Company zoals het op 30 okt 2026 stond. */
const AMSTERDAM = { label: 'Amsterdam', lat: 52.37344272, lng: 4.90454379, radius_km: 30, land: 'NL' };
const HUIZEN = { label: 'Huizen', lat: 52.2986469, lng: 5.24206391, radius_km: 26, land: 'NL' };
const souhail: Medewerker = { id: 'souhail', regels: { mode: 'auto', gebieden: [AMSTERDAM] } };
const yasmine: Medewerker = { id: 'yasmine', regels: { mode: 'auto', gebieden: [AMSTERDAM] } };
const samir: Medewerker = { id: 'samir', regels: { mode: 'auto', gebieden: [HUIZEN], max_leads_per_day: 10 } };
const team = [souhail, yasmine, samir];
const leeg: Tellingen = { dag: {}, week: {} };

const plaats = {
  amsterdam: { lat: 52.37, lng: 4.9, provincie: 'Noord-Holland' },
  hilversum: { lat: 52.2292, lng: 5.1669, provincie: 'Noord-Holland' },
  denHaag: { lat: 52.0705, lng: 4.3007, provincie: 'Zuid-Holland' },
  lelystad: { lat: 52.5185, lng: 5.4714, provincie: 'Flevoland' },
  alkmaar: { lat: 52.6324, lng: 4.7534, provincie: 'Noord-Holland' },
};

describe('lead naar een medewerker', () => {
  it('binnen een werkgebied: eerlijk verdeeld tussen wie het dekt', () => {
    /* Amsterdam valt ook binnen Huizen 26 km, dus alle drie dekken het. */
    expect(kiesMedewerker(team, plaats.amsterdam, { dag: {}, week: { souhail: 5, yasmine: 3, samir: 9 } })).toMatchObject({ id: 'yasmine', reden: 'werkgebied' });
    expect(kiesMedewerker([souhail, yasmine], plaats.amsterdam, { dag: {}, week: { souhail: 1, yasmine: 3 } })?.id).toBe('souhail');
    expect(kiesMedewerker(team, plaats.hilversum, leeg)).toMatchObject({ reden: 'werkgebied' });
  });

  it('buiten alle werkgebieden: naar wie het dichtst bij werkt', () => {
    /* Den Haag en Alkmaar liggen dichter bij de Amsterdamse cirkel, Lelystad bij Huizen. */
    const haag = kiesMedewerker(team, plaats.denHaag, leeg);
    expect(haag?.reden).toBe('dichtstbij');
    expect(['souhail', 'yasmine']).toContain(haag?.id);
    expect(kiesMedewerker(team, plaats.lelystad, leeg)).toMatchObject({ id: 'samir', reden: 'dichtstbij' });
    expect(['souhail', 'yasmine']).toContain(kiesMedewerker(team, plaats.alkmaar, leeg)?.id);
  });

  it('even dichtbij (zelfde gebied): eerlijk tussen die twee', () => {
    expect(kiesMedewerker(team, plaats.denHaag, { dag: {}, week: { souhail: 4, yasmine: 1 } })?.id).toBe('yasmine');
    expect(kiesMedewerker(team, plaats.denHaag, { dag: {}, week: { souhail: 1, yasmine: 4 } })?.id).toBe('souhail');
  });

  it('limiet vol: naar de volgende die het dichtst bij is, en als iedereen vol zit toch de dichtstbijzijnde', () => {
    const samirVol: Tellingen = { dag: { samir: 10 }, week: { samir: 10 } };
    expect(kiesMedewerker(team, plaats.lelystad, samirVol)).toMatchObject({ reden: 'dichtstbij', bovenLimiet: false });
    expect(kiesMedewerker(team, plaats.lelystad, samirVol)?.id).not.toBe('samir');
    /* Samir alleen in het team en vol: hij krijgt hem toch. */
    expect(kiesMedewerker([samir], plaats.lelystad, samirVol)).toMatchObject({ id: 'samir', bovenLimiet: true });
    /* In zijn eigen gebied maar vol: naar wie het dichtst bij is, niet blijven liggen. */
    expect(kiesMedewerker(team, plaats.hilversum, samirVol)?.id).not.toBe('samir');
  });

  it('zonder coördinaten of zonder cirkels: eerlijk over het hele team', () => {
    expect(kiesMedewerker(team, { provincie: 'Zuid-Holland' }, { dag: {}, week: { souhail: 2, yasmine: 2, samir: 0 } }))
      .toMatchObject({ id: 'samir', reden: 'verdeeld' });
    const provincies: Medewerker[] = [
      { id: 'a', regels: { mode: 'auto', regions: { type: 'provinces', values: ['Limburg'] } } },
      { id: 'b', regels: { mode: 'auto', regions: { type: 'provinces', values: ['Groningen'] } } },
    ];
    expect(kiesMedewerker(provincies, plaats.denHaag, { dag: {}, week: { a: 3, b: 1 } })).toMatchObject({ id: 'b', reden: 'verdeeld' });
  });

  it('handmatig krijgt nooit automatisch; zonder automatisch team blijft de lead open', () => {
    const handmatig: Medewerker = { id: 'h', regels: { mode: 'manual' } };
    expect(kiesMedewerker([handmatig, { id: 'leeg', regels: null }], plaats.amsterdam, leeg)).toBeNull();
    expect(kiesMedewerker([handmatig, samir], plaats.denHaag, leeg)?.id).toBe('samir');
    expect(kiesMedewerker([], plaats.amsterdam, leeg)).toBeNull();
  });

  it('"alle leads" en zonder werkgebied dekken alles', () => {
    expect(kiesMedewerker([{ id: 'alles', regels: { mode: 'all' } }, samir], plaats.denHaag, leeg)).toMatchObject({ id: 'alles', reden: 'werkgebied' });
    expect(kiesMedewerker([{ id: 'vrij', regels: { mode: 'auto' } }, samir], plaats.denHaag, leeg)).toMatchObject({ id: 'vrij', reden: 'werkgebied' });
  });

  it('branche telt mee zolang er iemand voor die branche is', () => {
    const airco: Medewerker = { id: 'airco', regels: { mode: 'auto', branches: ['airco'] } };
    const batterij: Medewerker = { id: 'batterij', regels: { mode: 'auto', branches: ['thuisbatterij'], gebieden: [HUIZEN] } };
    expect(kiesMedewerker([airco, batterij], { ...plaats.denHaag, branch: 'thuisbatterij' }, leeg)).toMatchObject({ id: 'batterij', reden: 'dichtstbij' });
    /* Niemand voor zonnepanelen: dan het hele team. */
    expect(kiesMedewerker([airco, batterij], { ...plaats.denHaag, branch: 'zonnepanelen' }, leeg)).not.toBeNull();
  });

  it('meet de afstand tot de rand van de cirkel', () => {
    expect(afstandTotWerkgebied(souhail.regels, plaats.amsterdam)).toBe(0);
    expect(afstandTotWerkgebied(souhail.regels, plaats.denHaag)).toBeGreaterThan(10);
    expect(afstandTotWerkgebied(souhail.regels, { provincie: 'Utrecht' })).toBeNull();
    expect(afstandTotWerkgebied({ mode: 'auto' }, plaats.amsterdam)).toBeNull();
  });
});
