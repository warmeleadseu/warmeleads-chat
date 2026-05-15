/**
 * Zet ruwe KVK-API HTTP-antwoorden om naar korte, leesbare foutteksten voor de UI.
 * (De API stuurt vaak JSON met `fout[].code` / `fout[].omschrijving`.)
 */
export function humanizeKvkError(status: number, responseBody: string): string {
  const raw = responseBody.trim();

  if (raw) {
    try {
      const j = JSON.parse(raw) as { fout?: Array<{ code?: string; omschrijving?: string }> };
      const first = j.fout?.[0];
      if (first?.omschrijving) {
        if (first.code === 'IPD5200' || /geen gegevens gevonden/i.test(first.omschrijving)) {
          return 'Geen bedrijven gevonden bij de KVK met deze zoekterm. Controleer de spelling, probeer een vollediger bedrijfsnaam of zoek op het 8-cijferige KVK-nummer.';
        }
        return first.omschrijving;
      }
    } catch {
      /* geen JSON */
    }
  }

  if (status === 404) {
    return 'Geen gegevens gevonden bij de KVK. Controleer de zoekterm of het KVK-nummer.';
  }
  if (status === 401 || status === 403) {
    return 'KVK-koppeling is niet beschikbaar (autorisatie). Neem contact op met beheer.';
  }
  if (status === 429) {
    return 'De KVK-dienst limiteert het aantal zoekopdrachten. Probeer het over een minuut opnieuw.';
  }
  if (status >= 500) {
    return 'De KVK-dienst heeft tijdelijk een storing. Probeer het later opnieuw.';
  }

  return 'De KVK-dienst kon je verzoek niet verwerken. Probeer het later opnieuw of vul de gegevens handmatig in.';
}
