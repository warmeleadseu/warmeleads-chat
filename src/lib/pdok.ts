const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface AddressResult {
  plaatsnaam: string;
  provincie: string;
  lat?: number;
  lng?: number;
  land?: 'NL' | 'BE';
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

function extractPostcodeNL(raw: string): string | null {
  const stripped = raw.replace(/\s+/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(stripped)) return stripped;
  const match = stripped.match(/(\d{4}[A-Z]{2})/);
  if (match) return match[1];
  const digitsOnly = raw.replace(/\s+/g, '').match(/^(\d{4})[^A-Za-z0-9]?([A-Za-z]{2})/);
  if (digitsOnly) return (digitsOnly[1] + digitsOnly[2]).toUpperCase();
  return null;
}

function extractPostcodeBE(raw: string): string | null {
  const stripped = raw.replace(/\s+/g, '');
  const match = stripped.match(/(\d{4})/);
  return match ? match[1] : null;
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

/**
 * Detect if a postcode is Belgian (4 digits only) or Dutch (4 digits + 2 letters).
 * Returns 'NL', 'BE', or null if unrecognizable.
 */
export function detectCountry(postcode: string): 'NL' | 'BE' | null {
  const stripped = postcode.replace(/\s+/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}/.test(stripped)) return 'NL';
  if (/^\d{4}$/.test(stripped)) {
    const num = parseInt(stripped, 10);
    if (num >= 1000 && num <= 9999) return 'BE';
  }
  if (/\d{4}[A-Z]{2}/.test(stripped)) return 'NL';
  const digits = stripped.match(/^(\d{4})/);
  if (digits) {
    const hasLetters = /[A-Z]/.test(stripped.slice(4, 6));
    return hasLetters ? 'NL' : 'BE';
  }
  return null;
}

const BE_PROVINCE_MAP: [number, number, string][] = [
  [1000, 1299, 'Brussels'],
  [1300, 1499, 'Waals-Brabant'],
  [1500, 1999, 'Vlaams-Brabant'],
  [2000, 2999, 'Antwerpen'],
  [3000, 3499, 'Vlaams-Brabant'],
  [3500, 3999, 'Limburg'],
  [4000, 4999, 'Luik'],
  [5000, 5999, 'Namen'],
  [6000, 6599, 'Henegouwen'],
  [6600, 6999, 'Luxemburg'],
  [7000, 7999, 'Henegouwen'],
  [8000, 8999, 'West-Vlaanderen'],
  [9000, 9999, 'Oost-Vlaanderen'],
];

function beProvincie(postcode: string): string {
  const num = parseInt(postcode, 10);
  for (const [min, max, prov] of BE_PROVINCE_MAP) {
    if (num >= min && num <= max) return prov;
  }
  return '';
}

async function resolveAddressNL(postcode: string, huisnummer: string): Promise<AddressResult | null> {
  const clean = extractPostcodeNL(postcode);
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
      land: 'NL',
    };
  } catch {
    return null;
  }
}

async function resolveAddressBE(postcode: string, huisnummer: string): Promise<AddressResult | null> {
  const clean = extractPostcodeBE(postcode);
  if (!clean) return null;
  const hnr = extractHuisnummer(huisnummer);
  if (!hnr) return null;

  try {
    const params = new URLSearchParams({
      postalcode: clean,
      street: hnr,
      country: 'be',
      format: 'json',
      addressdetails: '1',
      limit: '1',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'WarmeLeads-CRM/1.0 (info@warmeleads.eu)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) {
      const fallbackParams = new URLSearchParams({
        postalcode: clean,
        country: 'be',
        format: 'json',
        addressdetails: '1',
        limit: '1',
      });
      const fallbackRes = await fetch(`${NOMINATIM_URL}?${fallbackParams}`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'WarmeLeads-CRM/1.0 (info@warmeleads.eu)' },
      });
      if (!fallbackRes.ok) return null;
      const fallbackData = await fallbackRes.json();
      if (!fallbackData || fallbackData.length === 0) return null;
      const doc = fallbackData[0];
      const addr = doc.address || {};
      return {
        plaatsnaam: addr.city || addr.town || addr.village || addr.municipality || addr.city_district || '',
        provincie: beProvincie(clean) || addr.state || '',
        lat: doc.lat ? parseFloat(doc.lat) : undefined,
        lng: doc.lon ? parseFloat(doc.lon) : undefined,
        land: 'BE',
      };
    }
    const doc = data[0];
    const addr = doc.address || {};
    return {
      plaatsnaam: addr.city || addr.town || addr.village || addr.municipality || addr.city_district || '',
      provincie: beProvincie(clean) || addr.state || '',
      lat: doc.lat ? parseFloat(doc.lat) : undefined,
      lng: doc.lon ? parseFloat(doc.lon) : undefined,
      land: 'BE',
    };
  } catch {
    return null;
  }
}

export async function resolveAddress(
  postcode: string,
  huisnummer: string,
  country?: 'NL' | 'BE' | null
): Promise<AddressResult | null> {
  if (!postcode || !huisnummer) return null;

  const detectedCountry = country || detectCountry(postcode);

  if (detectedCountry === 'BE') {
    return resolveAddressBE(postcode, huisnummer);
  }

  const nlResult = await resolveAddressNL(postcode, huisnummer);
  if (nlResult) return nlResult;

  if (!detectedCountry) {
    return resolveAddressBE(postcode, huisnummer);
  }

  return null;
}

export async function resolveCity(
  plaatsnaam: string,
  country?: 'NL' | 'BE'
): Promise<{ lat: number; lng: number; naam: string; land: string } | null> {
  if (!plaatsnaam || plaatsnaam.trim().length < 2) return null;

  if (!country || country === 'NL') {
    try {
      const q = encodeURIComponent(plaatsnaam.trim());
      const res = await fetch(
        `${PDOK_URL}?q=${q}&fq=type:woonplaats&rows=1&fl=woonplaatsnaam,centroide_ll`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const data = await res.json();
        const doc = data?.response?.docs?.[0];
        if (doc?.centroide_ll) {
          const coords = parseWKTPoint(doc.centroide_ll);
          if (coords) return { lat: coords.lat, lng: coords.lng, naam: doc.woonplaatsnaam || plaatsnaam, land: 'NL' };
        }
      }
    } catch { /* fall through */ }
  }

  try {
    const params = new URLSearchParams({
      q: plaatsnaam.trim(),
      country: country === 'BE' ? 'be' : 'be,nl',
      format: 'json',
      addressdetails: '1',
      limit: '1',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'WarmeLeads-CRM/1.0 (info@warmeleads.eu)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    const doc = data[0];
    const addr = doc.address || {};
    const naam = addr.city || addr.town || addr.village || addr.municipality || plaatsnaam;
    const land = addr.country_code === 'be' ? 'BE' : 'NL';
    return { lat: parseFloat(doc.lat), lng: parseFloat(doc.lon), naam, land };
  } catch {
    return null;
  }
}

export async function enrichLeadAddress<
  T extends { postcode?: string; huisnummer?: string; plaatsnaam?: string; provincie?: string; lat?: number; lng?: number; land?: string }
>(lead: T): Promise<T> {
  const needsPlace = !isValidPlace(lead.plaatsnaam);
  const needsProv = !isValidPlace(lead.provincie);
  const needsCoords = !lead.lat || !lead.lng;
  if ((!needsPlace && !needsProv && !needsCoords) || !lead.postcode || !lead.huisnummer) {
    return lead;
  }

  const result = await resolveAddress(lead.postcode, lead.huisnummer, lead.land as 'NL' | 'BE' | undefined);
  if (!result) return lead;

  return {
    ...lead,
    plaatsnaam: needsPlace && result.plaatsnaam ? result.plaatsnaam : lead.plaatsnaam,
    provincie: needsProv && result.provincie ? result.provincie : lead.provincie,
    lat: needsCoords && result.lat ? result.lat : lead.lat,
    lng: needsCoords && result.lng ? result.lng : lead.lng,
    land: !lead.land && result.land ? result.land : lead.land,
  };
}

export async function enrichLeadsAddress<
  T extends { postcode?: string; huisnummer?: string; plaatsnaam?: string; provincie?: string; lat?: number; lng?: number; land?: string }
>(leads: T[]): Promise<T[]> {
  const CONCURRENCY = 5;
  const results: T[] = [...leads];

  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const enriched = await Promise.all(batch.map(l => enrichLeadAddress(l)));
    enriched.forEach((l, idx) => { results[i + idx] = l; });
  }

  return results;
}
