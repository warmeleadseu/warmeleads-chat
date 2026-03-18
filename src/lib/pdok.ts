const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';

interface PDOKResult {
  plaatsnaam: string;
  provincie: string;
  lat?: number;
  lng?: number;
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

function parseWKTPoint(wkt: string): { lat: number; lng: number } | null {
  const m = wkt.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
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
      `${PDOK_URL}?q=${q}&fq=type:adres&rows=1&fl=woonplaatsnaam,provincienaam,centroide_ll`,
      { signal: AbortSignal.timeout(4000) }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (!doc) return null;

    const coords = doc.centroide_ll ? parseWKTPoint(doc.centroide_ll) : null;

    return {
      plaatsnaam: doc.woonplaatsnaam || '',
      provincie: doc.provincienaam || '',
      lat: coords?.lat,
      lng: coords?.lng,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve coordinates for a city name (for customer target setup).
 */
export async function resolveCity(
  plaatsnaam: string
): Promise<{ lat: number; lng: number; naam: string } | null> {
  if (!plaatsnaam || plaatsnaam.trim().length < 2) return null;

  try {
    const q = encodeURIComponent(plaatsnaam.trim());
    const res = await fetch(
      `${PDOK_URL}?q=${q}&fq=type:woonplaats&rows=1&fl=woonplaatsnaam,centroide_ll`,
      { signal: AbortSignal.timeout(4000) }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (!doc?.centroide_ll) return null;

    const coords = parseWKTPoint(doc.centroide_ll);
    if (!coords) return null;

    return { lat: coords.lat, lng: coords.lng, naam: doc.woonplaatsnaam || plaatsnaam };
  } catch {
    return null;
  }
}

export async function enrichLeadAddress<
  T extends { postcode?: string; huisnummer?: string; plaatsnaam?: string; provincie?: string; lat?: number; lng?: number }
>(lead: T): Promise<T> {
  const needsPlace = !isValidPlace(lead.plaatsnaam);
  const needsProv = !isValidPlace(lead.provincie);
  const needsCoords = !lead.lat || !lead.lng;
  if ((!needsPlace && !needsProv && !needsCoords) || !lead.postcode || !lead.huisnummer) {
    return lead;
  }

  const result = await resolveAddress(lead.postcode, lead.huisnummer);
  if (!result) return lead;

  return {
    ...lead,
    plaatsnaam: needsPlace && result.plaatsnaam ? result.plaatsnaam : lead.plaatsnaam,
    provincie: needsProv && result.provincie ? result.provincie : lead.provincie,
    lat: needsCoords && result.lat ? result.lat : lead.lat,
    lng: needsCoords && result.lng ? result.lng : lead.lng,
  };
}

export async function enrichLeadsAddress<
  T extends { postcode?: string; huisnummer?: string; plaatsnaam?: string; provincie?: string; lat?: number; lng?: number }
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
