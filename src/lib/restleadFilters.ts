import { leadValtBinnenProvincieSelectie, type ProvincieMargeContext } from './provincieMarge';

/**
 * De meerkeuzefilters van de Restleads-pagina, met tellingen per optie.
 *
 * De rest van de filters (zoeken, datum, telefoon, bulkstatus, plaats, straal,
 * postcode) gaat via `applyLeadFilters`, dezelfde functie als het Leads CRM.
 * Deze filters draaien in geheugen, omdat de telling per optie moet laten zien
 * wat je krijgt als je hem aanvinkt: over alle andere filters heen, maar zonder
 * die van de eigen groep. Anders staat bij elke niet-gekozen branche een nul.
 */

export interface RestleadFilterItem {
  branch: string;
  provincie: string | null;
  bron: string | null;
  meta_campaign_id: string | null;
  lat: number | null;
  lng: number | null;
  land?: string | null;
  postcode?: string | null;
  /** Klanten die de lead al hebben. */
  klanten: string[];
  /** Klanten die de lead nu nog kunnen krijgen. */
  kandidaten: string[];
}

export interface RestleadFilterKeuze {
  branches: string[];
  provincies: string[];
  /** Marge rond de gekozen provincies; null = alleen binnen de provincie. */
  marge: ProvincieMargeContext | null;
  bronnen: string[];
  campagnes: string[];
  uitgedeeldAan: string[];
  kanNaar: string[];
}

interface Dimensie {
  sleutel: string;
  actief: boolean;
  waarden: (i: RestleadFilterItem) => string[];
  past: (i: RestleadFilterItem) => boolean;
}

function dimensies(k: RestleadFilterKeuze): Dimensie[] {
  const een = (v: string | null | undefined) => (v ? [v] : []);
  return [
    {
      sleutel: 'branch',
      actief: k.branches.length > 0,
      waarden: i => een(i.branch),
      past: i => k.branches.includes(i.branch),
    },
    {
      sleutel: 'province',
      actief: k.provincies.length > 0,
      waarden: i => een(i.provincie),
      past: i => k.marge
        ? leadValtBinnenProvincieSelectie(i, k.marge.provincies, k.marge.sleutels, k.marge.margeKm)
        : !!i.provincie && k.provincies.includes(i.provincie),
    },
    {
      sleutel: 'source',
      actief: k.bronnen.length > 0,
      waarden: i => een(i.bron),
      past: i => !!i.bron && k.bronnen.includes(i.bron),
    },
    {
      sleutel: 'meta_campaign_id',
      actief: k.campagnes.length > 0,
      waarden: i => een(i.meta_campaign_id),
      past: i => !!i.meta_campaign_id && k.campagnes.includes(i.meta_campaign_id),
    },
    {
      sleutel: 'customer_id',
      actief: k.uitgedeeldAan.length > 0,
      waarden: i => i.klanten,
      past: i => i.klanten.some(c => k.uitgedeeldAan.includes(c)),
    },
    {
      sleutel: 'kan_naar',
      actief: k.kanNaar.length > 0,
      waarden: i => i.kandidaten,
      past: i => i.kandidaten.some(c => k.kanNaar.includes(c)),
    },
  ];
}

export function filterEnTel<T>(
  items: T[],
  lees: (t: T) => RestleadFilterItem,
  keuze: RestleadFilterKeuze,
): { over: T[]; facetten: Record<string, Record<string, number>> } {
  const dims = dimensies(keuze);
  const facetten: Record<string, Record<string, number>> = {};
  for (const d of dims) facetten[d.sleutel] = {};

  const over: T[] = [];
  for (const t of items) {
    const item = lees(t);
    const faalt = dims.filter(d => d.actief && !d.past(item));

    if (faalt.length === 0) over.push(t);

    /* Tellen voor een groep mag als alle ándere groepen passen. */
    for (const d of dims) {
      if (faalt.length > 1 || (faalt.length === 1 && faalt[0] !== d)) continue;
      const telling = facetten[d.sleutel];
      for (const w of new Set(d.waarden(item))) telling[w] = (telling[w] ?? 0) + 1;
    }
  }

  return { over, facetten };
}
