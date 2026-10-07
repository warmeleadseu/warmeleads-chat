/**
 * Grenzen die de verdeling bewaakt rond oudere leads en de derde klant.
 *
 * Aanleiding (30 sep 2026): Deal Dynasty startte een batch zonder lookback en
 * kreeg om 20:17 in één klap 43 leads van 1 tot 6 dagen oud, die allemaal al
 * bij twee andere klanten stonden. Drie dingen liepen samen:
 *
 * 1. De lookback van een batch gold alleen bij het aanmaken. De gewone
 *    verdeling keek er niet naar en gaf de batch alsnog leads van vóór zijn
 *    start, tot zeven dagen terug.
 * 2. Een derde klant kon een lead op elke leeftijd krijgen. Een lead die twee
 *    bedrijven al dagen kunnen bellen is voor een derde nauwelijks iets waard.
 * 3. De derde klant hing aan één schakelaar: zakte het gemiddelde onder 2, dan
 *    gingen álle wachtende leads in één ronde de deur uit.
 */

/** Hoe oud een lead maximaal mag zijn om nog een derde klant te krijgen. */
export const DERDE_KLANT_MAX_UREN = 72;

/** Hoeveel leads per verdeelronde maximaal een derde klant krijgen. */
export const DERDE_KLANT_MAX_PER_RONDE = 5;

/**
 * Het vroegste moment waarop een lead binnengekomen mag zijn om naar deze
 * batch te gaan: de start van de batch, min de lookback.
 *
 * Lookback 0 (of niet ingevuld) betekent: alleen leads die binnenkwamen nadat
 * de batch startte. Een geplande start (`starts_at`) gaat voor op het moment
 * van aanmaken.
 */
export function batchVroegsteLead(batch: {
  created_at: string;
  starts_at?: string | null;
  lookback_days?: number | null;
}): Date {
  const start = new Date(batch.starts_at || batch.created_at);
  const dagen = Math.max(0, Number(batch.lookback_days) || 0);
  return new Date(start.getTime() - dagen * 86_400_000);
}

/** Mag deze lead, gezien wanneer hij binnenkwam, naar deze batch? */
export function leadPastInBatchVenster(
  lead: { created_at?: string | null },
  batch: { created_at: string; starts_at?: string | null; lookback_days?: number | null },
): boolean {
  /* Zonder bekende binnenkomst niet blokkeren: dat zou elke lead zonder datum
     uitsluiten, en de oude verdeling deed dat ook niet. */
  if (!lead.created_at) return true;
  const binnen = new Date(lead.created_at);
  if (Number.isNaN(binnen.getTime())) return true;
  return binnen.getTime() >= batchVroegsteLead(batch).getTime();
}

/**
 * Welke leads deze ronde een derde klant mogen krijgen.
 *
 * - alleen leads van hooguit `DERDE_KLANT_MAX_UREN` oud
 * - niet meer dan nodig om het gemiddelde weer op het streefgetal te krijgen
 * - en nooit meer dan `DERDE_KLANT_MAX_PER_RONDE`
 * - de nieuwste eerst
 *
 * Zo komt een derde klant gelijkmatig in plaats van in golven, en altijd op
 * een verse lead.
 */
export function kiesDerdeKlantLeads<T extends { created_at?: string | null }>(
  kandidaten: T[],
  opties: {
    nu?: Date;
    /** Aantal leads met minstens één klant in het venster. */
    leadsMetKlant: number;
    /** Totaal aantal klanten over die leads. */
    klantenTotaal: number;
    streefGemiddelde: number;
  },
): T[] {
  const nu = opties.nu ?? new Date();
  const tekort = Math.ceil(opties.streefGemiddelde * opties.leadsMetKlant - opties.klantenTotaal);
  const ruimte = Math.min(DERDE_KLANT_MAX_PER_RONDE, Math.max(0, tekort));
  if (ruimte === 0) return [];

  const grens = nu.getTime() - DERDE_KLANT_MAX_UREN * 3_600_000;
  const tijd = (l: T) => (l.created_at ? new Date(l.created_at).getTime() : Number.NaN);

  return kandidaten
    .filter(l => {
      const t = tijd(l);
      return Number.isFinite(t) && t >= grens;
    })
    .sort((a, b) => tijd(b) - tijd(a))
    .slice(0, ruimte);
}

/** Minimale tijd tussen twee klanten op dezelfde lead, ook in een inhaalslag. */
export const INHAALSLAG_PAUZE_UREN = 12;

/**
 * Waarom een inhaalslag (backfill) deze lead níet aan deze klant mag geven,
 * of null als het mag.
 *
 * Aanleiding (7 okt 2026): bij Mediabink werd een werkgebied toegevoegd en de
 * inhaalslag gaf in drie minuten 44 leads die al bij andere klanten stonden:
 * 13 binnen twaalf uur na een andere klant (één na twaalf minuten) en 18 als
 * derde klant. De gewone verdeling bewaakt die twee regels; de inhaalslag
 * deed dat niet.
 *
 * - `pauze`: een andere klant kreeg de lead minder dan 12 uur geleden.
 * - `derde_klant`: de lead staat al bij twee andere klanten. Een derde klant
 *   loopt alleen via de gewone verdeelronde, gedoseerd en op verse leads.
 */
export function inhaalslagWeigering(
  bestaande: { customer_id: string | null; assigned_at: string | null }[],
  klantId: string,
  nu: Date = new Date(),
): 'pauze' | 'derde_klant' | null {
  const anderen = bestaande.filter(a => a.customer_id && a.customer_id !== klantId);
  const pauzeGrens = nu.getTime() - INHAALSLAG_PAUZE_UREN * 3_600_000;
  for (const a of anderen) {
    const t = a.assigned_at ? new Date(a.assigned_at).getTime() : NaN;
    /* Zonder geldige datum voorzichtig: als recent behandelen. */
    if (Number.isNaN(t) || t > pauzeGrens) return 'pauze';
  }
  const dertigDagen = nu.getTime() - 30 * 86_400_000;
  const klanten = new Set(
    anderen
      .filter(a => !a.assigned_at || new Date(a.assigned_at).getTime() >= dertigDagen)
      .map(a => a.customer_id as string),
  );
  return klanten.size >= 2 ? 'derde_klant' : null;
}
