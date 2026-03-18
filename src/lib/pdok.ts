const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';

interface PDOKResult {
  plaatsnaam: string;
  provincie: string;
}

function isValidPlace(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.trim();
  if (v.length < 2) return false;
  if (/^[-–—.…\/\\]+$/.test(v)) return false;
  if (v.includes('@')) return false;
  if (/^\+?\d[\d\s\-().]{6,}$/.test(v)) return false;
  if (/^\d+$/.test(v)) return false;
  const low = v.toLowerCase();
  if (['n/a', 'nvt', 'n.v.t.', 'onbekend', 'unknown', 'geen', 'x', 'xx', 'xxx', 'test', '?', '??', 'null', 'undefined', 'none'].includes(low)) return false;
  return true;
}

/**
 * Resolve a Dutch address (plaatsnaam + provincie) from postcode + huisnummer
 * using the free PDOK Locatieserver (Kadaster / BAG).
 * Returns null if the address cannot be resolved.
 */
function extractPostcode(raw: string): string | null {
  const stripped = raw.replace(/\s+/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(stripped)) return stripped;
  const match = stripped.match(/(\d{4}[A-Z]{2})/);
  if (match) return match[1];
  const digitsOnly = raw.replace(/\s+/g, '').match(/^(\d{4})[^A-Za-z0-9]?([A-Za-z]{2})/);
  if (digitsOnly) return (digitsOnly[1] + digitsOnly[2]).toUpperCase();
  return null;
}

function extractHuisnummer(raw: string): string {
  const match = raw.trim().match(/^(\d+)/);
  return match ? match[1] : raw.trim();
}

export async function resolveAddress(
  postcode: string,
  huisnummer: string
): Promise<PDOKResult | null> {
  if (!postcode || !huisnummer) return null;

  const clean = extractPostcode(postcode);
  if (!clean) return null;

  const hnr = extractHuisnummer(huisnummer);
  if (!hnr) return null;

  try {
    const q = encodeURIComponent(`${clean} ${hnr}`);
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
  const needsPlace = !isValidPlace(lead.plaatsnaam);
  const needsProv = !isValidPlace(lead.provincie);
  if ((!needsPlace && !needsProv) || !lead.postcode || !lead.huisnummer) {
    return lead;
  }

  const result = await resolveAddress(lead.postcode, lead.huisnummer);
  if (!result) return lead;

  return {
    ...lead,
    plaatsnaam: needsPlace && result.plaatsnaam ? result.plaatsnaam : lead.plaatsnaam,
    provincie: needsProv && result.provincie ? result.provincie : lead.provincie,
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
