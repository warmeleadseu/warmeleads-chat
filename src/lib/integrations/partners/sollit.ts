import { splitsNaam } from '../outboundWebhook/naam';
import { kortAntwoord } from './verberg';
import type { PartnerAntwoord, PartnerDefinitie, PartnerLead, PartnerPayloadContext, PartnerUitslag } from './types';

/**
 * Sollit (voorheen 2Solar): CRM voor installateurs van zonnepanelen,
 * thuisbatterijen en warmtepompen. Eerste klant: Solaris Prime (29 okt 2026).
 *
 * API (https://api-doc.2solar.nl/?url=person.json):
 * - POST https://app.sollit.com/api/person maakt een aanvraag (lead) aan
 * - Authorization: Bearer <API-sleutel>, per klant aangemaakt in Sollit
 * - postcode en number zijn verplicht (400 zonder, 422 bij een onbekende
 *   combinatie; die controle zetten we uit met skip_postcode_check, zodat
 *   een lead nooit om een adres wordt geweigerd)
 * - 200 met het id van de nieuwe aanvraag; 401 ongeldige sleutel;
 *   429 boven 100 per minuut of 2000 per uur per sleutel; 5xx storing
 * - een sleutel kan alleen aanmaakrechten hebben (lezen geeft dan 401)
 */

const ENDPOINT = 'https://app.sollit.com/api/person';
const SLEUTEL = /^[A-Za-z0-9]{20,128}$/;

/** De API-sleutel zoals de klant hem uit Sollit kopieert (eventueel met "Bearer "). */
export function leesSollitSleutel(invoer: string): string | null {
  const s = invoer.trim().replace(/^['"]|['"]$/g, '').trim().replace(/^Bearer\s+/i, '');
  return SLEUTEL.test(s) ? s : null;
}

function leeg(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function tekst(v: unknown): string | null {
  if (leeg(v)) return null;
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nee';
  if (Array.isArray(v)) {
    const delen = v.filter(x => !leeg(x)).map(x => String(x).trim());
    return delen.length > 0 ? delen.join(', ') : null;
  }
  if (typeof v === 'object') return null;
  return String(v).trim();
}

/** Onze branche naar het producttype van Sollit; onbekend = weglaten. */
const PRODUCT: Record<string, string> = {
  thuisbatterij: 'battery',
  zonnepanelen: 'solar_panel',
  warmtepomp: 'heat_pump',
  airco: 'airco',
  laadpaal: 'charge_station',
  laadpalen: 'charge_station',
  groepenkast: 'fuse_box',
};

const LAND: Record<string, string> = { NL: 'Netherlands', BE: 'Belgium', DE: 'Germany', ES: 'Spain' };

/** Huisnummer splitsen in nummer en toevoeging: "12a" -> 12 + a, "12-2" -> 12 + 2. */
export function splitsHuisnummer(v: string | null): { nummer: string | null; toevoeging: string | null } {
  const s = tekst(v);
  if (!s) return { nummer: null, toevoeging: null };
  const m = /^(\d+)\s*[-\s/]?\s*(.*)$/.exec(s);
  if (!m) return { nummer: s, toevoeging: null };
  return { nummer: m[1], toevoeging: m[2] ? m[2].trim() || null : null };
}

function isMobiel(tel: string): boolean {
  const n = tel.replace(/[\s-]/g, '');
  return /^(\+316|00316|06|\+324|00324|04)/.test(n);
}

export function bouwSollitPayload(lead: PartnerLead, ctx: PartnerPayloadContext): Record<string, unknown> {
  const naam = splitsNaam(lead.naam_klant);
  const cf = lead.custom_fields ?? {};
  const huis = splitsHuisnummer(lead.huisnummer);
  const tel = tekst(lead.telefoonnummer);

  /* Alleen de antwoorden op de vragen van de branche, met hun leesbare label. */
  const antwoorden: string[] = [];
  for (const veld of ctx.toegestaneVelden) {
    const waarde = tekst(cf[veld.key]);
    if (waarde) antwoorden.push(`${veld.label || veld.key}: ${waarde}`);
  }
  const product = PRODUCT[(lead.branch ?? '').toLowerCase()];
  const land = LAND[(tekst(lead.land) ?? 'NL').toUpperCase()];

  const opmerking = [
    `Lead van WarmeLeads${ctx.brancheNaam ? ` (${ctx.brancheNaam})` : ''}.`,
    ...antwoorden,
  ].join('\n');

  const basis: Record<string, unknown> = {
    skip_postcode_check: true,
    postcode: tekst(lead.postcode)?.replace(/\s+/g, '').toUpperCase() ?? null,
    number: huis.nummer,
    number_ext: huis.toevoeging,
    first_name: naam.voornaam,
    last_name: naam.achternaam,
    email: tekst(lead.email),
    street: tekst(ctx.straat),
    city: tekst(lead.plaatsnaam),
    country: land ?? null,
    language: (tekst(lead.land) ?? 'NL').toUpperCase() === 'DE' ? 'de' : 'nl',
    mobile: tel && isMobiel(tel) ? tel : null,
    telephone: tel && !isMobiel(tel) ? tel : null,
    comments: opmerking,
    reference_number: lead.id,
    source_site: 'warmeleads.eu',
    product_type: product ?? null,
  };
  return Object.fromEntries(Object.entries(basis).filter(([, v]) => !leeg(v)));
}

/** Testlead: herkenbaar als test, met het adres van WarmeLeads. */
export function bouwSollitTestPayload(opties: { telefoon?: string | null } = {}): Record<string, unknown> {
  return {
    skip_postcode_check: true,
    postcode: '9723JP',
    number: '50',
    number_ext: 'a',
    first_name: 'TEST',
    last_name: 'WarmeLeads koppeling (mag verwijderd worden)',
    email: 'test@warmeleads.eu',
    street: 'Kattegat',
    city: 'Groningen',
    country: 'Netherlands',
    language: 'nl',
    mobile: opties.telefoon || '0612345678',
    comments: 'Testlevering vanuit WarmeLeads om de koppeling met Sollit te controleren. Geen echte lead; deze aanvraag mag verwijderd worden.',
    reference_number: 'warmeleads-testlevering',
    source_site: 'warmeleads.eu',
    product_type: 'battery',
  };
}

export function beoordeelSollit(a: PartnerAntwoord): PartnerUitslag {
  if (a.timeout) return { soort: 'tijdelijk', melding: 'Geen antwoord van Sollit binnen de wachttijd' };
  if (a.netwerkfout || a.status === 0) return { soort: 'tijdelijk', melding: 'Sollit was niet bereikbaar' };
  if (a.status >= 200 && a.status < 300) return { soort: 'gelukt' };
  if (a.status === 429) {
    const sec = Number(a.retryAfter);
    return { soort: 'tijdelijk', melding: 'Sollit vraagt om even te wachten (te veel verzoeken)', wachtSeconden: Number.isFinite(sec) && sec > 0 ? sec : 60 };
  }
  if (a.status >= 500) return { soort: 'tijdelijk', melding: `Storing bij Sollit (HTTP ${a.status})` };
  if (a.status === 401 || a.status === 403) {
    return { soort: 'blijvend', melding: 'Sollit weigert de API-sleutel (HTTP 401). Maak in Sollit een nieuwe sleutel aan met rechten op Person en vul die opnieuw in.' };
  }
  const detail = kortAntwoord(a.body);
  return { soort: 'blijvend', melding: `Sollit weigerde de lead (HTTP ${a.status})${detail ? `: ${detail}` : ''}` };
}

export const SOLLIT: PartnerDefinitie = {
  id: 'sollit',
  provider: 'partner_sollit',
  naam: 'Sollit',
  tagline: 'Leads automatisch als aanvraag in je Sollit-CRM',
  logo: null,
  urlUitleg: 'Plak de API-sleutel uit Sollit (Instellingen › API). De sleutel heeft rechten nodig op Person.',
  invoerLabel: 'API-sleutel',
  invoerPlaceholder: 'Plak hier je API-sleutel uit Sollit',
  leesToken: leesSollitSleutel,
  bouwUrl: () => ENDPOINT,
  urlHint: token => `API-sleutel ••••${token.slice(-4)}`,
  authHeader: token => `Bearer ${token}`,
  bouwPayload: bouwSollitPayload,
  bouwTestPayload: bouwSollitTestPayload,
  beoordeel: beoordeelSollit,
  /* Sollit controleert en verrijkt het adres; dat duurt soms even. */
  timeoutMs: 20_000,
  /* 100 per minuut per sleutel; met 0,7 seconde ertussen blijven we eronder. */
  pauzeMs: 700,
  maxLeeftijdUren: 72,
};
