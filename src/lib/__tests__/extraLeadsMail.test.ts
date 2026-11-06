import { describe, expect, it } from 'vitest';
import {
  MAX_LEADS_IN_MAIL, MAX_PER_REGIO, bouwIntroMail, budgetBovengrens, postcodeKlopt, bouwMaandagMail, kiesVoorbeelden, maandagVan, regiosVoorKlant,
  voornaamVan, type MailLead,
} from '../extraLeadsMail';
import { losseLeadBrancheVan } from '../extraLeadsMailVerzenden';

let n = 0;
const lead = (over: Partial<MailLead> = {}): MailLead => ({
  id: `l${++n}`, branch: 'thuisbatterij', plaats: 'Zwolle', provincie: 'Overijssel', land: 'NL', prijs_excl: 15, antwoorden: [], ...over,
});
const naam = (s: string) => ({ thuisbatterij: 'Thuisbatterij', warmtepomp: 'Warmtepomp', airco: 'Airco' }[s] ?? s);
const basis = { brancheNaam: naam, voornaam: 'Jan', afmeldUrl: 'https://www.warmeleads.eu/email/unsubscribe?token=abc' };

describe('introductiemail', () => {
  it('toont het aanbod, de laagste prijs, de stappen en de afmeldlink', () => {
    const m = bouwIntroMail({ ...basis, leads: [lead(), lead({ branch: 'airco', prijs_excl: 7.5 }), lead({ branch: 'warmtepomp', prijs_excl: 10 })] })!;
    expect(m.onderwerp).toBe('Nieuw: leads die niemand anders heeft, vanaf €7,50');
    expect(m.aantal).toBe(3);
    expect(m.html).toContain('Hallo Jan,');
    expect(m.html).toContain('3 extra leads');
    expect(m.html).toContain('Zo werkt het');
    expect(m.html).toContain('Reken af.');
    expect(m.html).toContain('/portal/extra-leads');
    expect(m.html).toContain(basis.afmeldUrl);
  });
  it('zegt nergens wanneer een prijs zakt', () => {
    const m = bouwIntroMail({ ...basis, leads: [lead()] })!;
    expect(m.html).not.toMatch(/morgen|zakt|over \d+ dag|goedkoper/i);
  });
  it('geen aanbod: geen mail', () => {
    expect(bouwIntroMail({ ...basis, leads: [] })).toBeNull();
  });
  it('zonder voornaam een nette aanhef, en tekst uit leads wordt ge-escaped', () => {
    const m = bouwIntroMail({ ...basis, voornaam: '', leads: [lead({ plaats: '<b>Ede</b>' })] })!;
    expect(m.html).toContain('Hallo,');
    expect(m.html).toContain('&lt;b&gt;Ede&lt;/b&gt;');
  });
});

describe('maandagmail', () => {
  it('alleen de branches van de klant, eigen regio bovenaan', () => {
    const leads = [
      lead({ provincie: 'Gelderland' }), lead({ provincie: 'Gelderland' }),
      lead({ provincie: 'Friesland' }),
      lead({ provincie: 'Friesland', branch: 'airco' }),
    ];
    const r = regiosVoorKlant(leads, new Set(['thuisbatterij']), ['Friesland']);
    expect(r.map(x => [x.regio, x.eigen, x.leads.length])).toEqual([['Friesland', true, 1], ['Gelderland', false, 2]]);
    const m = bouwMaandagMail({ ...basis, leads, eigenBranches: new Set(['thuisbatterij']), eigenRegios: ['Friesland'] })!;
    expect(m.aantal).toBe(3);
    expect(m.onderwerp).toBe('1 extra lead bij jou in de buurt, vanaf €15');
    expect(m.html).toContain('BIJ JOU IN DE BUURT');
    expect(m.html).not.toContain('Airco');
  });
  it('niets in de branches van de klant: geen mail', () => {
    expect(bouwMaandagMail({ ...basis, leads: [lead({ branch: 'airco' })], eigenBranches: new Set(['warmtepomp']), eigenRegios: [] })).toBeNull();
  });
  it('geen eigen regio met aanbod: onderwerp noemt het totaal', () => {
    const m = bouwMaandagMail({ ...basis, leads: [lead(), lead()], eigenBranches: new Set(['thuisbatterij']), eigenRegios: ['Zeeland'] })!;
    expect(m.onderwerp).toBe('2 extra leads te koop deze week, vanaf €15');
  });
  it('per regio maximaal acht, en in totaal maximaal veertig leads in de mail', () => {
    const veel = Array.from({ length: 12 }, () => lead({ provincie: 'Utrecht' }));
    const m = bouwMaandagMail({ ...basis, leads: veel, eigenBranches: new Set(['thuisbatterij']), eigenRegios: [] })!;
    expect(m.html.match(/Zwolle/g)).toHaveLength(MAX_PER_REGIO);
    expect(m.html).toContain('+ 4 meer in Utrecht');
    const provincies = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const nogMeer = provincies.flatMap(p => Array.from({ length: 8 }, () => lead({ provincie: p })));
    const m2 = bouwMaandagMail({ ...basis, leads: nogMeer, eigenBranches: new Set(['thuisbatterij']), eigenRegios: [] })!;
    expect(m2.html.match(/Zwolle/g)).toHaveLength(MAX_LEADS_IN_MAIL);
    expect(m2.html).toContain('En nog 16 leads in 2 andere regio');
  });
  it('Belgische leads zonder provincie vallen onder België', () => {
    const r = regiosVoorKlant([lead({ provincie: null, land: 'BE' })], new Set(['thuisbatterij']), []);
    expect(r[0].regio).toBe('België');
  });
  it('Belgisch en Nederlands Limburg zijn aparte regio\'s', () => {
    const r = regiosVoorKlant([lead({ provincie: 'Limburg', land: 'BE' }), lead({ provincie: 'Limburg', land: 'NL' })], new Set(['thuisbatterij']), ['Limburg']);
    expect(r.map(x => [x.regio, x.eigen])).toEqual([['Limburg', true], ['Limburg (België)', false]]);
  });
});

describe('hulpjes', () => {
  it('voornaam uit de contactpersoon', () => {
    expect(voornaamVan('Jan de Vries')).toBe('Jan');
    expect(voornaamVan('  ')).toBe('');
    expect(voornaamVan(null)).toBe('');
    expect(voornaamVan('info@bedrijf.nl')).toBe('');
  });
  it('maandag van de week, in Nederlandse tijd', () => {
    expect(maandagVan(new Date('2026-11-06T12:00:00Z'))).toBe('2026-11-02');
    expect(maandagVan(new Date('2026-11-09T06:30:00Z'))).toBe('2026-11-09');
    /* Zondag 23:30 UTC is in Nederland al maandag. */
    expect(maandagVan(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09');
  });
  it('voorbeelden uit verschillende branches, met minstens één voordelige lead', () => {
    const v = kiesVoorbeelden([lead(), lead(), lead({ branch: 'airco' }), lead({ branch: 'warmtepomp', plaats: null }), lead({ branch: 'warmtepomp' }), lead({ branch: 'warmtepomp', prijs_excl: 10 })]);
    expect(v.map(l => [l.branch, l.prijs_excl])).toEqual([['thuisbatterij', 15], ['airco', 15], ['warmtepomp', 10]]);
  });
  it('12,50 telt niet als voordelig voorbeeld; 7,50 of 10 wel', () => {
    const v = kiesVoorbeelden([lead({ prijs_excl: 12.5 }), lead({ branch: 'airco' }), lead({ branch: 'airco', prijs_excl: 7.5 })], 2);
    expect(v.map(l => [l.branch, l.prijs_excl])).toEqual([['thuisbatterij', 12.5], ['airco', 7.5]]);
  });
  it('geen voorbeeld met een postcode die niet bij het land past', () => {
    const v = kiesVoorbeelden([lead({ id: 'raar', postcode_klopt: false }), lead({ id: 'goed' })], 1);
    expect(v.map(l => l.id)).toEqual(['goed']);
    expect(postcodeKlopt('5697cc', 'BE')).toBe(false);
    expect(postcodeKlopt('2000', 'BE')).toBe(true);
    expect(postcodeKlopt('7711 ks', 'NL')).toBe(true);
    expect(postcodeKlopt('0123AB', 'NL')).toBe(false);
    expect(postcodeKlopt(null, 'NL')).toBe(false);
  });
  it('twee leads met "meer dan" gaan voor een lager budget, ook als die nieuwer is', () => {
    const b = (waarde: string, id: string) => lead({ id, antwoorden: [{ label: 'Budget', waarde }] });
    const v = kiesVoorbeelden([b('Tussen de €5000,- en 7500,-', 'midden'), b('Meer dan €7500,-', 'hoog1'), b('Meer dan €7500,-', 'hoog2')], 1);
    expect(v.map(l => l.id)).toEqual(['hoog1']);
  });
  it('alles 15 euro en geen voordelige lead: dan blijft het zo', () => {
    expect(kiesVoorbeelden([lead(), lead({ branch: 'airco' })]).map(l => l.prijs_excl)).toEqual([15, 15]);
  });
  it('geen laag budget als voorbeeld; het hoogste budget eerst en vooraan getoond', () => {
    const laag = lead({ id: 'laag', antwoorden: [{ label: 'Budget', waarde: 'Tussen de €2500,- en €5000,-' }] });
    const midden = lead({ id: 'midden', antwoorden: [{ label: 'Stroomverbruik', waarde: '6000' }, { label: 'Budget', waarde: 'Tussen de €5000,- en 7500,-' }] });
    const hoog = lead({ id: 'hoog', antwoorden: [{ label: 'Stroomverbruik', waarde: '9500' }, { label: 'Budget', waarde: 'Meer dan €7500,-' }] });
    const v = kiesVoorbeelden([laag, midden, hoog], 1);
    expect(v.map(l => l.id)).toEqual(['hoog']);
    expect(v[0].antwoorden[0]).toEqual({ label: 'Budget', waarde: 'Meer dan €7500,-' });
    expect(kiesVoorbeelden([laag], 1)).toEqual([]);
    /* Airco kent geen ondergrens. */
    expect(kiesVoorbeelden([lead({ branch: 'airco', antwoorden: [{ label: 'Budget', waarde: 'Tot €2.500' }] })], 1)).toHaveLength(1);
  });
  it('bovengrens van het budget', () => {
    expect(budgetBovengrens(lead({ antwoorden: [{ label: 'Budget', waarde: 'Tussen de €2500,- en €5000,-' }] }))).toBe(5000);
    expect(budgetBovengrens(lead({ antwoorden: [{ label: 'Budget', waarde: 'Tot €2.500' }] }))).toBe(2500);
    expect(budgetBovengrens(lead({ antwoorden: [{ label: 'Budget', waarde: 'Meer dan €7500,-' }] }))).toBe(Infinity);
    expect(budgetBovengrens(lead())).toBeNull();
  });
  it('partnerbranches horen bij de gewone branche', () => {
    expect(losseLeadBrancheVan('thuisbatterij_partners')).toBe('thuisbatterij');
    expect(losseLeadBrancheVan('zonnepaneel_partners')).toBe('zonnepanelen');
    expect(losseLeadBrancheVan('kozijnen')).toBeNull();
  });
});
