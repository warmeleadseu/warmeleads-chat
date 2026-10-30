/**
 * Live-dashboard als slideshow (30 okt 2026): de regels, puur en te testen.
 *
 * Eén onderwerp tegelijk op het volle scherm, in een vaste volgorde. Een
 * slide zonder inhoud wordt overgeslagen; actieve batches worden over
 * pagina's verdeeld in plaats van een lijst die scrolt.
 */

export type SlideId = 'vandaag' | 'batches' | 'geld' | 'team' | 'actie';

export const SLIDE_TITELS: Record<SlideId, string> = {
  vandaag: 'Vandaag',
  batches: 'Actieve batches',
  geld: 'Geld',
  team: 'Team',
  actie: 'Actie',
};

const VOLGORDE: SlideId[] = ['vandaag', 'batches', 'geld', 'team', 'actie'];

export const BATCHES_PER_PAGINA = 8;
export const STANDAARD_DUUR_SEC = 15;
/** Een batchpagina staat iets korter: het is één onderwerp over meer schermen. */
const BATCH_PAGINA_FACTOR = 0.8;
const MIN_DUUR_SEC = 5;
const MAX_DUUR_SEC = 120;

export interface Slide {
  /** Uniek per scherm, bijvoorbeeld "batches-2". */
  key: string;
  id: SlideId;
  titel: string;
  /** 1-gebaseerd; alleen bij meer dan één pagina relevant. */
  pagina: number;
  paginas: number;
  duurMs: number;
}

export interface SlideInhoud {
  batches: number;
  heeftGeld: boolean;
  heeftTeam: boolean;
  /** Een lopende actie (zoals de najaarsactie); optioneel zodat oude aanroepen blijven werken. */
  heeftActie?: boolean;
}

export function bouwSlides(inhoud: SlideInhoud, opties: { duurSec?: number; vast?: SlideId | null } = {}): Slide[] {
  const duurMs = (opties.duurSec ?? STANDAARD_DUUR_SEC) * 1000;
  const slides: Slide[] = [];
  for (const id of VOLGORDE) {
    if (id === 'batches') {
      const paginas = Math.ceil(Math.max(0, inhoud.batches) / BATCHES_PER_PAGINA);
      for (let p = 1; p <= paginas; p++) {
        slides.push({
          key: `batches-${p}`, id, titel: SLIDE_TITELS[id], pagina: p, paginas,
          duurMs: paginas > 1 ? Math.round(duurMs * BATCH_PAGINA_FACTOR) : duurMs,
        });
      }
      continue;
    }
    if (id === 'geld' && !inhoud.heeftGeld) continue;
    if (id === 'team' && !inhoud.heeftTeam) continue;
    if (id === 'actie' && !inhoud.heeftActie) continue;
    slides.push({ key: id, id, titel: SLIDE_TITELS[id], pagina: 1, paginas: 1, duurMs });
  }
  if (opties.vast) {
    const vast = slides.filter(s => s.id === opties.vast);
    if (vast.length > 0) return vast;
  }
  return slides;
}

/** `?slide=batches` zet het scherm vast op één onderwerp; onbekend = geen. */
export function leesVasteSlide(waarde: string | null | undefined): SlideId | null {
  const s = (waarde ?? '').trim().toLowerCase();
  return (VOLGORDE as string[]).includes(s) ? (s as SlideId) : null;
}

/** `?duur=20` in seconden, begrensd tussen 5 en 120; ongeldig = standaard. */
export function leesDuur(waarde: string | null | undefined): number {
  const n = Number((waarde ?? '').trim());
  if (!waarde || !Number.isFinite(n) || n <= 0) return STANDAARD_DUUR_SEC;
  return Math.min(MAX_DUUR_SEC, Math.max(MIN_DUUR_SEC, Math.round(n)));
}

/**
 * Welke slide staat er na verversen van de data? Dezelfde als hij nog
 * bestaat; anders de laatste pagina van hetzelfde onderwerp (er vielen
 * batches weg), anders het volgende onderwerp, anders de eerste.
 */
export function huidigeIndex(slides: Slide[], key: string | null): number {
  if (slides.length === 0 || !key) return 0;
  const exact = slides.findIndex(s => s.key === key);
  if (exact >= 0) return exact;
  const id = key.split('-')[0] as SlideId;
  const zelfde = slides.map((s, i) => (s.id === id ? i : -1)).filter(i => i >= 0);
  if (zelfde.length > 0) return zelfde[zelfde.length - 1];
  const rang = VOLGORDE.indexOf(id);
  const volgende = slides.findIndex(s => VOLGORDE.indexOf(s.id) > rang);
  return volgende >= 0 ? volgende : 0;
}

export function stapIndex(index: number, aantal: number, stap: 1 | -1): number {
  if (aantal <= 0) return 0;
  return (((index + stap) % aantal) + aantal) % aantal;
}

/** De onderwerpen voor de voortgangsbalk onderaan, met hun eerste slide. */
export function onderwerpen(slides: Slide[]): { id: SlideId; titel: string; eersteIndex: number; paginas: number }[] {
  const uit: { id: SlideId; titel: string; eersteIndex: number; paginas: number }[] = [];
  slides.forEach((s, i) => {
    if (!uit.some(o => o.id === s.id)) uit.push({ id: s.id, titel: s.titel, eersteIndex: i, paginas: s.paginas });
  });
  return uit;
}

export function paginaVan<T>(items: T[], pagina: number, perPagina = BATCHES_PER_PAGINA): T[] {
  const start = (Math.max(1, pagina) - 1) * perPagina;
  return items.slice(start, start + perPagina);
}
