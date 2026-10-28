/**
 * Losse leads in het portaal: welke leads te koop zijn, wat de klant ervan
 * ziet en wat ze kosten. Puur, zodat het te testen is en ook in het portaal
 * bruikbaar.
 *
 * Afspraak (27 okt 2026): leads die buiten de regio's van alle klanten vielen
 * en nog nooit zijn uitgedeeld, mag iedere klant met een account kopen voor
 * EUR 15 per stuk, alleen in deze vijf branches. Op 27 okt waren dat er in
 * twee weken ruim vijftig zonder enige klant.
 */

export const LOSSE_LEADS_BRANCHES = ['thuisbatterij', 'warmtepomp', 'zonnepanelen', 'airco', 'financial_lease'] as const;
export const LOSSE_LEAD_PRIJS = 15;
/** Alleen verse leads: na een week is de kans dat iemand nog opneemt klein. */
export const MAX_LEEFTIJD_DAGEN = 7;
export const MAX_PER_AANKOOP = 25;
export const RESERVERING_MINUTEN = 20;

export const LOSSE_LEADS_UITLEG =
  'Deze leads vielen buiten de regio’s van onze klanten en zijn nog nooit aan iemand geleverd. ' +
  'Daarom bieden we ze met korting aan, voor €15 per lead (excl. btw).';

export function isLosseLeadBranche(branch: string | null | undefined): boolean {
  return !!branch && (LOSSE_LEADS_BRANCHES as readonly string[]).includes(branch);
}

export type LosseLeadKandidaat = {
  id: string;
  branch: string | null;
  created_at: string;
  bron?: string | null;
  phone_valid?: boolean | null;
};

export type Bezet = {
  /** Leads met een echte toewijzing (spiegel van het masterportaal telt niet). */
  uitgedeeld: Set<string>;
  /** Leads die in de wachtrij klaarstaan voor een klant. */
  gepland: Set<string>;
  /** Leads die een andere klant nu aan het afrekenen is. */
  gereserveerd: Set<string>;
  /** Leads uit een campagne die (nu) exclusief is voor een andere klant. */
  exclusiefElders: Set<string>;
};

/** Mag deze lead nu als losse lead worden verkocht? */
export function isVerkoopbaar(lead: LosseLeadKandidaat, bezet: Bezet, nu: Date = new Date()): boolean {
  if (!isLosseLeadBranche(lead.branch)) return false;
  if (lead.bron === 'excel_import' || lead.bron === 'demo') return false;
  if (lead.phone_valid === false) return false;
  const t = new Date(lead.created_at).getTime();
  if (Number.isNaN(t) || nu.getTime() - t > MAX_LEEFTIJD_DAGEN * 86_400_000 || t > nu.getTime()) return false;
  return !bezet.uitgedeeld.has(lead.id) && !bezet.gepland.has(lead.id)
    && !bezet.gereserveerd.has(lead.id) && !bezet.exclusiefElders.has(lead.id);
}

/**
 * Formulierantwoorden die de koper vooraf mag zien. Alles wat naar de persoon
 * of het adres wijst blijft weg, net als vrije tekst (daar staat vaak een naam
 * of telefoonnummer in).
 */
/** Interne velden van het systeem, geen formulierantwoord. */
const INTERN = new Set(['max_customer_assignments', 'meta_lead_form_id', 'meta_leadgen_id']);

const PRIVE = /(straat|adres|address|huis|postcode|zip|naam|name|mail|tel|phone|mobiel|opmerk|bericht|toelicht|notitie|comment|vraag|iban|geboorte|leeftijd_exact)/i;

export function zichtbareAntwoorden(customFields: unknown): { label: string; waarde: string }[] {
  if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) return [];
  const uit: { label: string; waarde: string }[] = [];
  for (const [k, v] of Object.entries(customFields as Record<string, unknown>)) {
    if (INTERN.has(k) || PRIVE.test(k)) continue;
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
    const waarde = String(v).trim();
    if (!waarde || waarde.length > 60 || /\d{6,}|@/.test(waarde)) continue;
    const label = k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
    uit.push({ label, waarde });
  }
  return uit.slice(0, 8);
}

/**
 * Wie een losse lead koopt, blijft de enige klant (afspraak 28 okt 2026).
 * Het plafond per lead naar 1: de verdeling, Restleads en de databasetrigger
 * (bewaak_toewijzingsplafond) lezen allemaal dit veld.
 */
export function exclusiefVoorKoper(customFields: unknown): Record<string, unknown> {
  const basis = customFields && typeof customFields === 'object' && !Array.isArray(customFields)
    ? (customFields as Record<string, unknown>) : {};
  return { ...basis, max_customer_assignments: 1 };
}

/** Hele uren sinds binnenkomst, voor "3 uur oud" / "2 dagen oud". */
export function leeftijdTekst(createdAt: string, nu: Date = new Date()): string {
  const uren = Math.max(0, Math.floor((nu.getTime() - new Date(createdAt).getTime()) / 3_600_000));
  if (uren < 1) return 'net binnen';
  if (uren < 24) return `${uren} uur oud`;
  const dagen = Math.floor(uren / 24);
  return dagen === 1 ? '1 dag oud' : `${dagen} dagen oud`;
}

/** Terug te betalen bedrag voor leads die na betaling niet meer vrij waren. */
export function terugbetaling(totaalIncl: number, aantalGekocht: number, aantalNietGeleverd: number): number {
  if (aantalGekocht <= 0 || aantalNietGeleverd <= 0) return 0;
  if (aantalNietGeleverd >= aantalGekocht) return Math.round(totaalIncl * 100) / 100;
  return Math.round((totaalIncl / aantalGekocht) * aantalNietGeleverd * 100) / 100;
}
