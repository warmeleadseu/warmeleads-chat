/**
 * Direct leveren: een klant (of één batch) krijgt een passende lead bij
 * binnenkomst altijd als eerste, binnen een minuut.
 *
 * Aanleiding (oktober 2026): een lead gaat bij binnenkomst naar één klant,
 * de winnaar van de gewone verdeling; andere klanten krijgen hem pas na 12
 * uur. Om te testen of snelle levering samen met de WhatsApp-opvolging van
 * Snelraak betere resultaten geeft, kan een klant zo vooraan worden gezet.
 *
 * Alleen de volgorde verandert. Alle andere regels (12 uur tussen klanten,
 * maximaal 3 klanten, dag- en weekmaximum, gebied, filters, uitsluitingen)
 * blijven gelden: past een lead niet bij de direct-klant, dan wint gewoon
 * de volgende kandidaat.
 */

/** Stand op een batch: aan = altijd direct, uit = nooit direct, null = volgt de klantkaart. */
export type DirectStand = 'aan' | 'uit' | null;

export function effectiefDirect(batchStand: DirectStand | string | undefined, klantDirect: boolean | null | undefined): boolean {
  if (batchStand === 'aan') return true;
  if (batchStand === 'uit') return false;
  return klantDirect === true;
}

/** Waar de effectieve stand vandaan komt, voor de schermen. */
export function directHerkomst(
  batchStand: DirectStand | string | undefined,
  klantDirect: boolean | null | undefined,
): { direct: boolean; label: string } {
  if (batchStand === 'aan') return { direct: true, label: 'Direct (batch)' };
  if (batchStand === 'uit') return { direct: false, label: klantDirect ? 'Niet direct (batch wijkt af)' : 'Niet direct (batch)' };
  return klantDirect ? { direct: true, label: 'Direct (klantkaart)' } : { direct: false, label: 'Normaal' };
}

/**
 * Leest de stand uit invoer van het beheer. Geeft undefined bij ongeldige
 * invoer, zodat de API kan weigeren in plaats van te gokken.
 */
export function leesDirectStand(invoer: unknown): DirectStand | undefined {
  if (invoer === null || invoer === '' || invoer === 'volgt' || invoer === 'klant') return null;
  if (invoer === 'aan' || invoer === 'uit') return invoer;
  return undefined;
}

/** Wat de verdeling per kandidaat-batch weet om te kiezen. */
export type Kandidaat = {
  customer_id: string;
  direct: boolean;
  distribution_priority: boolean;
  min_radius: number;
  recent_24h: number;
  distance_km: number;
};

/**
 * Volgorde van kandidaten bij binnenkomst: eerst een expliciet gekozen klant
 * (preferCustomerId), dan direct, dan voorrang, dan de gewone verdeling
 * (kleinste gebied, eerlijk verdelen over 24 uur, kortste afstand).
 * Zonder direct-kandidaten is dit exact de volgorde van voorheen.
 */
export function vergelijkKandidaten(a: Kandidaat, b: Kandidaat, prefer?: string | null): number {
  if (prefer) {
    const aPref = a.customer_id === prefer;
    const bPref = b.customer_id === prefer;
    if (aPref !== bPref) return aPref ? -1 : 1;
  }
  if (a.direct !== b.direct) return a.direct ? -1 : 1;
  if (a.distribution_priority !== b.distribution_priority) return a.distribution_priority ? -1 : 1;
  if (a.min_radius !== b.min_radius) return a.min_radius - b.min_radius;
  if (a.recent_24h !== b.recent_24h) return a.recent_24h - b.recent_24h;
  return a.distance_km - b.distance_km;
}
