/**
 * Losse leads in het portaal: welke leads te koop zijn, wat de klant ervan
 * ziet en wat ze kosten. Puur, zodat het te testen is en ook in het portaal
 * bruikbaar.
 *
 * Afspraak (27 okt 2026): leads die buiten de regio's van alle klanten vielen
 * en nog nooit zijn uitgedeeld, mag iedere klant met een account kopen voor
 * EUR 15 per stuk, alleen in deze vijf branches. Op 27 okt waren dat er in
 * twee weken ruim vijftig zonder enige klant.
 *
 * Afspraak (6 nov 2026): de prijs hangt af van de leeftijd van de lead, in
 * staffels (PRIJSSTAFFELS), en leads blijven tot 10 dagen te koop. Het portaal
 * toont de prijs per lead, maar niet wanneer die zakt: een klant moet niet
 * gaan wachten op een lagere prijs.
 */

export const LOSSE_LEADS_BRANCHES = ['thuisbatterij', 'warmtepomp', 'zonnepanelen', 'airco', 'financial_lease'] as const;
/**
 * Prijs per lead (excl. btw) naar leeftijd in hele dagen, zoals het portaal
 * hem toont ("3 dagen oud"): t/m 3 dagen 15 euro, t/m 5 dagen 12,50, t/m 7
 * dagen 10 en t/m 10 dagen 7,50.
 */
export const PRIJSSTAFFELS: readonly { totEnMetDagen: number; prijs: number }[] = [
  { totEnMetDagen: 3, prijs: 15 },
  { totEnMetDagen: 5, prijs: 12.5 },
  { totEnMetDagen: 7, prijs: 10 },
  { totEnMetDagen: 10, prijs: 7.5 },
];
/** Daarna is de kans dat iemand nog opneemt te klein. */
export const MAX_LEEFTIJD_DAGEN = PRIJSSTAFFELS[PRIJSSTAFFELS.length - 1].totEnMetDagen;
export const HOOGSTE_PRIJS = PRIJSSTAFFELS[0].prijs;
export const LAAGSTE_PRIJS = PRIJSSTAFFELS[PRIJSSTAFFELS.length - 1].prijs;
export const MAX_PER_AANKOOP = 25;
export const RESERVERING_MINUTEN = 20;

export const LOSSE_LEADS_UITLEG =
  'Deze leads vielen buiten de regio’s van onze klanten en zijn nog nooit aan iemand geleverd. ' +
  'Daarom bieden we ze met korting aan, voor €7,50 tot €15 per lead (excl. btw).';

/** Hele dagen sinds binnenkomst (0 = minder dan 24 uur). */
export function leeftijdInDagen(createdAt: string, nu: Date = new Date()): number {
  return Math.floor((nu.getTime() - new Date(createdAt).getTime()) / 86_400_000);
}

/** Prijs excl. btw van een lead op dit moment; null als hij te oud (of nog niet binnen) is. */
export function prijsVoorLeeftijd(createdAt: string, nu: Date = new Date()): number | null {
  const dagen = leeftijdInDagen(createdAt, nu);
  if (Number.isNaN(dagen) || dagen < 0) return null;
  return PRIJSSTAFFELS.find(s => dagen <= s.totEnMetDagen)?.prijs ?? null;
}

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
  if (new Date(lead.created_at).getTime() > nu.getTime() || prijsVoorLeeftijd(lead.created_at, nu) === null) return false;
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

const centen = (n: number) => Math.round(n * 100) / 100;

/**
 * De prijs per lead van een aankoop, zoals die gold bij het afrekenen
 * (aankoop.created_at). Klopt de som niet met het betaalde bedrag (een
 * aankoop van vóór de staffels, of een lead die niet meer bestaat), dan krijgt
 * elke lead de gemiddelde prijs uit de aankoop.
 */
export function prijzenVanAankoop(
  aankoop: { lead_ids: string[]; created_at: string; totaal_excl: number; prijs_per_lead: number },
  binnen: Map<string, string>,
): Map<string, number> {
  const uit = new Map<string, number>();
  const moment = new Date(aankoop.created_at);
  for (const id of aankoop.lead_ids) {
    const createdAt = binnen.get(id);
    const p = createdAt ? prijsVoorLeeftijd(createdAt, moment) : null;
    if (p === null) break;
    uit.set(id, p);
  }
  const som = [...uit.values()].reduce((a, b) => a + b, 0);
  if (uit.size === aankoop.lead_ids.length && Math.abs(som - aankoop.totaal_excl) < 0.005) return uit;
  return new Map(aankoop.lead_ids.map(id => [id, aankoop.prijs_per_lead]));
}

/** Factuurregels: aantal leads per prijs, duurste eerst. */
export function regelsPerPrijs(prijzen: number[]): { aantal: number; prijs_per_lead: number }[] {
  const m = new Map<number, number>();
  for (const p of prijzen) m.set(p, (m.get(p) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([prijs_per_lead, aantal]) => ({ aantal, prijs_per_lead }));
}

export function somPrijzen(prijzen: number[]): number {
  return centen(prijzen.reduce((a, b) => a + b, 0));
}

/**
 * Terug te betalen bedrag (incl. btw) voor leads die na betaling niet meer
 * vrij waren: naar rato van hun prijs excl. btw.
 */
export function terugbetaling(totaalIncl: number, totaalExcl: number, exclNietGeleverd: number): number {
  if (totaalExcl <= 0 || exclNietGeleverd <= 0) return 0;
  if (exclNietGeleverd >= totaalExcl - 0.005) return centen(totaalIncl);
  /* Halve centen naar boven, ook als de deling net onder x,xx5 uitkomt. */
  return Math.round((totaalIncl * exclNietGeleverd * 100) / totaalExcl + 1e-6) / 100;
}
