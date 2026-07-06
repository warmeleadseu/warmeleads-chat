/**
 * Één bron van waarheid voor de content en tarieven van de branche-landingspagina's
 * (`/leads-<branch>`) én de lokale landingspagina's (`/leads/<branch>/<location>`).
 *
 * Zo staan leadprijzen niet langer los hardcoded in elke pagina, en tonen de
 * lokale pagina's dezelfde, consistente informatie als de hoofdbranchepagina.
 */
export interface BranchLeadContent {
  /** Branche-slug zoals in de URL (`thuisbatterijen`, `zonnepanelen`, ...). */
  slug: string;
  /** Korte branchenaam, bv. "Thuisbatterij". */
  branchName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  /** Zichtbare prijs (range) voor exclusieve leads. */
  exclusivePrice: string;
  /** Zichtbare prijs voor de volume/gedeelde deal. */
  sharedPrice: string;
  /** Laagste exclusieve prijs als getal (voor structured data). */
  exclusivePriceFrom: number;
  /** Gedeelde prijs als getal (voor structured data). */
  sharedPriceValue: number;
}

export const BRANCH_LEAD_CONTENT: Record<string, BranchLeadContent> = {
  thuisbatterijen: {
    slug: 'thuisbatterijen',
    branchName: 'Thuisbatterij',
    heroTitle: 'Thuisbatterij Leads',
    heroSubtitle: 'Nederlandse prospects die energie-onafhankelijkheid zoeken',
    heroDescription:
      'Verse leads uit onze campagnes voor thuisbatterij installateurs. Echte geïnteresseerde huiseigenaren met zonnepanelen die hun energieopslag willen uitbreiden.',
    exclusivePrice: '€37,50 - €42,50',
    sharedPrice: '€12,50',
    exclusivePriceFrom: 37.5,
    sharedPriceValue: 12.5,
  },
  zonnepanelen: {
    slug: 'zonnepanelen',
    branchName: 'Zonnepanelen',
    heroTitle: 'Zonnepanelen Leads',
    heroSubtitle: 'Nederlandse prospects die solar energie willen',
    heroDescription:
      'Verse leads uit onze campagnes voor solar installateurs. Echte geïnteresseerde huiseigenaren die actief zoeken naar zonnepaneel installatie en duurzame energie oplossingen.',
    exclusivePrice: '€40,00 - €42,50',
    sharedPrice: '€12,50',
    exclusivePriceFrom: 40,
    sharedPriceValue: 12.5,
  },
  warmtepompen: {
    slug: 'warmtepompen',
    branchName: 'Warmtepomp',
    heroTitle: 'Warmtepomp Leads',
    heroSubtitle: 'Nederlandse prospects die duurzaam willen verwarmen',
    heroDescription:
      'Verse leads uit onze campagnes voor warmtepomp installateurs. Echte geïnteresseerde huiseigenaren die zoeken naar energie-efficiënte verwarmingsoplossingen.',
    exclusivePrice: '€40,00 - €45,00',
    sharedPrice: '€12,50',
    exclusivePriceFrom: 40,
    sharedPriceValue: 12.5,
  },
  airco: {
    slug: 'airco',
    branchName: 'Airco',
    heroTitle: 'Airco Leads',
    heroSubtitle: 'Nederlandse prospects die op zoek zijn naar airconditioning',
    heroDescription:
      'Verse leads uit onze campagnes voor airco installateurs. Echte geïnteresseerde huiseigenaren en bedrijven die actief zoeken naar airconditioning en klimaatbeheersing.',
    exclusivePrice: '€30,00 - €37,50',
    sharedPrice: '€10,00',
    exclusivePriceFrom: 30,
    sharedPriceValue: 10,
  },
  'financial-lease': {
    slug: 'financial-lease',
    branchName: 'Financial Lease',
    heroTitle: 'Financial Lease Leads',
    heroSubtitle: 'Nederlandse zakelijke prospects voor lease',
    heroDescription:
      'Verse leads uit onze campagnes voor financial lease aanbieders. Echte zakelijke geïnteresseerden die actief zoeken naar lease mogelijkheden voor bedrijfsmiddelen.',
    exclusivePrice: '€35,00 - €40,00',
    sharedPrice: '€12,50',
    exclusivePriceFrom: 35,
    sharedPriceValue: 12.5,
  },
};

export function getBranchLeadContent(slug: string): BranchLeadContent | undefined {
  return BRANCH_LEAD_CONTENT[slug];
}
