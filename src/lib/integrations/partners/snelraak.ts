import { splitsNaam } from '../outboundWebhook/naam';
import { kortAntwoord } from './verberg';
import type { PartnerAntwoord, PartnerDefinitie, PartnerLead, PartnerPayloadContext, PartnerUitslag } from './types';

/**
 * Snelraak: automatische leadopvolging via WhatsApp voor een deel van onze klanten.
 *
 * Afspraken (mail Snelraak, 2 okt 2026):
 * - per klant een eigen, geheim adres: https://snelraak.nl/api/v1/ingest/<token>
 * - per lead één POST met JSON; `lead_id` gebruiken zij om te ontdubbelen
 * - `phone` is het belangrijkste veld; extra velden mogen mee
 * - test: `"is_test": true`
 * - 200 {"ok":true} = ontvangen; 404 = verkeerde URL; 429 of 5xx = later opnieuw
 * - maximaal 120 verzoeken per minuut, body maximaal 256 KB
 *
 * Bevestigd door Snelraak (2 okt 2026):
 * - ontdubbeling op lead_id geldt per afleveradres; dezelfde lead bij twee
 *   klanten aanleveren kan gewoon (twee adressen)
 * - de limiet van 120 per minuut geldt per afleveradres, dus per klant
 * - Snelraak is verwerker van de klant; tussen WarmeLeads en Snelraak bestaat
 *   geen verwerkersrelatie (wij leveren in opdracht van dezelfde klant)
 */

const BASIS = 'https://snelraak.nl/api/v1/ingest/';
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Accepteert alleen een echte Snelraak-URL. Strikt met opzet: dit veld bepaalt
 * waar de persoonsgegevens van onze leads heen gaan, dus geen andere host,
 * geen poort, geen inloggegevens, geen extra parameters.
 */
export function leesSnelraakToken(invoer: string): string | null {
  let url: URL;
  try {
    url = new URL(invoer.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== 'snelraak.nl') return null;
  if (url.port !== '' || url.username !== '' || url.password !== '') return null;
  if (url.search !== '' || url.hash !== '') return null;
  const m = /^\/api\/v1\/ingest\/([^/]+)\/?$/.exec(url.pathname);
  if (!m || !TOKEN.test(m[1])) return null;
  return m[1];
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

/** Payload volgens de veldnamen die Snelraak aanbeveelt. Lege velden laten we weg. */
export function bouwSnelraakPayload(lead: PartnerLead, ctx: PartnerPayloadContext): Record<string, unknown> {
  const naam = splitsNaam(lead.naam_klant);
  const cf = lead.custom_fields ?? {};

  /* Alleen de antwoorden op de vragen van de branche, met hun leesbare label.
     Interne sleutels (zoals Meta-formulier-ID's of een plafond per lead) staan
     ook in custom_fields, maar horen niet bij een derde partij. */
  const antwoorden: { key: string; label: string; waarde: string }[] = [];
  for (const veld of ctx.toegestaneVelden) {
    const waarde = tekst(cf[veld.key]);
    if (waarde) antwoorden.push({ key: veld.key, label: veld.label || veld.key, waarde });
  }

  const basis: Record<string, unknown> = {
    payload_version: 1,
    source: 'WarmeLeads',
    lead_id: lead.id,
    first_name: naam.voornaam,
    last_name: naam.achternaam,
    full_name: tekst(lead.naam_klant),
    phone: tekst(lead.telefoonnummer),
    email: tekst(lead.email),
    street: tekst(ctx.straat),
    house_number: tekst(lead.huisnummer),
    postal_code: tekst(lead.postcode),
    city: tekst(lead.plaatsnaam),
    province: tekst(lead.provincie),
    country: tekst(lead.land) ?? 'NL',
    product: tekst(ctx.brancheNaam) ?? tekst(lead.branch),
    description: antwoorden.length > 0 ? antwoorden.map(a => `${a.label}: ${a.waarde}`).join('. ') : null,
    lead_created_at: tekst(lead.created_at),
  };

  /* De antwoorden ook als losse velden, zodat Snelraak ze kan gebruiken. Een
     antwoord overschrijft nooit een vast veld met dezelfde naam. */
  for (const a of antwoorden) {
    if (!(a.key in basis)) basis[a.key] = a.waarde;
  }

  return Object.fromEntries(Object.entries(basis).filter(([, v]) => !leeg(v)));
}

/** Vaste nepgegevens; het nummer is het voorbeeldnummer uit de documentatie van Snelraak. */
export function bouwSnelraakTestPayload(opties: { telefoon?: string | null } = {}): Record<string, unknown> {
  return {
    payload_version: 1,
    source: 'WarmeLeads',
    is_test: true,
    lead_id: 'warmeleads-testlevering',
    first_name: 'Test',
    last_name: 'Testpersoon',
    full_name: 'Test Testpersoon',
    phone: opties.telefoon || '+31612345678',
    email: 'test@example.com',
    postal_code: '1234AB',
    city: 'Teststad',
    country: 'NL',
    product: 'Thuisbatterij',
    description: 'Testlevering vanuit WarmeLeads om de koppeling te controleren. Geen echte lead.',
  };
}

export function beoordeelSnelraak(a: PartnerAntwoord): PartnerUitslag {
  if (a.timeout) return { soort: 'tijdelijk', melding: 'Geen antwoord van Snelraak binnen de wachttijd' };
  if (a.netwerkfout || a.status === 0) return { soort: 'tijdelijk', melding: 'Snelraak was niet bereikbaar' };

  if (a.status >= 200 && a.status < 300) {
    try {
      if ((JSON.parse(a.body) as { ok?: unknown })?.ok === true) return { soort: 'gelukt' };
    } catch {
      /* geen JSON: valt hieronder */
    }
    return { soort: 'tijdelijk', melding: `Onverwacht antwoord van Snelraak: ${kortAntwoord(a.body) || '(leeg)'}` };
  }

  if (a.status === 429) {
    const sec = Number(a.retryAfter);
    return {
      soort: 'tijdelijk',
      melding: 'Snelraak vraagt om even te wachten (te veel verzoeken)',
      wachtSeconden: Number.isFinite(sec) && sec > 0 ? sec : null,
    };
  }
  if (a.status >= 500) return { soort: 'tijdelijk', melding: `Storing bij Snelraak (HTTP ${a.status})` };

  if (a.status === 404) {
    return {
      soort: 'blijvend',
      melding: 'Snelraak kent dit afleveradres niet (HTTP 404). Vraag Snelraak om het juiste adres en vul dat opnieuw in.',
    };
  }
  if (a.status >= 300 && a.status < 400) {
    return { soort: 'blijvend', melding: `Snelraak stuurde ons door (HTTP ${a.status}); controleer het afleveradres` };
  }
  const detail = kortAntwoord(a.body);
  return { soort: 'blijvend', melding: `Snelraak weigerde de lead (HTTP ${a.status})${detail ? `: ${detail}` : ''}` };
}

export const SNELRAAK: PartnerDefinitie = {
  id: 'snelraak',
  provider: 'partner_snelraak',
  naam: 'Snelraak',
  tagline: 'Automatische leadopvolging via WhatsApp',
  logo: '/partners/snelraak.png',
  urlUitleg: 'Plak het afleveradres dat je van Snelraak kreeg (begint met https://snelraak.nl/api/v1/ingest/).',
  leesToken: leesSnelraakToken,
  bouwUrl: token => `${BASIS}${token}`,
  urlHint: token => `${BASIS}••••${token.slice(-4)}`,
  bouwPayload: bouwSnelraakPayload,
  bouwTestPayload: bouwSnelraakTestPayload,
  beoordeel: beoordeelSnelraak,
  timeoutMs: 10_000,
  /* 120 per minuut per afleveradres is hun grens; met ruim een halve seconde
     tussen twee leveringen aan hetzelfde adres blijven we eronder. */
  pauzeMs: 600,
  /* Gelijk aan het venster van de retry-cron. */
  maxLeeftijdUren: 72,
};
