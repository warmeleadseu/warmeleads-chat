const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface AddressResult {
  plaatsnaam: string;
  provincie: string;
  lat?: number;
  lng?: number;
  land?: 'NL' | 'BE';
}

// PDOK gebruikt de Friese officiele naam 'Fryslân'; Nominatim soms 'Fryslàn'.
// In onze database hanteren we consequent 'Friesland' zodat exports/filters/
// stats niet uit elkaar lopen op spelling.
const PROVINCE_ALIASES: Record<string, string> = {
  'Fryslân': 'Friesland',
  'Fryslan': 'Friesland',
  'Fryslàn': 'Friesland',
  /** Oud label in gratis-account UI; leads/targets gebruiken `Limburg` (BE-postcode). */
  'Limburg (BE)': 'Limburg',
};

export function normalizeProvincie(val: string | undefined | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  return PROVINCE_ALIASES[trimmed] || trimmed;
}

export function isValidPlace(val: string | undefined): boolean {
  if (!val) return false;
  const v = val.trim();
  if (v.length < 2) return false;
  if (/^[-–.…\/\\]+$/.test(v)) return false;
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

function extract4Digits(raw: string): string | null {
  const match = raw.replace(/\s+/g, '').match(/(\d{4})/);
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

/** Publiek voor filters / validatie; zelfde logica als interne adres-resolver (+31/+32, 06/04, 316…/32…). */
export function detectCountryFromPhone(phone: string | undefined): 'NL' | 'BE' | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (/^(\+31|0031)/.test(cleaned)) return 'NL';
  if (/^(\+32|0032)/.test(cleaned)) return 'BE';
  if (/^06\d{8}$/.test(cleaned)) return 'NL';
  if (/^04\d{8}$/.test(cleaned)) return 'BE';
  // Import zonder +: 316… (NL), 324… / 322… / 323… (BE) — E.164 zonder leading +
  if (/^31[67]\d{8}$/.test(cleaned)) return 'NL';
  // BE: landcode 32 + nationaal nummer (meestal 9 cijfers; soms korter/langer in imports)
  if (/^32[1-9]\d{6,11}$/.test(cleaned)) return 'BE';
  return null;
}

function detectCountryFromEmail(email: string | undefined): 'NL' | 'BE' | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase().trim() ?? '';
  if (domain.endsWith('.be')) return 'BE';
  if (domain.endsWith('.nl')) return 'NL';
  return null;
}

/**
 * Bepaalt welk land we voor adres-lookup gebruiken.
 * Belangrijk: bij postcodes die alleen 4 cijfers zijn (BE-vorm, maar ambigu t.o.v. NL)
 * gaat telefoon/e-mail vóór een (fout) opgeslagen `land` in de database.
 */
function resolveEffectiveCountry(
  postcode: string,
  storedLand: 'NL' | 'BE' | null | undefined,
  telefoonnummer: string | undefined,
  email: string | undefined
): 'NL' | 'BE' | null {
  const fromFormat = detectCountry(postcode);
  if (fromFormat === 'NL' || fromFormat === 'BE') return fromFormat;

  const fromPhone = detectCountryFromPhone(telefoonnummer);
  if (fromPhone) return fromPhone;

  const fromEmail = detectCountryFromEmail(email);
  if (fromEmail) return fromEmail;

  if (storedLand === 'NL' || storedLand === 'BE') return storedLand;

  return null;
}

/**
 * Detect if a postcode is Belgian (4 digits only) or Dutch (4 digits + 2 letters).
 * Returns 'NL', 'BE', or null if ambiguous (4-digit only without context).
 */
export function detectCountry(postcode: string): 'NL' | 'BE' | null {
  const stripped = postcode.replace(/\s+/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}/.test(stripped)) return 'NL';
  if (/\d{4}[A-Z]{2}/.test(stripped)) return 'NL';
  if (/^\d{4}$/.test(stripped)) return null; // ambiguous! could be NL without letters or BE
  const digits = stripped.match(/^(\d{4})/);
  if (digits) {
    const hasLetters = /[A-Z]/.test(stripped.slice(4, 6));
    return hasLetters ? 'NL' : null; // still ambiguous without letters
  }
  return null;
}

/**
 * Smart country detection using all available lead data.
 * Priority: postcode-formaat (1234AB / duidelijk BE) > telefoon > expliciet land
 * Voor ambigue 4-cijfer-postcodes: gebruik `resolveEffectiveCountry` in resolveAddress.
 */
export function smartDetectCountry(
  postcode: string,
  opts?: { land?: string; telefoonnummer?: string; email?: string }
): 'NL' | 'BE' | null {
  return resolveEffectiveCountry(postcode, opts?.land as 'NL' | 'BE' | undefined, opts?.telefoonnummer, opts?.email);
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

// ─── NL address resolution ───────────────────────────────────────────────

async function resolveAddressNL(postcode: string, huisnummer: string): Promise<AddressResult | null> {
  const clean = extractPostcodeNL(postcode);
  const hnr = extractHuisnummer(huisnummer);
  // Zonder huisnummer: alleen postcodedistrict (woonplaats/provincie op 4 cijfers + letters indien aanwezig)
  if (!hnr) {
    const digits = extract4Digits(postcode);
    if (clean) {
      const r = await pdokSearch(clean, 'postcode');
      if (r) return r;
    }
    if (digits) {
      const r = await pdokSearch(digits, 'postcode');
      if (r) return r;
    }
    const compact = postcode.replace(/\s+/g, '').trim();
    if (compact) {
      const r = await pdokSearch(compact, 'postcode');
      if (r) return r;
    }
    return null;
  }

  // Strategy 1: full postcode + huisnummer
  if (clean) {
    const r = await pdokSearch(`${clean} ${hnr}`, 'adres');
    if (r) return r;
  }

  // Strategy 2: just 4 digits + huisnummer (user forgot letters)
  const digits = extract4Digits(postcode);
  if (digits) {
    const r = await pdokSearch(`${digits} ${hnr}`, 'adres');
    if (r) return r;
  }

  // Strategy 3: just 4 digits (get postcode area center)
  if (digits) {
    const r = await pdokSearch(digits, 'postcode');
    if (r) return r;
  }

  // Strategy 4: PDOK free-text with raw input
  const r = await pdokSearch(`${postcode} ${huisnummer}`, 'adres');
  if (r) return r;

  return null;
}

async function pdokSearch(query: string, type: 'adres' | 'postcode'): Promise<AddressResult | null> {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(
      `${PDOK_URL}?q=${q}&fq=type:${type}&rows=1&fl=woonplaatsnaam,provincienaam,centroide_ll`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (!doc) return null;
    const coords = doc.centroide_ll ? parseWKTPoint(doc.centroide_ll) : null;
    return {
      plaatsnaam: doc.woonplaatsnaam || '',
      provincie: normalizeProvincie(doc.provincienaam),
      lat: coords?.lat,
      lng: coords?.lng,
      land: 'NL',
    };
  } catch {
    return null;
  }
}

// ─── BE address resolution ───────────────────────────────────────────────

/** Geen strikte rate limit als OSM Nominatim; postcodes[] matcht exacte BE-PC. */
async function resolveAddressBE_OpenMeteo(postcode: string): Promise<AddressResult | null> {
  const clean = extractPostcodeBE(postcode);
  if (!clean) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&countryCode=BE&count=25`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.results as
      | Array<{ name: string; latitude: number; longitude: number; postcodes?: string[]; population?: number }>
      | undefined;
    if (!list?.length) return null;
    const withPc = list.filter(r => r.postcodes?.includes(clean));
    const pool = withPc.length ? withPc : list;
    pool.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    const hit = pool[0];
    if (!hit?.name) return null;
    return {
      plaatsnaam: hit.name,
      provincie: beProvincie(clean),
      lat: hit.latitude,
      lng: hit.longitude,
      land: 'BE',
    };
  } catch {
    return null;
  }
}

async function resolveAddressBE(postcode: string, huisnummer: string): Promise<AddressResult | null> {
  const clean = extractPostcodeBE(postcode);
  if (!clean) return null;
  const hnr = extractHuisnummer(huisnummer);

  const withBeProv = (r: AddressResult): AddressResult => ({
    ...r,
    land: 'BE',
    provincie: beProvincie(clean) || r.provincie,
  });

  const om = await resolveAddressBE_OpenMeteo(postcode);
  if (om?.plaatsnaam) return withBeProv(om);

  if (!hnr) {
    const r2 = await nominatimSearch({ postalcode: clean, country: 'be' });
    if (r2) return withBeProv(r2);
    const r2b = await nominatimSearchQ(`postcode ${clean}, Belgium`, 'be');
    return r2b ? withBeProv(r2b) : null;
  }

  const rPc = await nominatimSearch({ postalcode: clean, country: 'be' });
  if (rPc?.plaatsnaam) return withBeProv(rPc);

  const rQ = await nominatimSearchQ(`${hnr} ${clean}, Belgium`, 'be');
  return rQ ? withBeProv(rQ) : null;
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'WarmeLeads-CRM/1.0 (info@warmeleads.eu)',
  Accept: 'application/json',
};

async function nominatimFetch(url: string): Promise<Response> {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: NOMINATIM_HEADERS,
    });
    if (res.status === 429 && attempt < maxAttempts - 1) {
      const wait = 1250 * 2 ** attempt;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  return fetch(url, { signal: AbortSignal.timeout(8000), headers: NOMINATIM_HEADERS });
}

function nominatimDocToResult(doc: { lat?: string; lon?: string; address?: Record<string, string> }): AddressResult | null {
  const addr = doc.address || {};
  const plaatsnaam =
    addr.city || addr.town || addr.village || addr.municipality || addr.city_district || addr.hamlet || '';
  const provincie = normalizeProvincie(addr.state);
  const lat = doc.lat ? parseFloat(doc.lat) : undefined;
  const lng = doc.lon ? parseFloat(doc.lon) : undefined;
  if (!plaatsnaam && !provincie && (lat == null || lng == null)) return null;
  return { plaatsnaam, provincie, lat, lng };
}

async function nominatimSearch(params: Record<string, string>): Promise<AddressResult | null> {
  try {
    const searchParams = new URLSearchParams({ ...params, format: 'json', addressdetails: '1', limit: '1' });
    const res = await nominatimFetch(`${NOMINATIM_URL}?${searchParams}`);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return nominatimDocToResult(data[0]);
  } catch {
    return null;
  }
}

/** Vrije tekst; `countrycodes` is ISO 3166-1 alpha2 (comma-separated). */
async function nominatimSearchQ(q: string, countrycodes: string): Promise<AddressResult | null> {
  try {
    const searchParams = new URLSearchParams({
      q,
      format: 'json',
      addressdetails: '1',
      limit: '1',
      countrycodes,
    });
    const res = await nominatimFetch(`${NOMINATIM_URL}?${searchParams}`);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return nominatimDocToResult(data[0]);
  } catch {
    return null;
  }
}

// ─── Smart resolve: tries both NL and BE when ambiguous ──────────────────

function isStrictFourDigitPostcode(postcode: string): boolean {
  return /^\d{4}$/.test(postcode.replace(/\s+/g, ''));
}

export async function resolveAddress(
  postcode: string,
  huisnummer: string,
  country?: 'NL' | 'BE' | null,
  telefoonnummer?: string,
  email?: string
): Promise<AddressResult | null> {
  if (!postcode?.trim()) return null;

  const detectedCountry = resolveEffectiveCountry(postcode, country ?? undefined, telefoonnummer, email);

  if (detectedCountry === 'NL') {
    const r = await resolveAddressNL(postcode, huisnummer);
    if (r) return r;
    return resolveAddressBE(postcode, huisnummer);
  }

  if (detectedCountry === 'BE') {
    // Nooit PDOK/NL als fallback: bij 4-cijfer-postcode levert dat bijna altijd foute NL-plaatsen.
    return (await resolveAddressBE(postcode, huisnummer)) ?? null;
  }

  // Geen uniek land: parallel NL + BE (typisch ambigue invoer)
  const [nlResult, beResult] = await Promise.all([
    resolveAddressNL(postcode, huisnummer),
    resolveAddressBE(postcode, huisnummer),
  ]);

  if (nlResult?.lat && !beResult?.lat) return nlResult;
  if (beResult?.lat && !nlResult?.lat) return beResult;

  if (nlResult?.plaatsnaam && !beResult?.plaatsnaam) return nlResult;
  if (beResult?.plaatsnaam && !nlResult?.plaatsnaam) return beResult;

  // Exact 4 cijfers zonder letters: in deze markt vaker BE; PDOK geeft anders foutieve NL-plaatsen
  if (isStrictFourDigitPostcode(postcode)) return beResult || nlResult || null;

  return nlResult || beResult || null;
}

// ─── City lookup ─────────────────────────────────────────────────────────

export async function resolveCity(
  plaatsnaam: string,
  country?: 'NL' | 'BE'
): Promise<{ lat: number; lng: number; naam: string; land: string } | null> {
  if (!plaatsnaam || plaatsnaam.trim().length < 2) return null;

  if (!country || country === 'NL') {
    // PDOK is af en toe overbelast (Solr "Max requests queued"). Een ruimere timeout
    // voorkomt dat we te snel naar Nominatim vallen voor doodgewone NL-plaatsen.
    try {
      const q = encodeURIComponent(plaatsnaam.trim());
      const res = await fetch(
        `${PDOK_URL}?q=${q}&fq=type:woonplaats&rows=1&fl=woonplaatsnaam,centroide_ll`,
        { signal: AbortSignal.timeout(6000) }
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

  // Fallback: Nominatim. Belangrijk: bij vrije-tekst-zoek (`q`) moet het filter
  // `countrycodes` heten — `country` is alleen geldig in een structured query
  // en geeft anders een 400 ("cannot be used together with 'q' parameter").
  try {
    const params = new URLSearchParams({
      q: plaatsnaam.trim(),
      countrycodes: country === 'BE' ? 'be' : 'be,nl',
      format: 'json',
      addressdetails: '1',
      limit: '1',
    });
    const res = await nominatimFetch(`${NOMINATIM_URL}?${params}`);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
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

// ─── Lead enrichment ─────────────────────────────────────────────────────

export async function enrichLeadAddress<
  T extends {
    postcode?: string;
    huisnummer?: string;
    plaatsnaam?: string;
    provincie?: string;
    lat?: number;
    lng?: number;
    land?: string;
    telefoonnummer?: string;
    email?: string;
  }
>(lead: T): Promise<T> {
  const needsPlace = !isValidPlace(lead.plaatsnaam);
  const needsProv = !isValidPlace(lead.provincie);
  const needsCoords = !lead.lat || !lead.lng;
  // Normaliseer de bestaande provincie-waarde altijd, ook als we niet
  // verrijken; dat voorkomt dat handmatige inserts of webhooks 'Fryslân'
  // doorlaten.
  const normalizedExisting = normalizeProvincie(lead.provincie);
  if ((!needsPlace && !needsProv && !needsCoords) || !lead.postcode) {
    if (normalizedExisting !== lead.provincie) {
      return { ...lead, provincie: normalizedExisting };
    }
    return lead;
  }

  const result = await resolveAddress(
    lead.postcode,
    lead.huisnummer ?? '',
    lead.land as 'NL' | 'BE' | undefined,
    lead.telefoonnummer,
    lead.email
  );
  if (!result) {
    if (normalizedExisting !== lead.provincie) {
      return { ...lead, provincie: normalizedExisting };
    }
    return lead;
  }

  return {
    ...lead,
    plaatsnaam: needsPlace && result.plaatsnaam ? result.plaatsnaam : lead.plaatsnaam,
    provincie: needsProv && result.provincie ? result.provincie : normalizedExisting,
    lat: needsCoords && result.lat ? result.lat : lead.lat,
    lng: needsCoords && result.lng ? result.lng : lead.lng,
    land: result.land ?? lead.land,
  };
}

export async function enrichLeadsAddress<
  T extends {
    postcode?: string;
    huisnummer?: string;
    plaatsnaam?: string;
    provincie?: string;
    lat?: number;
    lng?: number;
    land?: string;
    telefoonnummer?: string;
    email?: string;
  }
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
