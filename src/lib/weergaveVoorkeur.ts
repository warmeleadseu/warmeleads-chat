/**
 * Onthouden welke weergave iemand kiest op een overzichtspagina.
 *
 * De blokken op Branches en Koppelingen stonden altijd in een raster van twee
 * of drie kolommen. Omdat die kaarten sterk wisselende hoogtes hebben (de ene
 * branche heeft vijf staffels en zes velden, de andere één en één) werden de
 * rijen rafelig en las het rommelig. Batches had dat probleem niet, want die
 * toont op desktop een tabel.
 *
 * Hier staat alleen het onthouden van de keuze. Losgetrokken van React zodat
 * het te testen is zonder browser.
 */

export const WEERGAVEN = ['tabel', 'kaarten', 'compact'] as const;
export type Weergave = (typeof WEERGAVEN)[number];

export const WEERGAVE_LABELS: Record<Weergave, string> = {
  tabel: 'Tabel',
  kaarten: 'Kaarten',
  compact: 'Compact',
};

export function isWeergave(waarde: unknown): waarde is Weergave {
  return typeof waarde === 'string' && (WEERGAVEN as readonly string[]).includes(waarde);
}

export function opslagSleutel(pagina: string): string {
  return `wl-weergave-${pagina}`;
}

/**
 * Leest de opgeslagen keuze.
 *
 * Alles wat fout kan gaan levert de standaard op: geen browser (server-render),
 * opslag geblokkeerd (privémodus), of een waarde die niet meer bestaat omdat we
 * ooit een weergave hebben hernoemd.
 */
export function leesVoorkeur(pagina: string, standaard: Weergave = 'tabel'): Weergave {
  if (typeof window === 'undefined') return standaard;
  try {
    const opgeslagen = window.localStorage.getItem(opslagSleutel(pagina));
    return isWeergave(opgeslagen) ? opgeslagen : standaard;
  } catch {
    return standaard;
  }
}

export function bewaarVoorkeur(pagina: string, weergave: Weergave): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(opslagSleutel(pagina), weergave);
  } catch {
    /* Opslag geweigerd. De keuze geldt dan alleen voor deze sessie, wat beter
       is dan de pagina laten klappen. */
  }
}
