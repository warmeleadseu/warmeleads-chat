/**
 * Zoeken in de koppelingenlijst op de Koppelingen-pagina.
 *
 * De pagina toont 27 koppelingen als kaartjes in drie kolommen, verdeeld over
 * 25 branches. Dat is negen rijen scrollen om er één te vinden. Alles staat al
 * in het geheugen, dus filteren gebeurt in de browser: geen extra verzoek en
 * resultaat terwijl je typt.
 */

export type ZoekbareKoppeling = {
  label: string;
  branch: string;
  customers?: { name: string } | null;
};

/** Branche-slug naar weergavenaam, zodat "Thuisbatterij Partners" ook vindbaar is. */
export type BrancheNamen = Record<string, string>;

/**
 * Filtert koppelingen op een zoekterm.
 *
 * Doorzoekt naam, branche-slug, weergavenaam van de branche en de klantnaam.
 * Hoofdletterongevoelig. Bij meerdere woorden moet elk woord ergens voorkomen,
 * zodat "partners airco" ook "Airco Partners" vindt.
 *
 * Een lege of enkel uit spaties bestaande zoekterm geeft de volledige lijst terug.
 */
export function filterKoppelingen<T extends ZoekbareKoppeling>(
  koppelingen: T[],
  brancheNamen: BrancheNamen,
  zoekterm: string,
): T[] {
  const termen = zoekterm.toLowerCase().split(/\s+/).filter(Boolean);
  if (termen.length === 0) return koppelingen;

  return koppelingen.filter((k) => {
    const hooiberg = [
      k.label,
      k.branch,
      brancheNamen[k.branch] ?? '',
      k.customers?.name ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return termen.every((t) => hooiberg.includes(t));
  });
}
