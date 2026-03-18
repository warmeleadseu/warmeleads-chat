const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';

interface PDOKResult {
  plaatsnaam: string;
  provincie: string;
}

/**
 * Resolve a Dutch address (plaatsnaam + provincie) from postcode + huisnummer
 * using the free PDOK Locatieserver (Kadaster / BAG).
 * Returns null if the address cannot be resolved.
 */
export async function resolveAddress(
  postcode: string,
  huisnummer: string
): Promise<PDOKResult | null> {
  if (!postcode || !huisnummer) return null;

  const clean = postcode.replace(/\s+/g, '').toUpperCase();
  if (!/^\d{4}[A-Z]{2}$/.test(clean)) return null;

  try {
    const q = encodeURIComponent(`${clean} ${huisnummer}`);
    const res = await fetch(
      `${PDOK_URL}?q=${q}&fq=type:adres&rows=1&fl=woonplaatsnaam,provincienaam`,
      { signal: AbortSignal.timeout(4000) }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (!doc) return null;

    return {
      plaatsnaam: doc.woonplaatsnaam || '',
      provincie: doc.provincienaam || '',
    };
  } catch {
    return null;
  }
}

/**
 * Enrich a lead object with plaatsnaam and provincie if they are missing
 * but postcode + huisnummer are available.
 */
export async function enrichLeadAddress<
  T extends { postcode?: string; huisnummer?: string; plaatsnaam?: string; provincie?: string }
>(lead: T): Promise<T> {
  if ((lead.plaatsnaam && lead.provincie) || !lead.postcode || !lead.huisnummer) {
    return lead;
  }

  const result = await resolveAddress(lead.postcode, lead.huisnummer);
  if (!result) return lead;

  return {
    ...lead,
    plaatsnaam: lead.plaatsnaam || result.plaatsnaam,
    provincie: lead.provincie || result.provincie,
  };
}

/**
 * Enrich an array of leads in parallel (max 10 concurrent).
 */
export async function enrichLeadsAddress<
  T extends { postcode?: string; huisnummer?: string; plaatsnaam?: string; provincie?: string }
>(leads: T[]): Promise<T[]> {
  const CONCURRENCY = 10;
  const results: T[] = [...leads];

  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const enriched = await Promise.all(batch.map(l => enrichLeadAddress(l)));
    enriched.forEach((l, idx) => { results[i + idx] = l; });
  }

  return results;
}
