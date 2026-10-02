/**
 * Geheimen uit tekst halen voordat die wordt opgeslagen, getoond of gelogd.
 *
 * Een partner-URL is zelf het geheim: wie hem kent, kan namens onze klant leads
 * in het systeem van de partner zetten. Hij mag dus nergens in een foutmelding,
 * het synclog of een consolelog belanden, ook niet als een netwerkfout de URL
 * in zijn melding opneemt.
 */
export function verbergGeheim(tekst: string | null | undefined, token?: string | null): string {
  let uit = String(tekst ?? '');
  if (token) uit = uit.split(token).join('••••');
  /* Ook zonder bekend token: alles na een ingest-pad is geheim. */
  uit = uit.replace(/(\/ingest\/)[^\s"'<>?#]+/gi, '$1••••');
  return uit;
}

/** Kort en veilig stukje antwoordtekst voor in een foutmelding. */
export function kortAntwoord(body: string, token?: string | null, max = 200): string {
  const schoon = verbergGeheim(body, token).replace(/\s+/g, ' ').trim();
  return schoon.length > max ? `${schoon.slice(0, max)}…` : schoon;
}
