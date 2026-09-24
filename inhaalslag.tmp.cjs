"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// scripts/meta-inhaalslag.ts
var import_supabase_js2 = require("@supabase/supabase-js");
var import_fs = require("fs");

// src/lib/pdok.ts
var PDOK_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
var NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
var PROVINCE_ALIASES = {
  "Frysl\xE2n": "Friesland",
  "Fryslan": "Friesland",
  "Frysl\xE0n": "Friesland",
  /** Oud label in gratis-account UI; leads/targets gebruiken `Limburg` (BE-postcode). */
  "Limburg (BE)": "Limburg"
};
function normalizeProvincie(val) {
  if (!val) return "";
  const trimmed = val.trim();
  return PROVINCE_ALIASES[trimmed] || trimmed;
}
function isValidPlace(val) {
  if (!val) return false;
  const v = val.trim();
  if (v.length < 2) return false;
  if (/^[-–.…\/\\]+$/.test(v)) return false;
  if (v.includes("@")) return false;
  if (/^\+?\d[\d\s\-().]{6,}$/.test(v)) return false;
  if (/^\d+$/.test(v)) return false;
  if (v.includes("_")) return false;
  const low = v.toLowerCase();
  if (["n/a", "nvt", "n.v.t.", "onbekend", "unknown", "geen", "x", "xx", "xxx", "test", "?", "??", "null", "undefined", "none"].includes(low)) return false;
  return true;
}
function extractPostcodeNL(raw) {
  const stripped = raw.replace(/\s+/g, "").toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(stripped)) return stripped;
  const match = stripped.match(/(\d{4}[A-Z]{2})/);
  if (match) return match[1];
  const digitsOnly = raw.replace(/\s+/g, "").match(/^(\d{4})[^A-Za-z0-9]?([A-Za-z]{2})/);
  if (digitsOnly) return (digitsOnly[1] + digitsOnly[2]).toUpperCase();
  return null;
}
function extractPostcodeBE(raw) {
  const stripped = raw.replace(/\s+/g, "");
  const match = stripped.match(/(\d{4})/);
  return match ? match[1] : null;
}
function extract4Digits(raw) {
  const match = raw.replace(/\s+/g, "").match(/(\d{4})/);
  return match ? match[1] : null;
}
function extractHuisnummer(raw) {
  const match = raw.trim().match(/^(\d+)/);
  return match ? match[1] : raw.trim();
}
function parseWKTPoint(wkt) {
  const m = wkt.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
  if (!m) return null;
  return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
}
function detectCountryFromPhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (/^(\+31|0031)/.test(cleaned)) return "NL";
  if (/^(\+32|0032)/.test(cleaned)) return "BE";
  if (/^06\d{8}$/.test(cleaned)) return "NL";
  if (/^04\d{8}$/.test(cleaned)) return "BE";
  if (/^31[67]\d{8}$/.test(cleaned)) return "NL";
  if (/^32[1-9]\d{6,11}$/.test(cleaned)) return "BE";
  return null;
}
function detectCountryFromEmail(email) {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  if (domain.endsWith(".be")) return "BE";
  if (domain.endsWith(".nl")) return "NL";
  return null;
}
function resolveEffectiveCountry(postcode, storedLand, telefoonnummer, email) {
  const fromFormat = detectCountry(postcode);
  if (fromFormat === "NL" || fromFormat === "BE") return fromFormat;
  const fromPhone = detectCountryFromPhone(telefoonnummer);
  if (fromPhone) return fromPhone;
  const fromEmail = detectCountryFromEmail(email);
  if (fromEmail) return fromEmail;
  if (storedLand === "NL" || storedLand === "BE") return storedLand;
  return null;
}
function detectCountry(postcode) {
  const stripped = postcode.replace(/\s+/g, "").toUpperCase();
  if (/^\d{4}[A-Z]{2}/.test(stripped)) return "NL";
  if (/\d{4}[A-Z]{2}/.test(stripped)) return "NL";
  if (/^\d{4}$/.test(stripped)) return null;
  const digits = stripped.match(/^(\d{4})/);
  if (digits) {
    const hasLetters = /[A-Z]/.test(stripped.slice(4, 6));
    return hasLetters ? "NL" : null;
  }
  return null;
}
var BE_PROVINCE_MAP = [
  [1e3, 1299, "Brussels"],
  [1300, 1499, "Waals-Brabant"],
  [1500, 1999, "Vlaams-Brabant"],
  [2e3, 2999, "Antwerpen"],
  [3e3, 3499, "Vlaams-Brabant"],
  [3500, 3999, "Limburg"],
  [4e3, 4999, "Luik"],
  [5e3, 5999, "Namen"],
  [6e3, 6599, "Henegouwen"],
  [6600, 6999, "Luxemburg"],
  [7e3, 7999, "Henegouwen"],
  [8e3, 8999, "West-Vlaanderen"],
  [9e3, 9999, "Oost-Vlaanderen"]
];
function beProvincie(postcode) {
  const num = parseInt(postcode, 10);
  for (const [min, max, prov] of BE_PROVINCE_MAP) {
    if (num >= min && num <= max) return prov;
  }
  return "";
}
async function resolveAddressNL(postcode, huisnummer) {
  const clean = extractPostcodeNL(postcode);
  const hnr = extractHuisnummer(huisnummer);
  if (!hnr) {
    const digits2 = extract4Digits(postcode);
    if (clean) {
      const r2 = await pdokSearch(clean, "postcode");
      if (r2) return r2;
    }
    if (digits2) {
      const r2 = await pdokSearch(digits2, "postcode");
      if (r2) return r2;
    }
    const compact = postcode.replace(/\s+/g, "").trim();
    if (compact) {
      const r2 = await pdokSearch(compact, "postcode");
      if (r2) return r2;
    }
    return null;
  }
  if (clean) {
    const r2 = await pdokSearch(`${clean} ${hnr}`, "adres");
    if (r2) return r2;
  }
  const digits = extract4Digits(postcode);
  if (digits) {
    const r2 = await pdokSearch(`${digits} ${hnr}`, "adres");
    if (r2) return r2;
  }
  if (digits) {
    const r2 = await pdokSearch(digits, "postcode");
    if (r2) return r2;
  }
  const r = await pdokSearch(`${postcode} ${huisnummer}`, "adres");
  if (r) return r;
  return null;
}
async function pdokSearch(query, type) {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(
      `${PDOK_URL}?q=${q}&fq=type:${type}&rows=1&fl=woonplaatsnaam,provincienaam,centroide_ll`,
      { signal: AbortSignal.timeout(4e3) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (!doc) return null;
    const coords = doc.centroide_ll ? parseWKTPoint(doc.centroide_ll) : null;
    return {
      plaatsnaam: doc.woonplaatsnaam || "",
      provincie: normalizeProvincie(doc.provincienaam),
      lat: coords?.lat,
      lng: coords?.lng,
      land: "NL"
    };
  } catch {
    return null;
  }
}
async function resolveAddressBE_OpenMeteo(postcode) {
  const clean = extractPostcodeBE(postcode);
  if (!clean) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&countryCode=BE&count=25`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.results;
    if (!list?.length) return null;
    const withPc = list.filter((r) => r.postcodes?.includes(clean));
    const pool = withPc.length ? withPc : list;
    pool.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    const hit = pool[0];
    if (!hit?.name) return null;
    return {
      plaatsnaam: hit.name,
      provincie: beProvincie(clean),
      lat: hit.latitude,
      lng: hit.longitude,
      land: "BE"
    };
  } catch {
    return null;
  }
}
async function resolveAddressBE(postcode, huisnummer) {
  const clean = extractPostcodeBE(postcode);
  if (!clean) return null;
  const hnr = extractHuisnummer(huisnummer);
  const withBeProv = (r) => ({
    ...r,
    land: "BE",
    provincie: beProvincie(clean) || r.provincie
  });
  const om = await resolveAddressBE_OpenMeteo(postcode);
  if (om?.plaatsnaam) return withBeProv(om);
  if (!hnr) {
    const r2 = await nominatimSearch({ postalcode: clean, country: "be" });
    if (r2) return withBeProv(r2);
    const r2b = await nominatimSearchQ(`postcode ${clean}, Belgium`, "be");
    return r2b ? withBeProv(r2b) : null;
  }
  const rPc = await nominatimSearch({ postalcode: clean, country: "be" });
  if (rPc?.plaatsnaam) return withBeProv(rPc);
  const rQ = await nominatimSearchQ(`${hnr} ${clean}, Belgium`, "be");
  return rQ ? withBeProv(rQ) : null;
}
var NOMINATIM_HEADERS = {
  "User-Agent": "WarmeLeads-CRM/1.0 (info@warmeleads.eu)",
  Accept: "application/json"
};
async function nominatimFetch(url) {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8e3),
      headers: NOMINATIM_HEADERS
    });
    if (res.status === 429 && attempt < maxAttempts - 1) {
      const wait = 1250 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  return fetch(url, { signal: AbortSignal.timeout(8e3), headers: NOMINATIM_HEADERS });
}
function nominatimDocToResult(doc) {
  const addr = doc.address || {};
  const plaatsnaam = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || addr.hamlet || "";
  const provincie = normalizeProvincie(addr.state);
  const lat = doc.lat ? parseFloat(doc.lat) : void 0;
  const lng = doc.lon ? parseFloat(doc.lon) : void 0;
  if (!plaatsnaam && !provincie && (lat == null || lng == null)) return null;
  return { plaatsnaam, provincie, lat, lng };
}
async function nominatimSearch(params) {
  try {
    const searchParams = new URLSearchParams({ ...params, format: "json", addressdetails: "1", limit: "1" });
    const res = await nominatimFetch(`${NOMINATIM_URL}?${searchParams}`);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return nominatimDocToResult(data[0]);
  } catch {
    return null;
  }
}
async function nominatimSearchQ(q, countrycodes) {
  try {
    const searchParams = new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      limit: "1",
      countrycodes
    });
    const res = await nominatimFetch(`${NOMINATIM_URL}?${searchParams}`);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return nominatimDocToResult(data[0]);
  } catch {
    return null;
  }
}
function isStrictFourDigitPostcode(postcode) {
  return /^\d{4}$/.test(postcode.replace(/\s+/g, ""));
}
async function resolveAddress(postcode, huisnummer, country, telefoonnummer, email) {
  if (!postcode?.trim()) return null;
  const detectedCountry = resolveEffectiveCountry(postcode, country ?? void 0, telefoonnummer, email);
  if (detectedCountry === "NL") {
    const r = await resolveAddressNL(postcode, huisnummer);
    if (r) return r;
    return resolveAddressBE(postcode, huisnummer);
  }
  if (detectedCountry === "BE") {
    return await resolveAddressBE(postcode, huisnummer) ?? null;
  }
  const [nlResult, beResult] = await Promise.all([
    resolveAddressNL(postcode, huisnummer),
    resolveAddressBE(postcode, huisnummer)
  ]);
  if (nlResult?.lat && !beResult?.lat) return nlResult;
  if (beResult?.lat && !nlResult?.lat) return beResult;
  if (nlResult?.plaatsnaam && !beResult?.plaatsnaam) return nlResult;
  if (beResult?.plaatsnaam && !nlResult?.plaatsnaam) return beResult;
  if (isStrictFourDigitPostcode(postcode)) return beResult || nlResult || null;
  return nlResult || beResult || null;
}
async function pdokStreet(query) {
  try {
    const q = encodeURIComponent(query.trim());
    const res = await fetch(
      `${PDOK_URL}?q=${q}&fq=type:adres&rows=1&fl=straatnaam`,
      { signal: AbortSignal.timeout(4e3) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    return doc?.straatnaam || null;
  } catch {
    return null;
  }
}
async function resolveStreetNameNL(postcode, huisnummer) {
  const hnr = extractHuisnummer(huisnummer);
  if (!hnr) return null;
  const clean = extractPostcodeNL(postcode);
  if (clean) {
    const r = await pdokStreet(`${clean} ${hnr}`);
    if (r) return r;
  }
  const digits = extract4Digits(postcode);
  if (digits) {
    const r = await pdokStreet(`${digits} ${hnr}`);
    if (r) return r;
  }
  return pdokStreet(`${postcode} ${huisnummer}`);
}
async function resolveStreetNameBE(postcode, huisnummer) {
  const clean = extractPostcodeBE(postcode);
  const hnr = extractHuisnummer(huisnummer);
  if (!clean || !hnr) return null;
  try {
    const params = new URLSearchParams({
      q: `${hnr} ${clean}, Belgium`,
      format: "json",
      addressdetails: "1",
      limit: "1",
      countrycodes: "be"
    });
    const res = await nominatimFetch(`${NOMINATIM_URL}?${params}`);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    const data = await res.json();
    const addr = data?.[0]?.address || {};
    return addr.road || null;
  } catch {
    return null;
  }
}
async function resolveStreetName(postcode, huisnummer, opts) {
  if (!postcode?.trim() || !huisnummer?.trim()) return null;
  const country = resolveEffectiveCountry(
    postcode,
    opts?.land ?? void 0,
    opts?.telefoonnummer,
    opts?.email
  );
  if (country === "BE") return resolveStreetNameBE(postcode, huisnummer);
  const nl = await resolveStreetNameNL(postcode, huisnummer);
  if (nl) return nl;
  if (country == null) return resolveStreetNameBE(postcode, huisnummer);
  return null;
}
async function attachResolvedStreet(lead) {
  const postcode = (lead.postcode ?? "").trim();
  const huisnummer = (lead.huisnummer ?? "").trim();
  if (!postcode || !huisnummer) return lead;
  const cf = lead.custom_fields && typeof lead.custom_fields === "object" && !Array.isArray(lead.custom_fields) ? lead.custom_fields : {};
  const existing = cf.straat ?? cf.street ?? cf.adres;
  if (typeof existing === "string" && existing.trim() !== "") return lead;
  const straat = await resolveStreetName(postcode, huisnummer, {
    land: lead.land ?? null,
    telefoonnummer: lead.telefoonnummer,
    email: lead.email
  });
  if (!straat) return lead;
  return { ...lead, custom_fields: { ...cf, straat } };
}
async function enrichLeadAddress(lead) {
  const needsPlace = !isValidPlace(lead.plaatsnaam);
  const needsProv = !isValidPlace(lead.provincie);
  const needsCoords = !lead.lat || !lead.lng;
  const normalizedExisting = normalizeProvincie(lead.provincie);
  let enriched = lead;
  if (lead.postcode && (needsPlace || needsProv || needsCoords)) {
    const result = await resolveAddress(
      lead.postcode,
      lead.huisnummer ?? "",
      lead.land,
      lead.telefoonnummer,
      lead.email
    );
    if (result) {
      enriched = {
        ...lead,
        plaatsnaam: needsPlace && result.plaatsnaam ? result.plaatsnaam : lead.plaatsnaam,
        provincie: needsProv && result.provincie ? result.provincie : normalizedExisting,
        lat: needsCoords && result.lat ? result.lat : lead.lat,
        lng: needsCoords && result.lng ? result.lng : lead.lng,
        land: result.land ?? lead.land
      };
    } else if (normalizedExisting !== lead.provincie) {
      enriched = { ...lead, provincie: normalizedExisting };
    }
  } else if (normalizedExisting !== lead.provincie) {
    enriched = { ...lead, provincie: normalizedExisting };
  }
  return attachResolvedStreet(enriched);
}

// src/lib/phoneValidation.ts
var PREMIUM_PREFIXES = ["0900", "0800", "0906", "0909"];
var KNOWN_TEST_NUMBERS = /* @__PURE__ */ new Set([
  "0612345678",
  "0612121212",
  "0600000000",
  "0123456789",
  "9876543210"
]);
function normalize(raw) {
  let n = raw.replace(/[\s\-().]/g, "");
  if (n.startsWith("+31")) n = "0" + n.slice(3);
  else if (n.startsWith("0031")) n = "0" + n.slice(4);
  else if (n.startsWith("+32")) n = "0" + n.slice(3);
  else if (n.startsWith("0032")) n = "0" + n.slice(4);
  return n;
}
function hasRepeatedDigits(n) {
  return /(.)\1{5,}/.test(n);
}
function isSequential(n) {
  const digits = n.replace(/\D/g, "");
  if (digits.length < 6) return false;
  let asc = 0;
  let desc = 0;
  for (let i = 1; i < digits.length; i++) {
    const diff = parseInt(digits[i]) - parseInt(digits[i - 1]);
    if (diff === 1) {
      asc++;
      desc = 0;
    } else if (diff === -1) {
      desc++;
      asc = 0;
    } else {
      asc = 0;
      desc = 0;
    }
    if (asc >= 5 || desc >= 5) return true;
  }
  return false;
}
function isPremium(n) {
  return PREMIUM_PREFIXES.some((p) => n.startsWith(p));
}
function isValidNLFormat(n) {
  if (/^06\d{8}$/.test(n)) return true;
  if (/^0[1-57]\d{8}$/.test(n)) return true;
  return false;
}
function isValidBEFormat(n) {
  if (/^04\d{8}$/.test(n)) return true;
  if (/^0[1-9]\d{7,8}$/.test(n)) return true;
  return false;
}
function validatePhone(raw) {
  if (!raw || raw.trim().length === 0) {
    return { valid: true, normalized: "", reason: "empty" };
  }
  const normalized = normalize(raw.trim());
  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly.length < 8) {
    return { valid: false, normalized, reason: "te kort" };
  }
  if (digitsOnly.length > 13) {
    return { valid: false, normalized, reason: "te lang" };
  }
  if (KNOWN_TEST_NUMBERS.has(normalized)) {
    return { valid: false, normalized, reason: "testnummer" };
  }
  if (hasRepeatedDigits(digitsOnly)) {
    return { valid: false, normalized, reason: "herhalende cijfers" };
  }
  if (isSequential(digitsOnly)) {
    return { valid: false, normalized, reason: "opeenvolgende cijfers" };
  }
  if (isPremium(normalized)) {
    return { valid: false, normalized, reason: "premium nummer" };
  }
  if (normalized.startsWith("0")) {
    if (!isValidNLFormat(normalized) && !isValidBEFormat(normalized)) {
      return { valid: false, normalized, reason: "ongeldig formaat" };
    }
  }
  return { valid: true, normalized };
}
function isPhoneValid(phone) {
  return validatePhone(phone).valid;
}

// src/lib/profanityFilter.ts
var PROFANITY_NL = [
  "kanker",
  "kut",
  "hoer",
  "lul",
  "tering",
  "tyfus",
  "klootzak",
  "mongool",
  "debiel",
  "achterlijk",
  "godverdomme",
  "godver",
  "kutwijf",
  "teringlijer",
  "kankerlijer",
  "kankerjoch",
  "kutjoch",
  "trut",
  "slet",
  "mietje",
  "flikker",
  "homo",
  "sukkel",
  "eikel",
  "reet",
  "pik",
  "neuk",
  "neuken",
  "oprotten",
  "opzouten",
  "donder op",
  "pleur op",
  "pleurt op",
  "sodemieter op",
  "tyf op",
  "opflikkeren",
  "opkankeren",
  "oppleuren",
  "optyfen",
  "kankerhoer",
  "kankerslet",
  "kuthoer",
  "teringhoer",
  "kankerzooi",
  "kutzooi",
  "tyfuszooi",
  "kankermongool",
  "kutmongool",
  "kankerlijer",
  "teringlijer",
  "tyfuslijer",
  "klere",
  "klerezooi",
  "klerelijer",
  "pokke",
  "pokkezooi",
  "pokkelijer"
];
var PROFANITY_EN = [
  "fuck",
  "fucking",
  "fucker",
  "fucked",
  "motherfucker",
  "shit",
  "shitty",
  "bullshit",
  "asshole",
  "bitch",
  "bastard",
  "dick",
  "dickhead",
  "pussy",
  "cunt",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "retarded",
  "dumbass",
  "jackass",
  "piss off",
  "screw you"
];
var LEET_MAP = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s"
};
var ALL_WORDS = [...PROFANITY_NL, ...PROFANITY_EN];
function deLeet(text) {
  return text.replace(/[0134 57@$]/g, (ch) => LEET_MAP[ch] || ch);
}
function containsProfanityInText(text) {
  if (!text || text.trim().length === 0) return null;
  const lower = text.toLowerCase();
  const deleeted = deLeet(lower);
  for (const word of ALL_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[\\s,;.!?()\\[\\]{}"'\\-_/])${escaped}(?:$|[\\s,;.!?()\\[\\]{}"'\\-_/])`, "i");
    if (regex.test(` ${lower} `) || regex.test(` ${deleeted} `)) {
      return word;
    }
  }
  return null;
}
function checkLeadProfanity(lead) {
  const fieldsToCheck = [
    ["naam_klant", lead.naam_klant],
    ["email", typeof lead.email === "string" ? lead.email.split("@")[0] : ""],
    ["notities", lead.notities]
  ];
  if (lead.custom_fields && typeof lead.custom_fields === "object") {
    for (const [k, v] of Object.entries(lead.custom_fields)) {
      if (typeof v === "string") fieldsToCheck.push([`custom_fields.${k}`, v]);
    }
  }
  for (const [field, value] of fieldsToCheck) {
    if (typeof value !== "string" || value.trim().length === 0) continue;
    const found = containsProfanityInText(value);
    if (found) return { blocked: true, word: found, field };
  }
  return { blocked: false };
}

// src/lib/leadQuality.ts
var FAKE_NAME_PATTERNS = [
  /^test/i,
  /^asdf/i,
  /^xxx/i,
  /^aaa/i,
  /^bbb/i,
  /^123/,
  /^nee$/i,
  /^neen$/i,
  /^geen$/i,
  /^nvt$/i,
  /^n\.?v\.?t\.?$/i,
  /^onbekend$/i
];
function calculateQualityScore(lead) {
  let score = 0;
  if (lead.telefoonnummer && lead.telefoonnummer.trim().length >= 8) {
    score += 20;
  }
  if (lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    score += 15;
  }
  const hasFullAddress = !!lead.postcode?.trim() && !!lead.huisnummer?.trim() && !!lead.plaatsnaam?.trim() && !!lead.provincie?.trim();
  if (hasFullAddress) {
    score += 20;
  }
  if (lead.lat != null && lead.lng != null && lead.lat !== 0 && lead.lng !== 0) {
    score += 10;
  }
  if (lead.phone_valid === true) {
    score += 15;
  }
  const name = lead.naam_klant?.trim() ?? "";
  if (name.length >= 3 && !FAKE_NAME_PATTERNS.some((p) => p.test(name))) {
    score += 10;
  }
  if (lead.custom_fields) {
    const filled = Object.values(lead.custom_fields).filter(
      (v) => v != null && String(v).trim().length > 0
    ).length;
    if (filled > 0) {
      score += 10;
    }
  }
  return Math.min(score, 100);
}

// src/lib/email.ts
var import_resend = require("resend");

// src/lib/supabase.ts
var import_supabase_js = require("@supabase/supabase-js");
function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return { url, key };
}
var createServerClient = () => {
  const { url, key } = readEnv();
  return (0, import_supabase_js.createClient)(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

// src/lib/email.ts
var _resend = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new import_resend.Resend(process.env.RESEND_API_KEY);
  return _resend;
}
var FROM = "WarmeLeads <noreply@warmeleads.eu>";
var EMAIL_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.warmeleads.eu";
var BASE_URL = EMAIL_BASE_URL;
async function logEmail(to, subject, html, status, opts, error, providerMessageId) {
  try {
    const supabase = createServerClient();
    const { data, error: dbError } = await supabase.from("email_log").insert({
      type: opts.type || "unknown",
      to_email: to,
      to_name: opts.toName || null,
      subject,
      html,
      status,
      error: error || null,
      metadata: opts.metadata || {},
      reply_to: opts.replyTo || null,
      body_text: opts.bodyText || null,
      from_admin_id: opts.fromAdminId || null,
      prospect_id: opts.prospectId || null,
      customer_id: opts.customerId || null,
      template_key: opts.templateKey || null,
      template_options: opts.templateOptions || null,
      unsubscribe_token: opts.unsubscribeToken || null,
      provider_message_id: providerMessageId || null,
      cc_emails: opts.cc && opts.cc.length > 0 ? opts.cc : null,
      bcc_emails: opts.bcc && opts.bcc.length > 0 ? opts.bcc : null
    }).select("id").single();
    if (dbError) {
      console.error("[email-log] insert error:", dbError.message, dbError.code);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[email-log] failed to log:", e);
    return null;
  }
}
async function dispatchEmail(to, subject, html, opts) {
  try {
    const resend = getResend();
    if (!resend) {
      console.warn("[email] RESEND_API_KEY not configured, skipping send");
      const id2 = await logEmail(to, subject, html, "failed", opts, "RESEND_API_KEY not configured");
      return { ok: false, emailLogId: id2, error: "RESEND_API_KEY not configured" };
    }
    const payload = {
      from: opts.from || FROM,
      to,
      subject,
      html
    };
    if (opts.replyTo) payload.replyTo = opts.replyTo;
    if (opts.bodyText) payload.text = opts.bodyText;
    if (opts.cc && opts.cc.length > 0) payload.cc = opts.cc;
    if (opts.bcc && opts.bcc.length > 0) payload.bcc = opts.bcc;
    if (opts.headers && Object.keys(opts.headers).length > 0) {
      payload.headers = opts.headers;
    }
    if (opts.attachments && opts.attachments.length > 0) {
      payload.attachments = opts.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType
      }));
    }
    const { data, error } = await resend.emails.send(payload);
    if (error) {
      console.error("[email] send failed:", error);
      const id2 = await logEmail(to, subject, html, "failed", opts, String(error.message || error));
      return { ok: false, emailLogId: id2, error: String(error.message || error) };
    }
    const messageId = data?.id ?? null;
    const id = await logEmail(to, subject, html, "sent", opts, void 0, messageId);
    return { ok: true, messageId, emailLogId: id };
  } catch (err) {
    console.error("[email] unexpected error:", err);
    const id = await logEmail(to, subject, html, "failed", opts, String(err));
    return { ok: false, emailLogId: id, error: String(err) };
  }
}
function layout(title, content) {
  const logoUrl = `${BASE_URL}/warmeleads-logo-2026.png`;
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9">
              <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px">
              <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">${title}</h1>
              <div style="font-size:15px;color:#475569;line-height:1.7">${content}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function statusBadge(text, color) {
  const colors = {
    green: { bg: "#ecfdf5", border: "#d1fae5", text: "#059669" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb" },
    orange: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c" },
    purple: { bg: "#faf5ff", border: "#e9d5ff", text: "#7c3aed" },
    red: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" }
  };
  const c = colors[color];
  return `<span style="display:inline-block;background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.3px">${text}</span>`;
}
function cta(text, url) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px">
    <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">${text}</a>
    </td></tr>
  </table>`;
}
async function sendEmail(to, subject, html, logOptions, attachments) {
  const result = await dispatchEmail(to, subject, html, {
    type: logOptions?.type || "unknown",
    toName: logOptions?.toName,
    metadata: logOptions?.metadata,
    attachments
  });
  return result.ok;
}
async function sendBatchMilestoneEmail(customer, batch, milestone) {
  const branchLabel = batch.branch_name || batch.branch;
  const greeting = customer.contact_person || customer.name;
  const pct = batch.batch_size > 0 ? Math.round(batch.leads_delivered / batch.batch_size * 100) : 0;
  const orderUrl = `${BASE_URL}/portal/bestellen?batch=${batch.id}`;
  const titles = {
    "80pct": `Je batch ${branchLabel} is voor ${pct}% voltooid`,
    completed: `Je batch ${branchLabel} is voltooid!`,
    reminder: `Je mist momenteel leads in ${branchLabel}`
  };
  const milestoneBadges = {
    "80pct": statusBadge(`${pct}% VOLTOOID`, "orange"),
    completed: statusBadge("&#10003; VOLTOOID", "green"),
    reminder: statusBadge("GEEN ACTIEVE BATCH", "red")
  };
  const bodies = {
    "80pct": `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
      <p style="margin:0 0 8px">Je batch <strong style="color:#0f172a">${branchLabel}</strong> is al voor <strong style="color:#3B2F75">${pct}%</strong> voltooid (${batch.leads_delivered} van ${batch.batch_size} leads geleverd).</p>
      <p style="margin:0">Bestel nu een vervolg batch zodat je geen leads mist zodra deze batch vol is.</p>`,
    completed: `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
      <p style="margin:0 0 8px">Je batch <strong style="color:#0f172a">${branchLabel}</strong> is volledig voltooid! Alle <strong style="color:#3B2F75">${batch.batch_size}</strong> leads zijn geleverd.</p>
      <p style="margin:0">Wil je blijven groeien? Bestel direct een nieuwe batch en ontvang weer verse leads.</p>`,
    reminder: `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${greeting},</p>
      <p style="margin:0 0 8px">Het is nu een paar dagen geleden dat je batch <strong style="color:#0f172a">${branchLabel}</strong> is voltooid. Momenteel ontvang je geen nieuwe leads in dit segment.</p>
      <p style="margin:0">Bestel een nieuwe batch om weer leads te ontvangen.</p>`
  };
  const content = `
    <p style="margin:0 0 20px">${milestoneBadges[milestone]}</p>
    ${bodies[milestone]}
    ${cta("Nieuwe batch bestellen &rarr;", orderUrl)}`;
  const milestoneTypes = { "80pct": "batch_80pct", completed: "batch_completed", reminder: "batch_reminder" };
  return sendEmail(
    customer.email,
    titles[milestone],
    layout(titles[milestone], content),
    { type: milestoneTypes[milestone] || "batch_milestone", toName: greeting, metadata: { customer_id: customer.id, batch_id: batch.id, milestone } }
  );
}

// src/lib/pushNotification.ts
var import_web_push = __toESM(require("web-push"));
var VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
var VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  import_web_push.default.setVapidDetails("mailto:info@warmeleads.eu", VAPID_PUBLIC, VAPID_PRIVATE);
}
async function sendPushToCustomer(customerId, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn("VAPID keys not configured, skipping push");
    return { sent: 0, failed: 0, cleaned: 0 };
  }
  const supabase = createServerClient();
  const { data: subs } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("customer_id", customerId);
  if (!subs || subs.length === 0) return { sent: 0, failed: 0, cleaned: 0 };
  const message = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let cleaned = 0;
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await import_web_push.default.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          message,
          { TTL: 86400 }
        );
        sent++;
      } catch (err) {
        const statusCode = err?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          cleaned++;
        } else {
          failed++;
          console.error(`Push failed for subscription ${sub.id}:`, err);
        }
      }
    })
  );
  void results;
  return { sent, failed, cleaned };
}
async function sendBatchMilestonePush(customerId, batchId, branchName, milestone) {
  const messages = {
    "80pct": {
      title: "Batch bijna vol!",
      body: `Je batch ${branchName} is bijna voltooid. Bestel nu een vervolg batch.`
    },
    completed: {
      title: "Batch voltooid!",
      body: `Je batch ${branchName} is volledig geleverd. Bestel een nieuwe batch om leads te blijven ontvangen.`
    },
    reminder: {
      title: `Je mist leads in ${branchName}`,
      body: "Je batch is al een paar dagen voltooid. Bestel een nieuwe batch om weer leads te ontvangen."
    }
  };
  const msg = messages[milestone];
  try {
    await sendPushToCustomer(customerId, {
      title: msg.title,
      body: msg.body,
      url: `/portal/bestellen?batch=${batchId}`,
      tag: `batch-${milestone}`
    });
  } catch (err) {
    console.error("sendBatchMilestonePush error:", err);
  }
}

// src/lib/batchNotifications.ts
async function checkBatchMilestones(supabase, batchId, delivered, batchSize) {
  const pct = batchSize > 0 ? delivered / batchSize * 100 : 0;
  const { data: batch } = await supabase.from("customer_batches").select("id, customer_id, branch, batch_size, leads_delivered, notified_80pct, notified_completed").eq("id", batchId).single();
  if (!batch) return;
  const { data: customer } = await supabase.from("customers").select("id, name, email, contact_person").eq("id", batch.customer_id).single();
  if (!customer) return;
  const { data: branchRow } = await supabase.from("branches").select("name").eq("slug", batch.branch).single();
  const branchName = branchRow?.name || batch.branch;
  const batchInfo = {
    id: batch.id,
    branch: batch.branch,
    branch_name: branchName,
    batch_size: batch.batch_size,
    leads_delivered: delivered
  };
  if (pct >= 80 && pct < 100 && !batch.notified_80pct) {
    await supabase.from("customer_batches").update({ notified_80pct: true }).eq("id", batchId);
    sendBatchMilestoneEmail(customer, batchInfo, "80pct").catch(() => {
    });
    sendBatchMilestonePush(customer.id, batchId, branchName, "80pct").catch(() => {
    });
  }
  if (pct >= 100 && !batch.notified_completed) {
    await supabase.from("customer_batches").update({ notified_completed: true }).eq("id", batchId);
    sendBatchMilestoneEmail(customer, batchInfo, "completed").catch(() => {
    });
    sendBatchMilestonePush(customer.id, batchId, branchName, "completed").catch(() => {
    });
  }
}

// src/lib/batchKind.ts
function normalizeBatchKind(raw) {
  if (raw === "niche_research") return "niche_research";
  if (raw === "bulk_leads") return "bulk_leads";
  return "leads";
}
function isPipelineBatchKind(kind) {
  return normalizeBatchKind(kind) === "leads";
}
function isMetaCampaignSyncBatchKind(kind) {
  const k = normalizeBatchKind(kind);
  return k === "leads" || k === "niche_research";
}

// src/lib/batchDeliveryModel.ts
function deliveryModelFromBatchKind(kind) {
  const normalized = normalizeBatchKind(kind);
  if (normalized === "niche_research") return "unlimited";
  if (normalized === "bulk_leads") return "manual";
  return "capped";
}
function normalizeDeliveryModel(raw, batchKind) {
  if (raw === "capped" || raw === "unlimited" || raw === "manual") return raw;
  return deliveryModelFromBatchKind(batchKind);
}
function isCappedDeliveryModel(model, batchKind) {
  return normalizeDeliveryModel(model, batchKind) === "capped";
}
function batchIsAtCapacity(input) {
  if (!isCappedDeliveryModel(input.delivery_model, input.batch_kind)) return false;
  const size = Math.max(0, Number(input.batch_size) || 0);
  if (size <= 0) return false;
  return (Number(input.leads_delivered) || 0) >= size;
}

// src/lib/batchAssignmentCaps.ts
var AMSTERDAM_TZ = "Europe/Amsterdam";
var DAY_MS = 24 * 60 * 60 * 1e3;
function amsterdamWallParts(now) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: AMSTERDAM_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short"
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "0";
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour,
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
    weekday: weekdayMap[get("weekday")] ?? 0
  };
}
function getLeadLimitPeriodAnchors(now = /* @__PURE__ */ new Date()) {
  const p = amsterdamWallParts(now);
  const timeOfDayMs = ((p.hour * 60 + p.minute) * 60 + p.second) * 1e3;
  const dayStart = new Date(now.getTime() - timeOfDayMs);
  const daysSinceMonday = (p.weekday + 6) % 7;
  const weekStart = new Date(dayStart.getTime() - daysSinceMonday * DAY_MS);
  return { dayStart, weekStart };
}
async function fetchBatchAssignmentCapCounts(supabase, batchId, now = /* @__PURE__ */ new Date()) {
  const { dayStart, weekStart } = getLeadLimitPeriodAnchors(now);
  const { data } = await supabase.from("lead_assignments").select("assigned_at, leads(created_at)").eq("batch_id", batchId).gte("assigned_at", weekStart.toISOString());
  let weekCount = 0;
  let todayCount = 0;
  const dayMs = dayStart.getTime();
  const weekMs = weekStart.getTime();
  for (const row of data ?? []) {
    const joined = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    const createdAtIso = joined?.created_at ?? null;
    const assignedAtIso = row.assigned_at;
    const referenceIso = createdAtIso ?? assignedAtIso;
    if (!referenceIso) continue;
    const t = new Date(referenceIso).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= weekMs) weekCount++;
    if (t >= dayMs) todayCount++;
  }
  return { todayCount, weekCount };
}

// src/lib/metaCampaignIds.ts
function coerceCustomerBatchMetaCampaignIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    const out = [];
    for (const x of raw) {
      const s = String(x).trim();
      if (/^\d+$/.test(s)) out.push(s);
    }
    return dedupeKeepOrder(out);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t);
        return coerceCustomerBatchMetaCampaignIds(parsed);
      } catch {
      }
    }
    if (t.startsWith("{") && t.endsWith("}")) {
      const inner = t.slice(1, -1);
      if (!inner.trim()) return [];
      const parts = inner.split(",").map((s) => s.replace(/^"(.*)"$/, "$1").trim());
      return dedupeKeepOrder(parts.filter((s) => /^\d+$/.test(s)));
    }
    return dedupeKeepOrder(t.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s)));
  }
  return [];
}
function dedupeKeepOrder(ids) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// src/lib/meta.ts
var META_GRAPH_URL = "https://graph.facebook.com/v21.0";
async function getMetaCredentials() {
  const envToken = process.env.META_ACCESS_TOKEN;
  const envAccount = process.env.META_AD_ACCOUNT_ID;
  if (envToken && envAccount) {
    return { accessToken: envToken, adAccountId: envAccount };
  }
  const supabase = createServerClient();
  const { data } = await supabase.from("app_settings").select("key, value").in("key", ["meta_access_token", "meta_ad_account_id"]);
  if (!data || data.length < 2) return null;
  const settings = {};
  for (const row of data) settings[row.key] = row.value;
  if (!settings.meta_access_token || !settings.meta_ad_account_id) return null;
  return { accessToken: settings.meta_access_token, adAccountId: settings.meta_ad_account_id };
}
var PAGES_CACHE_TTL_MS = 5 * 60 * 1e3;

// src/lib/metaBatchCampaignSync.ts
var MAX_CAMPAIGNS_PER_BATCH = 10;
var ERROR_MAX_LEN = 480;
function hasBatchAdvertisingWindowStarted(startsAt) {
  if (startsAt == null || String(startsAt).trim() === "") return true;
  const t = new Date(startsAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}
function getDesiredMetaCampaignStatus(row, capCounts) {
  const ids = normalizeCampaignIds(row.meta_campaign_ids);
  if (ids.length === 0) return "PAUSED";
  if (row.meta_campaign_sync_enabled === false) return "PAUSED";
  if (!isMetaCampaignSyncBatchKind(row.batch_kind)) return "PAUSED";
  if (row.is_paid !== true) return "PAUSED";
  if (row.status !== "active") return "PAUSED";
  if (batchIsAtCapacity({
    delivery_model: row.delivery_model,
    batch_kind: row.batch_kind,
    batch_size: row.batch_size ?? 0,
    leads_delivered: row.leads_delivered
  })) {
    return "PAUSED";
  }
  if (!hasBatchAdvertisingWindowStarted(row.starts_at)) return "PAUSED";
  const lpw = row.leads_per_week != null && Number(row.leads_per_week) > 0 ? Number(row.leads_per_week) : 0;
  const lpd = row.leads_per_day != null && Number(row.leads_per_day) > 0 ? Number(row.leads_per_day) : 0;
  if (lpw > 0 || lpd > 0) {
    if (!capCounts) return "PAUSED";
    if (lpw > 0 && capCounts.weekCount >= lpw) return "PAUSED";
    if (lpd > 0 && capCounts.todayCount >= lpd) return "PAUSED";
  }
  return "ACTIVE";
}
function isBatchEligibleForMetaSync(row) {
  return row.meta_campaign_sync_enabled !== false && isMetaCampaignSyncBatchKind(row.batch_kind) && row.is_paid === true && row.status === "active";
}
function getDesiredMetaCampaignStatusForCampaign(row, campaignId, capCounts) {
  const paused = normalizeCampaignIds(row.meta_campaign_paused_ids);
  if (paused.includes(campaignId)) return "PAUSED";
  return getDesiredMetaCampaignStatus(row, capCounts);
}
function resolveAggregatedMetaCampaignDesiredStatus(campaignId, activeBatches, capCountsByBatchId = {}) {
  const linked = activeBatches.filter(
    (b) => isBatchEligibleForMetaSync(b) && normalizeCampaignIds(b.meta_campaign_ids).includes(campaignId)
  );
  if (linked.length === 0) return "PAUSED";
  for (const batch of linked) {
    const caps = capCountsByBatchId[batch.id];
    if (getDesiredMetaCampaignStatusForCampaign(batch, campaignId, caps) === "ACTIVE") {
      return "ACTIVE";
    }
  }
  return "PAUSED";
}
async function fetchActiveMetaLinkedBatches(supabase) {
  const { data, error } = await supabase.from("customer_batches").select(
    "id, batch_kind, delivery_model, is_paid, status, batch_size, leads_delivered, starts_at, leads_per_day, leads_per_week, meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled"
  ).eq("status", "active").eq("is_paid", true).not("meta_campaign_ids", "eq", "{}").limit(400);
  if (error || !data) return [];
  return data.filter(
    (b) => isBatchEligibleForMetaSync(b) && normalizeCampaignIds(b.meta_campaign_ids).length > 0
  );
}
async function buildCapCountsMap(supabase, batches) {
  const out = {};
  for (const batch of batches) {
    const lpw = batch.leads_per_week != null && Number(batch.leads_per_week) > 0 ? Number(batch.leads_per_week) : 0;
    const lpd = batch.leads_per_day != null && Number(batch.leads_per_day) > 0 ? Number(batch.leads_per_day) : 0;
    if (lpw > 0 || lpd > 0) {
      out[batch.id] = await fetchBatchAssignmentCapCounts(supabase, batch.id);
    }
  }
  return out;
}
function normalizeCampaignIds(raw) {
  const flat = coerceCustomerBatchMetaCampaignIds(raw);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const s of flat) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_CAMPAIGNS_PER_BATCH) break;
  }
  return out;
}
function normActId(id) {
  const t = id.trim();
  return t.startsWith("act_") ? t : `act_${t}`;
}
async function graphGetCampaign(campaignId, accessToken) {
  const url = `${META_GRAPH_URL}/${campaignId}?fields=id,account_id,name,status&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message || `HTTP ${res.status}`;
    return { ok: false, message: msg };
  }
  const account_id = json.account_id;
  if (!account_id) return { ok: false, message: "Geen account_id op campagne" };
  return {
    ok: true,
    account_id,
    name: json.name,
    status: json.status
  };
}
async function graphPostCampaignStatus(campaignId, status, accessToken) {
  const body = new URLSearchParams({
    status,
    access_token: accessToken
  });
  const res = await fetch(`${META_GRAPH_URL}/${campaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    return { ok: false, message: json.error?.message || `HTTP ${res.status}` };
  }
  if (json.success === false) {
    return { ok: false, message: "Meta weigerde de wijziging (success=false)" };
  }
  return { ok: true };
}
function truncateErr(s) {
  const t = s.trim();
  return t.length <= ERROR_MAX_LEN ? t : `${t.slice(0, ERROR_MAX_LEN)}\u2026`;
}
async function reconcileBatchMetaCampaigns(supabase, batchId, _trigger, options) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const { data: row, error: fetchErr } = await supabase.from("customer_batches").select(
    "id, batch_kind, delivery_model, is_paid, status, batch_size, leads_delivered, starts_at, leads_per_day, leads_per_week, meta_campaign_ids, meta_campaign_paused_ids, meta_campaign_sync_enabled"
  ).eq("id", batchId).single();
  if (fetchErr || !row) return;
  const batch = row;
  const linkedIds = normalizeCampaignIds(batch.meta_campaign_ids);
  const forcePause = normalizeCampaignIds(options?.forcePauseCampaignIds ?? []);
  const orphanPause = forcePause.filter((id) => !linkedIds.includes(id));
  const ids = [.../* @__PURE__ */ new Set([...linkedIds, ...orphanPause])];
  if (ids.length === 0) {
    await supabase.from("customer_batches").update({
      meta_sync_last_attempt_at: nowIso,
      meta_sync_last_error: null
    }).eq("id", batchId);
    return;
  }
  const batchDrivesSync = isBatchEligibleForMetaSync(batch);
  const campaignIdsToSync = ids;
  if (campaignIdsToSync.length === 0) {
    await supabase.from("customer_batches").update({
      meta_sync_last_attempt_at: nowIso,
      meta_sync_last_error: null
    }).eq("id", batchId);
    return;
  }
  const activeBatches = await fetchActiveMetaLinkedBatches(supabase);
  const batchesForCaps = batchDrivesSync && !activeBatches.some((b) => b.id === batchId) ? [...activeBatches, batch] : activeBatches;
  const capCountsByBatchId = await buildCapCountsMap(supabase, batchesForCaps);
  const credentials = await getMetaCredentials();
  if (!credentials?.accessToken || !credentials?.adAccountId) {
    await supabase.from("customer_batches").update({
      meta_sync_last_attempt_at: nowIso,
      meta_sync_last_error: truncateErr("Meta API niet geconfigureerd (token / ad account)")
    }).eq("id", batchId);
    return;
  }
  const expectedAccount = normActId(credentials.adAccountId);
  const errors = [];
  let okCount = 0;
  const activeIds = new Set(
    activeBatches.flatMap((b) => normalizeCampaignIds(b.meta_campaign_ids))
  );
  for (const campaignId of campaignIdsToSync) {
    let desired;
    if (orphanPause.includes(campaignId)) {
      desired = "PAUSED";
    } else if (!batchDrivesSync) {
      desired = activeIds.has(campaignId) ? resolveAggregatedMetaCampaignDesiredStatus(
        campaignId,
        batchesForCaps,
        capCountsByBatchId
      ) : "PAUSED";
    } else {
      desired = resolveAggregatedMetaCampaignDesiredStatus(
        campaignId,
        batchesForCaps,
        capCountsByBatchId
      );
    }
    const info = await graphGetCampaign(campaignId, credentials.accessToken);
    if (!info.ok) {
      errors.push(`${campaignId}: ${info.message}`);
      continue;
    }
    if (normActId(info.account_id) !== expectedAccount) {
      errors.push(`${campaignId}: campagne hoort niet bij ad account ${expectedAccount}`);
      continue;
    }
    const current = (info.status || "").toUpperCase();
    if (current === desired) {
      okCount++;
      continue;
    }
    const post = await graphPostCampaignStatus(campaignId, desired, credentials.accessToken);
    if (!post.ok) {
      errors.push(`${campaignId}: ${post.message}`);
      continue;
    }
    okCount++;
  }
  const payload = {
    meta_sync_last_attempt_at: nowIso
  };
  if (okCount === campaignIdsToSync.length) {
    payload.meta_sync_last_success_at = nowIso;
    payload.meta_sync_last_error = null;
  } else if (okCount > 0) {
    payload.meta_sync_last_success_at = nowIso;
    payload.meta_sync_last_error = truncateErr(errors.join(" | "));
  } else {
    payload.meta_sync_last_error = truncateErr(errors.join(" | ") || "Meta sync mislukt");
  }
  await supabase.from("customer_batches").update(payload).eq("id", batchId);
}

// src/lib/batchDelivered.ts
var PAGE = 1e3;
var MAX_PAGES = 50;
async function countDistinctLeadsForBatch(supabase, batchId) {
  const { data, error } = await supabase.rpc("count_distinct_leads_for_batch", {
    p_batch_id: batchId
  });
  if (!error && typeof data === "number") return data;
  const ids = /* @__PURE__ */ new Set();
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data: rows, error: pageError } = await supabase.from("lead_assignments").select("lead_id").eq("batch_id", batchId).range(from, from + PAGE - 1);
    if (pageError) {
      console.error("[batchDelivered] fallback-telling mislukt:", pageError.message);
      break;
    }
    if (!rows?.length) break;
    for (const row of rows) if (row.lead_id) ids.add(row.lead_id);
    if (rows.length < PAGE) break;
  }
  return ids.size;
}

// src/lib/batchSync.ts
async function syncBatchDelivered(supabase, batchId) {
  const assignmentCount = await countDistinctLeadsForBatch(supabase, batchId);
  const { data: batch } = await supabase.from("customer_batches").select("batch_size, status, leads_delivered_external, batch_kind, delivery_model, is_paid").eq("id", batchId).single();
  if (!batch) return assignmentCount;
  const external = batch.leads_delivered_external || 0;
  const delivered = assignmentCount + external;
  const updates = { leads_delivered: delivered };
  const capped = isCappedDeliveryModel(
    batch.delivery_model,
    batch.batch_kind
  );
  if (capped && delivered >= batch.batch_size && (batch.status === "active" || batch.status === "paused")) {
    updates.status = "completed";
    updates.completed_at = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const { data: batchFull } = await supabase.from("customer_batches").select("branch, customer_id, batch_size, customers(name)").eq("id", batchId).single();
      if (batchFull) {
        const custName = batchFull.customers?.name || "Onbekend";
        await supabase.from("celebration_events").insert({
          event_type: "batch_complete",
          payload: {
            customer: custName,
            branch: batchFull.branch,
            batchSize: batchFull.batch_size,
            batchId
          }
        });
      }
    } catch {
    }
  } else if (capped && delivered < batch.batch_size && batch.status === "completed") {
    updates.status = batch.is_paid ? "active" : "pending_payment";
    updates.completed_at = null;
  }
  await supabase.from("customer_batches").update(updates).eq("id", batchId);
  reconcileBatchMetaCampaigns(supabase, batchId, "batch_sync").catch(() => {
  });
  if (isPipelineBatchKind(batch.batch_kind)) {
    checkBatchMilestones(supabase, batchId, delivered, batch.batch_size).catch(() => {
    });
  }
  return delivered;
}

// src/lib/googleSheets/types.ts
var GOOGLE_SHEETS_PROVIDER = "google_sheets";

// src/lib/teamleader/types.ts
var TEAMLEADER_PROVIDER = "teamleader";

// src/lib/integrations/crmPreferences.ts
var CRM_PREFERENCE_PROVIDER = "crm_preference";
async function getPreferredCrmProvider(supabase, customerId) {
  const { data, error } = await supabase.from("customer_integrations").select("settings").eq("customer_id", customerId).eq("provider", CRM_PREFERENCE_PROVIDER).maybeSingle();
  if (error || !data?.settings) return null;
  const settings = data.settings;
  const v = settings.preferred_crm_provider;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function resolveEffectiveCrmProvider(stored, teamleaderConnected, sheetsConnected) {
  if (stored) return stored;
  if (teamleaderConnected) return TEAMLEADER_PROVIDER;
  if (sheetsConnected) return GOOGLE_SHEETS_PROVIDER;
  return null;
}

// src/lib/integrations/tokenEncrypt.ts
var import_crypto = require("crypto");

// src/lib/sessionSecrets.ts
var DEV_FALLBACK = "dev-only-insecure-session-secret-min-32-chars!!";
var warnedShortSecret = false;
function getCandidate() {
  const app = process.env.APP_SESSION_SECRET?.trim();
  if (app) return app;
  const admin = process.env.ADMIN_SESSION_SECRET?.trim();
  if (admin) return admin;
  return null;
}
function getRawSessionSecret() {
  const candidate = getCandidate();
  if (candidate) {
    if (process.env.NODE_ENV === "production" && candidate.length < 32 && !warnedShortSecret) {
      console.warn(
        "[sessionSecrets] Sessie-secret is korter dan 32 tekens. Zet een langere APP_SESSION_SECRET voor sterke HMAC-sleutels."
      );
      warnedShortSecret = true;
    }
    return candidate;
  }
  if (process.env.NODE_ENV !== "production") {
    return DEV_FALLBACK;
  }
  throw new Error(
    "Geen sessie-secret gevonden in productie. Zet APP_SESSION_SECRET (min. 32 tekens). CRON_SECRET wordt bewust niet meer gebruikt voor sessie-ondertekening."
  );
}

// src/lib/teamleader/credentials.ts
function stripEnvValue(value) {
  if (value == null) return "";
  return String(value).replace(/[\r\n\u2028\u2029]+/g, "").trim();
}
function getCallbackRedirectUri() {
  const base = stripEnvValue(process.env.NEXT_PUBLIC_APP_URL) || stripEnvValue(process.env.NEXT_PUBLIC_SITE_URL) || "https://warmeleads.eu";
  return `${base.replace(/\/$/, "")}/api/portal/integrations/teamleader/callback`;
}
function fromEnv() {
  const clientId = stripEnvValue(process.env.TEAMLEADER_CLIENT_ID);
  const clientSecret = stripEnvValue(process.env.TEAMLEADER_CLIENT_SECRET);
  const redirectUri = stripEnvValue(process.env.TEAMLEADER_REDIRECT_URI) || getCallbackRedirectUri();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}
var SETTINGS_KEYS = [
  "teamleader_client_id",
  "teamleader_client_secret",
  "teamleader_redirect_uri"
];
async function fromAppSettings(supabase) {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", [...SETTINGS_KEYS]);
  if (!data?.length) return null;
  const map = {};
  for (const row of data) map[row.key] = stripEnvValue(row.value);
  const clientId = map.teamleader_client_id;
  const clientSecret = map.teamleader_client_secret;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: map.teamleader_redirect_uri || getCallbackRedirectUri()
  };
}
async function getGlobalOAuthConfig() {
  const env = fromEnv();
  if (env) return { ...env, source: "global" };
  const supabase = createServerClient();
  const settings = await fromAppSettings(supabase);
  if (settings) return { ...settings, source: "global" };
  return null;
}
async function getCustomerOAuthConfig(supabase, customerId) {
  const { data } = await supabase.from("customer_integrations").select("client_id_enc, client_secret_enc").eq("customer_id", customerId).eq("provider", TEAMLEADER_PROVIDER).maybeSingle();
  if (!data?.client_id_enc || !data?.client_secret_enc) return null;
  try {
    return {
      clientId: decryptSecret(data.client_id_enc),
      clientSecret: decryptSecret(data.client_secret_enc),
      redirectUri: getCallbackRedirectUri(),
      source: "customer"
    };
  } catch {
    return null;
  }
}
async function getEffectiveOAuthConfig(supabase, customerId) {
  const customer = await getCustomerOAuthConfig(supabase, customerId);
  if (customer) return customer;
  return getGlobalOAuthConfig();
}

// src/lib/integrations/tokenEncrypt.ts
var ALGO = "aes-256-gcm";
var IV_LEN = 12;
var TAG_LEN = 16;
var SALT = "warmeleads-integration-v1";
function encryptionKey() {
  const raw = stripEnvValue(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY) || getRawSessionSecret();
  return (0, import_crypto.scryptSync)(raw, SALT, 32);
}
function encryptSecret(plain) {
  const key = encryptionKey();
  const iv = (0, import_crypto.randomBytes)(IV_LEN);
  const cipher = (0, import_crypto.createCipheriv)(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
function decryptSecret(encoded) {
  const key = encryptionKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = (0, import_crypto.createDecipheriv)(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// src/lib/googleSheets/config.ts
var GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
var GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4";
var GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
var DEFAULT_GOOGLE_SERVICE_ACCOUNT_EMAIL = "warmeleads-sheets@light-footing-452919-u7.iam.gserviceaccount.com";
function getGoogleServiceAccountEmail() {
  return stripEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) || DEFAULT_GOOGLE_SERVICE_ACCOUNT_EMAIL;
}
function getGoogleSheetsCallbackUri() {
  const base = stripEnvValue(process.env.NEXT_PUBLIC_APP_URL) || "https://warmeleads.eu";
  return `${base.replace(/\/$/, "")}/api/portal/integrations/google-sheets/callback`;
}
function getGoogleSheetsApiKey() {
  return stripEnvValue(process.env.GOOGLE_SHEETS_API_KEY);
}
function isGoogleSheetsApiKeyConfigured() {
  return getGoogleSheetsApiKey().length > 0;
}
function appendGoogleSheetsApiKey(path) {
  const key = getGoogleSheetsApiKey();
  if (!key) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}key=${encodeURIComponent(key)}`;
}
function getGoogleOAuthConfig() {
  const clientId = stripEnvValue(process.env.GOOGLE_INTEGRATION_CLIENT_ID);
  const clientSecret = stripEnvValue(process.env.GOOGLE_INTEGRATION_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: getGoogleSheetsCallbackUri()
  };
}
function getGoogleServiceAccountPrivateKeyConfigured() {
  return Boolean(stripEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY));
}
function isGoogleSheetsIntegrationServerReady() {
  return isGoogleSheetsApiKeyConfigured() && getGoogleServiceAccountPrivateKeyConfigured();
}
function assertGoogleSheetsServerReady() {
  if (!isGoogleSheetsIntegrationServerReady()) {
    throw new Error(
      "Google Spreadsheets is niet beschikbaar op de server. Neem contact op met Warme Leads."
    );
  }
}

// src/lib/integrations/oauthState.ts
var STATE_TTL_MS = 10 * 60 * 1e3;

// src/lib/googleSheets/oauth.ts
async function tokenRequest(config, body) {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body)
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Google token exchange mislukt (${res.status})`
    );
  }
  const expiresIn = json.expires_in ?? 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? body.refresh_token ?? "",
    expiresAt: new Date(Date.now() + expiresIn * 1e3 - 6e4)
  };
}
function refreshGoogleAccessToken(config, refreshToken) {
  return tokenRequest(config, {
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken
  });
}

// src/lib/googleSheets/integrationRepo.ts
function rowToStored(row) {
  if (!row.access_token_enc || !row.refresh_token_enc || !row.expires_at) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    access_token: decryptSecret(row.access_token_enc),
    refresh_token: decryptSecret(row.refresh_token_enc),
    expires_at: new Date(row.expires_at),
    settings: row.settings ?? { enabled: true },
    connected_at: row.connected_at
  };
}
async function getGoogleSheetsIntegration(supabase, customerId) {
  const { data } = await supabase.from("customer_integrations").select("id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at").eq("customer_id", customerId).eq("provider", GOOGLE_SHEETS_PROVIDER).maybeSingle();
  if (!data) return null;
  return rowToStored(data);
}
async function getGoogleSheetsIntegrationRow(supabase, customerId) {
  const { data } = await supabase.from("customer_integrations").select("id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at").eq("customer_id", customerId).eq("provider", GOOGLE_SHEETS_PROVIDER).maybeSingle();
  return data ?? null;
}
function inferConnectionMode(row) {
  if (row.settings?.connection_mode) return row.settings.connection_mode;
  if (row.access_token_enc && row.refresh_token_enc) return "oauth";
  if (row.connected_at) return "service_account";
  return null;
}
function rowToGoogleSheetsIntegrationPublic(row) {
  return {
    id: row.id,
    customer_id: row.customer_id,
    settings: row.settings ?? { enabled: true },
    connected_at: row.connected_at,
    connection_mode: inferConnectionMode(row)
  };
}
async function getGoogleSheetsIntegrationPublic(supabase, customerId) {
  const row = await getGoogleSheetsIntegrationRow(supabase, customerId);
  if (!row) return null;
  return rowToGoogleSheetsIntegrationPublic(row);
}
async function ensureGoogleSheetsIntegrationRow(supabase, customerId) {
  const existing = await getGoogleSheetsIntegrationRow(supabase, customerId);
  if (existing) return existing;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const settings = {
    enabled: true,
    connection_mode: "service_account"
  };
  const { error } = await supabase.from("customer_integrations").insert({
    customer_id: customerId,
    provider: GOOGLE_SHEETS_PROVIDER,
    settings,
    connected_at: null,
    updated_at: now
  });
  if (error) throw new Error(error.message);
  const row = await getGoogleSheetsIntegrationRow(supabase, customerId);
  if (!row) throw new Error("Google Sheets-koppeling aanmaken mislukt");
  return row;
}
async function updateGoogleSheetsTokens(supabase, customerId, tokens) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { error } = await supabase.from("customer_integrations").update({
    access_token_enc: encryptSecret(tokens.accessToken),
    refresh_token_enc: encryptSecret(tokens.refreshToken),
    expires_at: tokens.expiresAt.toISOString(),
    updated_at: now
  }).eq("customer_id", customerId).eq("provider", GOOGLE_SHEETS_PROVIDER);
  if (error) throw new Error(error.message);
}
async function updateGoogleSheetsSettings(supabase, customerId, patch) {
  const row = await ensureGoogleSheetsIntegrationRow(supabase, customerId);
  const settings = { ...row.settings ?? {}, ...patch };
  const { error } = await supabase.from("customer_integrations").update({ settings, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("customer_id", customerId).eq("provider", GOOGLE_SHEETS_PROVIDER);
  if (error) throw new Error(error.message);
  return settings;
}
async function ensureValidGoogleAccessToken(supabase, integration) {
  const bufferMs = 2 * 60 * 1e3;
  if (integration.expires_at.getTime() > Date.now() + bufferMs) {
    return integration.access_token;
  }
  const config = getGoogleOAuthConfig();
  if (!config) {
    throw new Error("Google OAuth is niet geconfigureerd op de server.");
  }
  const refreshed = await refreshGoogleAccessToken(config, integration.refresh_token);
  await updateGoogleSheetsTokens(supabase, integration.customer_id, refreshed);
  return refreshed.accessToken;
}

// src/lib/teamleader/standardFields.ts
var PORTAL_STANDARD_FIELDS = [
  { key: "naam_klant", label: "Naam klant", native: "name" },
  { key: "email", label: "E-mail", native: "email" },
  { key: "telefoonnummer", label: "Telefoon", native: "phone" },
  { key: "postcode", label: "Postcode", native: "address" },
  { key: "huisnummer", label: "Huisnummer", native: "address" },
  { key: "plaatsnaam", label: "Plaats", native: "address" },
  { key: "provincie", label: "Provincie", native: "none" },
  { key: "wervingsdatum", label: "Wervingsdatum", native: "none" },
  /* De datum waarop déze klant de lead kreeg, niet wanneer de consument zich
     meldde. Het portaal toont deze datum al (received_at); in een gekoppelde
     spreadsheet stond tot nu toe alleen de wervingsdatum, waardoor de twee
     verschillende dingen zeiden. */
  { key: "geleverd_op", label: "Geleverd op", native: "none" },
  { key: "notities", label: "Notities", native: "none" },
  { key: "land", label: "Land", native: "none" }
];
var FIELD_MAP_SKIP = "_skip";
var FIELD_MAP_NATIVE = "_native";
var FIELD_MAP_SUMMARY = "_summary";

// src/lib/teamleader/fieldMappingLogic.ts
function normalizeLabel(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function getPortalFieldsForBranch(branchFields) {
  const standard = PORTAL_STANDARD_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    group: "standard"
  }));
  const branch = branchFields.map((f) => ({
    key: f.key,
    label: f.label,
    group: "branch"
  }));
  return [...standard, ...branch];
}
function suggestFieldMapping(portalFields, tlContactFields, tlDealFields) {
  const contact = {};
  const deal = {};
  const usedContact = /* @__PURE__ */ new Set();
  const usedDeal = /* @__PURE__ */ new Set();
  for (const pf of portalFields) {
    const norm = normalizeLabel(pf.label);
    const normKey = normalizeLabel(pf.key);
    const contactMatch = findBestTlMatch(pf, norm, normKey, tlContactFields, usedContact);
    if (contactMatch) {
      contact[pf.key] = contactMatch;
      usedContact.add(contactMatch);
      continue;
    }
    const dealMatch = findBestTlMatch(pf, norm, normKey, tlDealFields, usedDeal);
    if (dealMatch) {
      deal[pf.key] = dealMatch;
      usedDeal.add(dealMatch);
    } else if (pf.group === "branch") {
      deal[pf.key] = FIELD_MAP_SUMMARY;
    }
  }
  return { contact, deal };
}
function suggestDefaultFieldMapping(portalFields) {
  const contact = {};
  const deal = {};
  const nativeKeys = new Set(
    PORTAL_STANDARD_FIELDS.filter((f) => f.native !== "none").map((f) => f.key)
  );
  for (const pf of portalFields) {
    if (nativeKeys.has(pf.key)) {
      contact[pf.key] = FIELD_MAP_NATIVE;
    } else {
      deal[pf.key] = FIELD_MAP_SUMMARY;
    }
  }
  return { contact, deal };
}
function findBestTlMatch(pf, normLabel, normKey, tlFields, used) {
  const aliases = getAliases(pf.key);
  let best = null;
  for (const tf of tlFields) {
    if (used.has(tf.id)) continue;
    const tlNorm = normalizeLabel(tf.label);
    let score = 0;
    if (tlNorm === normLabel || tlNorm === normKey) score = 100;
    else if (tlNorm.includes(normLabel) || normLabel.includes(tlNorm)) score = 70;
    else if (aliases.some((a) => tlNorm === a || tlNorm.includes(a))) score = 85;
    if (score > 0 && (!best || score > best.score)) best = { id: tf.id, score };
  }
  return best && best.score >= 65 ? best.id : null;
}
var FIELD_ALIASES = {
  naam_klant: ["naam", "name", "klant", "contact", "volledigenaam"],
  email: ["email", "mail", "emailadres"],
  telefoonnummer: ["telefoon", "phone", "gsm", "mobiel", "tel"],
  postcode: ["postcode", "zip", "postal"],
  huisnummer: ["huisnummer", "huisnr", "number"],
  plaatsnaam: ["plaats", "stad", "city", "woonplaats"],
  provincie: ["provincie", "province", "regio"],
  wervingsdatum: ["datum", "date", "aanvraag"],
  geleverd_op: ["geleverd", "geleverdop", "leverdatum", "ontvangen", "datumgeleverd"],
  notities: ["notities", "opmerking", "notes", "remarks"]
};
function getAliases(key) {
  return (FIELD_ALIASES[key] || []).map(normalizeLabel);
}
function getLeadFieldValue(lead, key) {
  const standard = lead[key];
  if (standard != null && String(standard).trim()) return String(standard).trim();
  const cf = lead.custom_fields;
  if (cf && typeof cf === "object") {
    const v = cf[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}
function formatValueForTeamleader(raw, def) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!def) return trimmed;
  switch (def.type) {
    case "boolean": {
      const lower = trimmed.toLowerCase();
      if (["ja", "yes", "true", "1", "j"].includes(lower)) return true;
      if (["nee", "no", "false", "0", "n"].includes(lower)) return false;
      return true;
    }
    case "integer":
    case "number": {
      const n = Number(trimmed.replace(",", "."));
      return Number.isFinite(n) ? n : trimmed;
    }
    case "money": {
      const n = Number(trimmed.replace(/[^\d.,-]/g, "").replace(",", "."));
      return Number.isFinite(n) ? n : trimmed;
    }
    case "date": {
      const d = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      if (d) return d[1];
      const nl = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (nl) {
        const [, dd, mm, yyyy] = nl;
        return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
      }
      return trimmed;
    }
    case "single_select": {
      if (!def.options?.length) return trimmed;
      const norm = normalizeLabel(trimmed);
      const opt = def.options.find((o) => normalizeLabel(o.value) === norm) || def.options.find((o) => normalizeLabel(o.id) === norm);
      return opt?.id ?? trimmed;
    }
    case "multi_select": {
      if (!def.options?.length) return [trimmed];
      const parts = trimmed.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      const ids = parts.map((p) => {
        const norm = normalizeLabel(p);
        return def.options.find((o) => normalizeLabel(o.value) === norm)?.id;
      }).filter(Boolean);
      return ids.length > 0 ? ids : [trimmed];
    }
    default:
      return trimmed;
  }
}
function buildMappedCustomFields(lead, mapping, tlDefs, context) {
  const defById = new Map(tlDefs.map((d) => [d.id, d]));
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [portalKey, tlFieldId] of Object.entries(mapping)) {
    if (!tlFieldId || tlFieldId === FIELD_MAP_SKIP || tlFieldId === FIELD_MAP_SUMMARY || tlFieldId === FIELD_MAP_NATIVE) {
      continue;
    }
    const value = getLeadFieldValue(lead, portalKey);
    if (!value) continue;
    const def = defById.get(tlFieldId);
    if (def && def.context !== context) continue;
    const formatted = formatValueForTeamleader(value, def);
    if (formatted == null) continue;
    if (seen.has(tlFieldId)) continue;
    seen.add(tlFieldId);
    out.push({ id: tlFieldId, value: formatted });
  }
  return out;
}
function collectSummaryExtras(lead, portalFields, mapping) {
  const extras = {};
  const mappedKeys = /* @__PURE__ */ new Set([
    ...Object.keys(mapping.contact),
    ...Object.keys(mapping.deal)
  ]);
  for (const pf of portalFields) {
    const contactTarget = mapping.contact[pf.key];
    const dealTarget = mapping.deal[pf.key];
    const mappedToTl = contactTarget && contactTarget !== FIELD_MAP_SKIP && contactTarget !== FIELD_MAP_SUMMARY || dealTarget && dealTarget !== FIELD_MAP_SKIP && dealTarget !== FIELD_MAP_SUMMARY;
    if (mappedToTl) continue;
    const explicitSummary = contactTarget === FIELD_MAP_SUMMARY || dealTarget === FIELD_MAP_SUMMARY;
    const isBranch = pf.group === "branch";
    if (!explicitSummary && !isBranch) continue;
    const val = getLeadFieldValue(lead, pf.key);
    if (val) extras[pf.label] = val;
  }
  return extras;
}
function mergeMappings(saved, branchSlug) {
  return saved?.[branchSlug] ?? { contact: {}, deal: {} };
}

// src/lib/googleSheets/httpRetry.ts
var RETRYABLE_STATUS = /* @__PURE__ */ new Set([408, 429, 500, 502, 503, 504]);
var RETRYABLE_MESSAGES = [
  /service is currently unavailable/i,
  /backend error/i,
  /internal error/i,
  /rate limit/i,
  /quota exceeded/i,
  /try again/i
];
function isRetryableGoogleSheetsError(status, message) {
  if (RETRYABLE_STATUS.has(status)) return true;
  return RETRYABLE_MESSAGES.some((re) => re.test(message));
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchGoogleSheetsWithRetry(url, init, options) {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 800;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const clone = res.clone();
      let message = `HTTP ${res.status}`;
      try {
        const json = await clone.json();
        message = json.error?.message || message;
      } catch {
      }
      if (attempt < maxAttempts && isRetryableGoogleSheetsError(res.status, message)) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
        continue;
      }
      lastError = new Error(message);
      throw lastError;
    } catch (err) {
      if (err instanceof Error && err.message && attempt < maxAttempts) {
        if (isRetryableGoogleSheetsError(0, err.message)) {
          lastError = err;
          await sleep(baseDelayMs * 2 ** (attempt - 1));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError ?? new Error("Google Sheets request mislukt");
}

// src/lib/googleSheets/headerRow.ts
var HEADER_SCAN_ROWS = 10;
var HEADER_SCAN_COLS = 702;
function scoreHeaderRow(cells) {
  const nonEmpty = cells.filter((c) => c.trim()).length;
  if (nonEmpty === 0) return 0;
  let headerLike = 0;
  for (const raw of cells) {
    const t = raw.trim();
    if (!t) continue;
    const lower = t.toLowerCase();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(t)) continue;
    if (t.includes("@")) continue;
    if (/^\+?\d[\d\s\-().]{7,}$/.test(t)) continue;
    if (/^\d{4,}$/.test(t.replace(/\s/g, ""))) continue;
    if (lower.includes("naam") || lower.includes("email") || lower.includes("e-mail")) {
      headerLike += 3;
      continue;
    }
    if (lower.includes("postcode") || lower.includes("telefoon") || lower.includes("datum")) {
      headerLike += 2;
      continue;
    }
    if (t.length <= 40 && /[a-zA-Z]/.test(t)) headerLike += 1;
  }
  return headerLike * 10 + nonEmpty;
}
function extractHeaderColumnsFromCells(cells, startColumn = 0) {
  let lastNonEmpty = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]?.trim()) lastNonEmpty = i;
  }
  if (lastNonEmpty < 0) return [];
  const columns = [];
  for (let i = 0; i <= lastNonEmpty; i++) {
    const index = startColumn + i;
    const label = (cells[i] || "").trim();
    columns.push({
      index,
      letter: columnIndexToLetter(index),
      label: label || `Kolom ${columnIndexToLetter(index)}`
    });
  }
  return columns;
}
function pickBestHeaderRow(rowTexts, preferredRow) {
  let bestRow = 1;
  let bestScore = 0;
  for (let i = 0; i < rowTexts.length; i++) {
    const score = scoreHeaderRow(rowTexts[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestRow = i + 1;
    }
  }
  if (preferredRow != null && preferredRow >= 1 && preferredRow <= rowTexts.length) {
    const preferredScore = scoreHeaderRow(rowTexts[preferredRow - 1] || []);
    if (preferredScore >= bestScore * 0.85 && preferredScore > 0) {
      return preferredRow;
    }
  }
  return bestRow;
}

// src/lib/googleSheets/spreadsheet.ts
function columnIndexToLetter(index) {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(n % 26 + 65) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
function columnLetterToIndex(letter) {
  const upper = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) return -1;
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}
function sheetColumnCount(columns) {
  if (columns.length === 0) return 0;
  return Math.max(...columns.map((c) => c.index)) + 1;
}
function pickDefaultSheetTab(tabs, preferredGid) {
  if (tabs.length === 0) return null;
  if (preferredGid != null) {
    const match = tabs.find((t) => t.sheetId === preferredGid);
    if (match) return match;
  }
  return tabs[tabs.length - 1];
}
async function sheetsFetch(accessToken, path, init) {
  const apiPath = appendGoogleSheetsApiKey(path);
  const res = await fetchGoogleSheetsWithRetry(`${GOOGLE_SHEETS_API_BASE}${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json.error?.message;
    throw new Error(msg || `Google Sheets API fout (${res.status})`);
  }
  return json;
}
async function fetchSpreadsheetTabs(accessToken, spreadsheetId) {
  const data = await sheetsFetch(accessToken, `/spreadsheets/${spreadsheetId}?fields=sheets.properties`);
  return (data.sheets || []).map((s) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title ?? "Blad"
  })).filter((t) => t.sheetId != null);
}
async function scanSheetHeaders(accessToken, spreadsheetId, sheetName, options) {
  const range = encodeURIComponent(`${sheetName}!A1:${columnIndexToLetter(HEADER_SCAN_COLS - 1)}${HEADER_SCAN_ROWS}`);
  const data = await sheetsFetch(
    accessToken,
    `/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=${range}&fields=sheets.data(startColumn,startRow,rowData.values(formattedValue))`
  );
  const grid = data.sheets?.[0]?.data?.[0];
  const startColumn = grid?.startColumn ?? 0;
  const startRow = grid?.startRow ?? 0;
  const rowData = grid?.rowData ?? [];
  const rowTexts = rowData.map(
    (row) => (row.values ?? []).map((cell) => (cell?.formattedValue ?? "").trim())
  );
  while (rowTexts.length < HEADER_SCAN_ROWS) {
    rowTexts.push([]);
  }
  const headerRow = pickBestHeaderRow(rowTexts, options?.headerRow);
  const headerIdx = headerRow - 1 - startRow;
  const headerCells = headerIdx >= 0 && headerIdx < rowTexts.length ? rowTexts[headerIdx] : [];
  const columns = extractHeaderColumnsFromCells(headerCells, startColumn);
  return { headerRow, columns };
}
async function appendRowToSheet(accessToken, spreadsheetId, sheetName, values) {
  const lastIndex = values.length - 1;
  const endCol = columnIndexToLetter(Math.max(lastIndex, 0));
  const range = encodeURIComponent(`${sheetName}!A:${endCol}`);
  const data = await sheetsFetch(accessToken, `/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [values] })
  });
  return data.updates?.updatedRange ?? "ok";
}
function quoteSheetName(name) {
  if (/^[A-Za-z0-9_]+$/.test(name)) return name;
  return `'${name.replace(/'/g, "''")}'`;
}

// src/lib/googleSheets/fieldMappingLogic.ts
function mergeSheetMappings(saved, branchSlug) {
  return saved?.[branchSlug] ?? {};
}
function sheetMappingIsEmpty(mapping) {
  return Object.keys(mapping).length === 0;
}
function hasSavedSheetMappings(saved, branchSlugs) {
  if (!saved || branchSlugs.length === 0) return false;
  return branchSlugs.some((slug) => !sheetMappingIsEmpty(mergeSheetMappings(saved, slug)));
}
var FIELD_ALIASES2 = {
  naam_klant: ["naam", "name", "klant", "contact", "volledigenaam"],
  email: ["email", "mail", "emailadres"],
  telefoonnummer: ["telefoon", "phone", "gsm", "mobiel", "tel"],
  postcode: ["postcode", "zip", "postal"],
  huisnummer: ["huisnummer", "huisnr", "number"],
  plaatsnaam: ["plaats", "stad", "city", "woonplaats"],
  provincie: ["provincie", "province", "regio"],
  wervingsdatum: ["datum", "date", "aanvraag", "werving"],
  geleverd_op: ["geleverd", "geleverdop", "leverdatum", "ontvangen", "datumgeleverd"],
  notities: ["notities", "opmerking", "notes", "remarks"]
};
function getAliases2(key) {
  return (FIELD_ALIASES2[key] || []).map(normalizeLabel);
}
function suggestSheetColumnMapping(portalFields, sheetColumns) {
  const mapping = {};
  const used = /* @__PURE__ */ new Set();
  for (const pf of portalFields) {
    const normLabel = normalizeLabel(pf.label);
    const normKey = normalizeLabel(pf.key);
    const aliases = getAliases2(pf.key);
    let best = null;
    for (const col of sheetColumns) {
      if (used.has(col.index)) continue;
      const colNorm = normalizeLabel(col.label);
      let score = 0;
      if (colNorm === normLabel || colNorm === normKey) score = 100;
      else if (colNorm.includes(normLabel) || normLabel.includes(colNorm)) score = 70;
      else if (aliases.some((a) => colNorm === a || colNorm.includes(a))) score = 85;
      if (score > 0 && (!best || score > best.score)) best = { index: col.index, score };
    }
    if (best && best.score >= 65) {
      mapping[pf.key] = String(best.index);
      used.add(best.index);
    }
  }
  return mapping;
}
function resolveSheetColumnIndex(colRef) {
  const trimmed = colRef.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (/^[A-Za-z]+$/.test(trimmed)) {
    const idx = columnLetterToIndex(trimmed);
    return idx >= 0 ? idx : null;
  }
  return null;
}
function remapLegacyColumnIndices(mapping, columns) {
  if (columns.length === 0) return mapping;
  const startCol = columns[0]?.index ?? 0;
  if (startCol === 0) return mapping;
  const indices = Object.values(mapping).map((ref) => resolveSheetColumnIndex(ref)).filter((idx) => idx != null);
  if (indices.length === 0) return mapping;
  const minMapped = Math.min(...indices);
  const maxMapped = Math.max(...indices);
  if (minMapped >= startCol) return mapping;
  if (maxMapped < columns.length) {
    const remapped = {};
    for (const [key, ref] of Object.entries(mapping)) {
      const idx = resolveSheetColumnIndex(ref);
      if (idx != null && idx >= 0 && idx < columns.length) {
        remapped[key] = String(columns[idx].index);
      } else if (ref) {
        remapped[key] = ref;
      }
    }
    return remapped;
  }
  return mapping;
}
function buildSheetRowValues(lead, mapping, columnCount) {
  let maxMappedIndex = -1;
  for (const colRef of Object.values(mapping)) {
    const idx = resolveSheetColumnIndex(colRef);
    if (idx != null && idx > maxMappedIndex) maxMappedIndex = idx;
  }
  const width = Math.max(columnCount, maxMappedIndex + 1, 1);
  const row = Array.from({ length: width }, () => "");
  for (const [portalKey, colRef] of Object.entries(mapping)) {
    const colIndex = resolveSheetColumnIndex(colRef);
    if (colIndex == null || colIndex < 0 || colIndex >= width) continue;
    const value = getLeadFieldValue(lead, portalKey);
    if (!value) continue;
    row[colIndex] = value;
  }
  return row;
}

// src/lib/teamleader/config.ts
var TEAMLEADER_API_BASE = "https://api.focus.teamleader.eu";
var TEAMLEADER_AUTH_BASE = "https://focus.teamleader.eu";
var DEFAULT_DEAL_TITLE_TEMPLATE = "Warme Leads \u2014 {branch_name} \u2014 {naam_klant}";
var WARME_LEADS_CONTACT_TAG = "Warme Leads";

// src/lib/teamleader/oauth.ts
var STATE_TTL_MS2 = 10 * 60 * 1e3;
async function tokenRequest2(body) {
  const res = await fetch(`${TEAMLEADER_AUTH_BASE}/oauth2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body)
  });
  const json = await res.json();
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new Error(
      json.error_description || json.error || `Token exchange faalde (${res.status})`
    );
  }
  const expiresIn = json.expires_in ?? 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + expiresIn * 1e3 - 6e4)
  };
}
function refreshAccessToken(config, refreshToken) {
  return tokenRequest2({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken
  });
}

// src/lib/teamleader/client.ts
var TeamleaderApiError = class extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
    this.name = "TeamleaderApiError";
  }
};
function formatTeamleaderError(err) {
  const base = err.detail || err.title || "Teamleader API error";
  const field = err.meta?.field;
  return field ? `${base} (${field})` : base;
}
function parseTeamleaderResponseText(text, httpStatus) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new TeamleaderApiError("Ongeldig antwoord van Teamleader", httpStatus);
  }
}
async function teamleaderRequest(accessToken, endpoint, body) {
  const res = await fetch(`${TEAMLEADER_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") || "60");
    throw new TeamleaderApiError("Teamleader rate limit", 429, retryAfter);
  }
  const text = await res.text();
  const json = parseTeamleaderResponseText(text, res.status);
  if (!res.ok) {
    const err = json?.errors?.[0];
    throw new TeamleaderApiError(
      err ? formatTeamleaderError(err) : `Teamleader API ${res.status}`,
      res.status
    );
  }
  if (json?.errors?.length) {
    const err = json.errors[0];
    throw new TeamleaderApiError(formatTeamleaderError(err), res.status);
  }
  if (!json) {
    return void 0;
  }
  return json.data;
}

// src/lib/teamleader/deals.ts
async function getFirstPhaseId(accessToken, pipelineId) {
  const data = await teamleaderRequest(
    accessToken,
    "dealPhases.list",
    {
      filter: { deal_pipeline_id: pipelineId },
      page: { size: 50, number: 1 }
    }
  );
  const phases = Array.isArray(data) ? data : [];
  if (phases.length === 0) return null;
  const sorted = [...phases].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted[0]?.id ?? null;
}
async function createDeal(accessToken, args) {
  const body = {
    title: args.title,
    summary: args.summary,
    phase_id: args.phaseId,
    lead: {
      customer: {
        type: "contact",
        id: args.contactId
      }
    }
  };
  if (args.customFields?.length) {
    body.custom_fields = args.customFields;
  }
  const created = await teamleaderRequest(accessToken, "deals.create", body);
  if (!created?.id) throw new Error("deals.create returned no id");
  return created.id;
}

// src/lib/teamleader/integrationRepo.ts
function rowToStored2(row) {
  if (!row.access_token_enc || !row.refresh_token_enc || !row.expires_at) return null;
  try {
    return {
      id: row.id,
      customer_id: row.customer_id,
      access_token: decryptSecret(row.access_token_enc),
      refresh_token: decryptSecret(row.refresh_token_enc),
      expires_at: new Date(row.expires_at),
      settings: row.settings ?? { enabled: true },
      connected_at: row.connected_at
    };
  } catch (err) {
    console.error("[teamleader] token decrypt failed", {
      customerId: row.customer_id,
      message: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}
async function getTeamleaderIntegration(supabase, customerId) {
  const row = await getRawIntegrationRow(supabase, customerId);
  if (!row) return null;
  return rowToStored2(row);
}
async function updateTeamleaderTokens(supabase, customerId, tokens) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const { error } = await supabase.from("customer_integrations").update({
    access_token_enc: encryptSecret(tokens.accessToken),
    refresh_token_enc: encryptSecret(tokens.refreshToken),
    expires_at: tokens.expiresAt.toISOString(),
    updated_at: now
  }).eq("customer_id", customerId).eq("provider", TEAMLEADER_PROVIDER);
  if (error) throw new Error(error.message);
}
async function getRawIntegrationRow(supabase, customerId) {
  const { data } = await supabase.from("customer_integrations").select(
    "id, customer_id, access_token_enc, refresh_token_enc, expires_at, settings, connected_at, client_id_enc"
  ).eq("customer_id", customerId).eq("provider", TEAMLEADER_PROVIDER).maybeSingle();
  return data ?? null;
}
async function updateTeamleaderSettings(supabase, customerId, patch) {
  const existing = await getTeamleaderIntegration(supabase, customerId);
  if (!existing) throw new Error("Geen Teamleader-koppeling");
  const settings = { ...existing.settings, ...patch };
  if (patch.pipeline_id && patch.pipeline_id !== existing.settings.pipeline_id) {
    settings.phase_id = null;
  }
  const { error } = await supabase.from("customer_integrations").update({ settings, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("customer_id", customerId).eq("provider", TEAMLEADER_PROVIDER);
  if (error) throw new Error(error.message);
  return settings;
}
async function ensureValidAccessToken(supabase, integration) {
  const bufferMs = 2 * 60 * 1e3;
  if (integration.expires_at.getTime() > Date.now() + bufferMs) {
    return integration.access_token;
  }
  const oauthConfig = await getEffectiveOAuthConfig(supabase, integration.customer_id);
  if (!oauthConfig) {
    throw new Error(
      "Teamleader-koppeling kan niet vernieuwen: OAuth-app credentials ontbreken."
    );
  }
  const refreshed = await refreshAccessToken(oauthConfig, integration.refresh_token);
  await updateTeamleaderTokens(supabase, integration.customer_id, refreshed);
  return refreshed.accessToken;
}
async function resolvePhaseIdForPipeline(supabase, integration, accessToken, pipelineId) {
  if (integration.settings.phase_id && integration.settings.pipeline_id === pipelineId) {
    return integration.settings.phase_id;
  }
  const phaseId = await getFirstPhaseId(accessToken, pipelineId);
  if (phaseId) {
    await updateTeamleaderSettings(supabase, integration.customer_id, {
      pipeline_id: pipelineId,
      phase_id: phaseId
    });
  }
  return phaseId;
}

// src/lib/integrations/outboundWebhook/types.ts
var OUTBOUND_WEBHOOK_PROVIDER = "outbound_webhook";

// src/lib/integrations/outboundWebhook/integrationRepo.ts
async function getRawOutboundWebhookRow(supabase, customerId) {
  const { data } = await supabase.from("customer_integrations").select("id, customer_id, access_token_enc, settings, connected_at").eq("customer_id", customerId).eq("provider", OUTBOUND_WEBHOOK_PROVIDER).maybeSingle();
  return data ?? null;
}
async function getOutboundWebhookConfig(supabase, customerId) {
  const row = await getRawOutboundWebhookRow(supabase, customerId);
  if (!row) return null;
  let token = null;
  if (row.access_token_enc) {
    try {
      token = decryptSecret(row.access_token_enc);
    } catch (err) {
      console.error("[outbound_webhook] token decrypt failed", {
        customerId,
        message: err instanceof Error ? err.message : String(err)
      });
      token = null;
    }
  }
  return {
    id: row.id,
    customer_id: row.customer_id,
    token,
    settings: row.settings ?? {},
    connected_at: row.connected_at
  };
}
function isOutboundWebhookSyncReady(config) {
  if (!config) return false;
  if (config.settings.enabled !== true) return false;
  if (!config.settings.url) return false;
  return true;
}
async function isOutboundWebhookReadyForCustomer(supabase, customerId) {
  return isOutboundWebhookSyncReady(await getOutboundWebhookConfig(supabase, customerId));
}
function isBranchAllowed(settings, branch) {
  const list = settings.branches ?? [];
  if (list.length === 0) return true;
  return branch != null && list.includes(branch);
}

// src/lib/integrations/syncRouting.ts
function isTeamleaderSyncReady(integration) {
  if (!integration?.connected_at) return false;
  if (integration.settings.enabled === false) return false;
  return Boolean(integration.settings.pipeline_id);
}
function isGoogleSheetsSyncReady(integration, customerBranches) {
  if (!integration?.connected_at) return false;
  if (integration.settings.enabled === false) return false;
  const spreadsheetOk = Boolean(
    integration.settings.spreadsheet_id && integration.settings.sheet_name
  );
  if (!spreadsheetOk) return false;
  return hasSavedSheetMappings(integration.settings.field_mappings, customerBranches);
}
function resolveIntegrationSyncTargetsFromState(args) {
  const effective = resolveEffectiveCrmProvider(
    args.preferredStored,
    args.teamleaderConnected,
    args.sheetsConnected
  );
  if (effective === TEAMLEADER_PROVIDER) {
    return { teamleader: args.tlReady, google_sheets: false };
  }
  if (effective === GOOGLE_SHEETS_PROVIDER) {
    return { teamleader: false, google_sheets: args.gsReady };
  }
  if (args.tlReady && !args.gsReady) return { teamleader: true, google_sheets: false };
  if (args.gsReady && !args.tlReady) return { teamleader: false, google_sheets: true };
  return { teamleader: false, google_sheets: false };
}
async function resolveIntegrationSyncTargets(supabase, customerId, customerBranches = []) {
  const [preferred, teamleaderIntegration, sheetsIntegration] = await Promise.all([
    getPreferredCrmProvider(supabase, customerId),
    getTeamleaderIntegration(supabase, customerId),
    getGoogleSheetsIntegrationPublic(supabase, customerId)
  ]);
  const tlReady = isTeamleaderSyncReady(teamleaderIntegration);
  const gsReady = isGoogleSheetsSyncReady(sheetsIntegration, customerBranches);
  return resolveIntegrationSyncTargetsFromState({
    preferredStored: preferred,
    teamleaderConnected: Boolean(teamleaderIntegration?.connected_at),
    sheetsConnected: Boolean(sheetsIntegration?.connected_at),
    tlReady,
    gsReady
  });
}

// src/lib/googleSheets/activeSheet.ts
async function fetchLatestSheetTab(accessToken, spreadsheetId) {
  const tabs = await fetchSpreadsheetTabs(accessToken, spreadsheetId);
  const tab = pickDefaultSheetTab(tabs, null);
  if (!tab) return null;
  return { sheetId: tab.sheetId, title: tab.title };
}
async function ensureLatestSheetInSettings(supabase, customerId, integration, accessToken) {
  const spreadsheetId = integration.settings.spreadsheet_id;
  if (!spreadsheetId) {
    throw new Error("Geen spreadsheet gekoppeld");
  }
  const tab = await fetchLatestSheetTab(accessToken, spreadsheetId);
  if (!tab) {
    throw new Error("Geen werkblad gevonden in deze spreadsheet");
  }
  const tabChanged = integration.settings.sheet_name !== tab.title || integration.settings.sheet_gid !== tab.sheetId;
  if (tabChanged) {
    await updateGoogleSheetsSettings(supabase, customerId, {
      sheet_name: tab.title,
      sheet_gid: tab.sheetId
    });
  }
  return {
    sheetName: tab.title,
    sheetGid: tab.sheetId,
    tabChanged
  };
}

// src/lib/googleSheets/serviceAccount.ts
var import_jose = require("jose");
function getPrivateKeyPem() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  raw = raw.trim().replace(/^["']|["']$/g, "");
  if (!raw) return "";
  return raw.replace(/\\n/g, "\n");
}
function isGoogleServiceAccountConfigured() {
  return Boolean(getGoogleServiceAccountEmail() && getPrivateKeyPem());
}
var cachedAccessToken = null;
async function getGoogleServiceAccountAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs > now + 6e4) {
    return cachedAccessToken.token;
  }
  const clientEmail = getGoogleServiceAccountEmail();
  const privateKeyPem = getPrivateKeyPem();
  if (!clientEmail || !privateKeyPem) {
    throw new Error("Google service account is niet geconfigureerd op de server.");
  }
  const privateKey = await (0, import_jose.importPKCS8)(privateKeyPem, "RS256");
  const iat = Math.floor(now / 1e3);
  const assertion = await new import_jose.SignJWT({ scope: GOOGLE_SHEETS_SCOPE }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuedAt(iat).setExpirationTime(iat + 3600).setIssuer(clientEmail).setSubject(clientEmail).setAudience(GOOGLE_OAUTH_TOKEN_URL).sign(privateKey);
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Google service account token mislukt: ${detail}`);
  }
  const expiresInSec = data.expires_in ?? 3600;
  cachedAccessToken = {
    token: data.access_token,
    expiresAtMs: now + expiresInSec * 1e3
  };
  return data.access_token;
}

// src/lib/googleSheets/access.ts
async function resolveGoogleSheetsAccessToken(supabase, customerId) {
  const oauthIntegration = await getGoogleSheetsIntegration(supabase, customerId);
  if (oauthIntegration) {
    return ensureValidGoogleAccessToken(supabase, oauthIntegration);
  }
  if (!isGoogleServiceAccountConfigured()) {
    throw new Error(
      "Google Spreadsheets is niet beschikbaar op de server. Neem contact op met Warme Leads."
    );
  }
  return getGoogleServiceAccountAccessToken();
}

// src/lib/googleSheets/syncAssignment.ts
async function getBranchFields(supabase, branchSlug) {
  const { data: branch } = await supabase.from("branches").select("id").eq("slug", branchSlug).maybeSingle();
  if (!branch?.id) return [];
  const { data: fields } = await supabase.from("branch_fields").select("key, label").eq("branch_id", branch.id).order("sort_order", { ascending: true });
  return (fields || []).map((f) => ({ key: f.key, label: f.label }));
}
async function syncAssignmentToGoogleSheets(args) {
  const supabase = createServerClient();
  const { customerId, leadId, assignmentId } = args;
  const integration = await getGoogleSheetsIntegrationPublic(supabase, customerId);
  if (!integration?.connected_at) return;
  if (integration.settings.enabled === false) return;
  const spreadsheetId = integration.settings.spreadsheet_id;
  if (!spreadsheetId) return;
  await assertGoogleSheetsServerReady();
  const { data: assignment } = await supabase.from("lead_assignments").select("id, customer_id, lead_id, status, notities, assigned_at").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.customer_id !== customerId || assignment.lead_id !== leadId) {
    return;
  }
  const { data: existingLog } = await supabase.from("integration_sync_log").select("id, status, attempts").eq("assignment_id", assignmentId).eq("provider", GOOGLE_SHEETS_PROVIDER).maybeSingle();
  if (existingLog?.status === "success" && !args.options?.forceResend) return;
  if (existingLog?.status === "success" && args.options?.forceResend) {
    await supabase.from("integration_sync_log").update({
      status: "pending",
      error_message: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", existingLog.id);
  }
  const { data: leadRow } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!leadRow || leadRow.bron === "demo") return;
  const geleverdOp = new Date(assignment?.assigned_at ?? Date.now());
  const lead = {
    ...leadRow,
    status: assignment?.status ?? leadRow.status ?? "nieuw",
    notities: assignment?.notities ?? leadRow.notities ?? "",
    geleverd_op: Number.isNaN(geleverdOp.getTime()) ? "" : geleverdOp.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })
  };
  const logPayload = {
    customer_id: customerId,
    lead_id: leadId,
    assignment_id: assignmentId,
    provider: GOOGLE_SHEETS_PROVIDER,
    status: "pending",
    attempts: (existingLog?.attempts ?? 0) + 1,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (existingLog?.id) {
    await supabase.from("integration_sync_log").update(logPayload).eq("id", existingLog.id);
  } else {
    const { error: insErr } = await supabase.from("integration_sync_log").insert({
      ...logPayload,
      attempts: 1
    });
    if (insErr?.code === "23505") return;
  }
  try {
    const accessToken = await resolveGoogleSheetsAccessToken(supabase, customerId);
    const { sheetName } = await ensureLatestSheetInSettings(
      supabase,
      customerId,
      integration,
      accessToken
    );
    const quotedSheet = quoteSheetName(sheetName);
    const headerRowPref = integration.settings.header_row ?? null;
    const branchSlug = lead.branch || "";
    const branchFields = await getBranchFields(supabase, branchSlug);
    const portalFields = getPortalFieldsForBranch(branchFields);
    const { columns, headerRow } = await scanSheetHeaders(
      accessToken,
      spreadsheetId,
      quotedSheet,
      { headerRow: headerRowPref }
    );
    let columnMapping = remapLegacyColumnIndices(
      mergeSheetMappings(integration.settings.field_mappings, branchSlug),
      columns
    );
    if (Object.keys(columnMapping).length === 0 && columns.length > 0) {
      columnMapping = suggestSheetColumnMapping(portalFields, columns);
    }
    const columnCount = sheetColumnCount(columns) || 20;
    const rowValues = buildSheetRowValues(
      lead,
      columnMapping,
      columnCount
    );
    if (rowValues.every((v) => !v.trim())) {
      throw new Error("Geen velden om naar de spreadsheet te schrijven (controleer veldkoppeling)");
    }
    const updatedRange = await appendRowToSheet(
      accessToken,
      spreadsheetId,
      quotedSheet,
      rowValues
    );
    await supabase.from("integration_sync_log").update({
      status: "success",
      teamleader_contact_id: spreadsheetId,
      teamleader_deal_id: updatedRange.slice(0, 500),
      error_message: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("assignment_id", assignmentId).eq("provider", GOOGLE_SHEETS_PROVIDER);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync mislukt";
    await supabase.from("integration_sync_log").update({
      status: "failed",
      error_message: message.slice(0, 2e3),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("assignment_id", assignmentId).eq("provider", GOOGLE_SHEETS_PROVIDER);
    throw err;
  }
}

// src/lib/teamleader/customFieldDefinitions.ts
var MAPPABLE_TYPES = /* @__PURE__ */ new Set([
  "single_line",
  "multi_line",
  "single_select",
  "multi_select",
  "date",
  "money",
  "integer",
  "number",
  "boolean",
  "email",
  "telephone",
  "url"
]);
var FILTERABLE_CONTEXTS = /* @__PURE__ */ new Set(["contact", "company", "product", "project", "milestone"]);
function normalizeTeamleaderFieldType(type) {
  return String(type ?? "").trim().toLowerCase().replace(/-/g, "_");
}
function isMappableTeamleaderFieldType(type) {
  return MAPPABLE_TYPES.has(normalizeTeamleaderFieldType(type));
}
function unwrapTeamleaderList(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}
function parseMappableRow(row) {
  const normalizedType = normalizeTeamleaderFieldType(row.type);
  if (!isMappableTeamleaderFieldType(normalizedType)) return null;
  return {
    id: row.id,
    label: row.label,
    type: normalizedType,
    context: row.context,
    required: row.required,
    options: row.configuration?.options
  };
}
async function fetchPaginatedDefinitions(accessToken, body) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  for (; ; ) {
    const batch = await teamleaderRequest(accessToken, "customFieldDefinitions.list", {
      ...body,
      page: { size: pageSize, number: page }
    });
    const list = unwrapTeamleaderList(batch);
    for (const row of list) {
      const parsed = parseMappableRow(row);
      if (parsed) all.push(parsed);
    }
    if (list.length < pageSize) break;
    page += 1;
    if (page > 20) break;
  }
  return all.sort((a, b) => a.label.localeCompare(b.label, "nl"));
}
async function listGroupedCustomFieldDefinitions(accessToken) {
  const [contactFiltered, unfiltered] = await Promise.all([
    FILTERABLE_CONTEXTS.has("contact") ? fetchPaginatedDefinitions(accessToken, { filter: { context: "contact" } }).catch(
      () => []
    ) : Promise.resolve([]),
    fetchPaginatedDefinitions(accessToken, {})
  ]);
  const contactFromAll = unfiltered.filter((f) => f.context === "contact");
  const deal = unfiltered.filter((f) => f.context === "deal");
  const contact = contactFiltered.length > 0 ? contactFiltered : contactFromAll;
  return {
    contact: [...contact].sort((a, b) => a.label.localeCompare(b.label, "nl")),
    deal: [...deal].sort((a, b) => a.label.localeCompare(b.label, "nl"))
  };
}

// src/lib/teamleader/mapping.ts
function splitContactName(full) {
  const trimmed = (full || "").trim();
  if (!trimmed) return { firstName: "Onbekend", lastName: "-" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]
  };
}
function formatDealTitle(template, vars) {
  const t = (template || DEFAULT_DEAL_TITLE_TEMPLATE).trim();
  return t.replace(/\{branch_name\}/g, vars.branch_name).replace(/\{naam_klant\}/g, vars.naam_klant).replace(/\{branch\}/g, vars.branch);
}
function buildDealSummary(lead, assignmentId, leadId, extraFields) {
  const lines = [
    "Lead via Warme Leads portaal",
    "",
    `Referentie: assignment ${assignmentId}, lead ${leadId}`
  ];
  if (lead.email) lines.push(`E-mail: ${lead.email}`);
  if (lead.telefoonnummer) lines.push(`Telefoon: ${lead.telefoonnummer}`);
  if (lead.postcode || lead.plaatsnaam) {
    lines.push(`Adres: ${[lead.postcode, lead.huisnummer, lead.plaatsnaam].filter(Boolean).join(" ")}`);
  }
  if (lead.provincie) lines.push(`Provincie: ${lead.provincie}`);
  if (lead.notities) lines.push("", `Notities: ${lead.notities}`);
  const extras = extraFields && Object.keys(extraFields).length > 0 ? extraFields : null;
  if (extras) {
    lines.push("", "Overige gegevens:");
    for (const [label, val] of Object.entries(extras)) {
      if (val.trim()) lines.push(`- ${label}: ${val}`);
    }
  } else {
    const cf = lead.custom_fields;
    if (cf && typeof cf === "object" && Object.keys(cf).length > 0) {
      lines.push("", "Extra velden:");
      for (const [k, v] of Object.entries(cf)) {
        if (v != null && String(v).trim()) lines.push(`- ${k}: ${v}`);
      }
    }
  }
  return lines.join("\n").slice(0, 8e3);
}
function normalizePhone(phone) {
  const p = (phone || "").trim();
  return p.length >= 6 ? p : void 0;
}
function normalizeNlPostcode(postcode) {
  const compact = (postcode || "").trim().replace(/\s+/g, "").toUpperCase();
  if (!compact) return null;
  const dutch = compact.match(/^(\d{4})([A-Z]{2})$/);
  if (dutch) return `${dutch[1]} ${dutch[2]}`;
  return compact;
}
function buildTeamleaderContactAddresses(lead) {
  const postal_code = normalizeNlPostcode(lead.postcode);
  const city = (lead.plaatsnaam || "").trim() || null;
  const line_1 = (lead.huisnummer || "").trim() || null;
  if (!postal_code && !city && !line_1) return void 0;
  return [
    {
      type: "primary",
      address: {
        line_1,
        postal_code,
        city,
        country: "NL"
      }
    }
  ];
}
function buildTeamleaderTelephones(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return void 0;
  const digits = normalized.replace(/\D/g, "");
  const isMobile = digits.startsWith("316") || digits.startsWith("06") || digits.length === 10 && digits.startsWith("6");
  return [{ type: isMobile ? "mobile" : "phone", number: normalized }];
}
function buildContactRemarks(lead, summaryExtras) {
  const lines = [];
  if (lead.notities) lines.push(String(lead.notities));
  const extras = summaryExtras && Object.keys(summaryExtras).length > 0 ? summaryExtras : null;
  if (extras) {
    if (lines.length) lines.push("");
    lines.push("Leadgegevens:");
    for (const [label, val] of Object.entries(extras)) {
      if (val.trim()) lines.push(`\u2022 ${label}: ${val}`);
    }
  } else {
    const cf = lead.custom_fields;
    if (cf && typeof cf === "object") {
      const entries = Object.entries(cf).filter(
        ([, v]) => v != null && String(v).trim()
      );
      if (entries.length > 0) {
        if (lines.length) lines.push("");
        lines.push("Leadgegevens:");
        for (const [k, v] of entries) lines.push(`\u2022 ${k}: ${v}`);
      }
    }
  }
  const text = lines.join("\n").trim();
  return text.length > 0 ? text.slice(0, 8e3) : void 0;
}

// src/lib/teamleader/contacts.ts
async function findContactByEmail(accessToken, email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const data = await teamleaderRequest(
    accessToken,
    "contacts.list",
    {
      filter: {
        email: {
          type: "primary",
          email: normalized
        }
      },
      page: { size: 1, number: 1 }
    }
  );
  const list = Array.isArray(data) ? data : [];
  const first = list[0];
  return first?.id ?? null;
}
async function tagContact(accessToken, contactId, tags = [WARME_LEADS_CONTACT_TAG]) {
  const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (!unique.length) return;
  await teamleaderRequest(accessToken, "contacts.tag", { id: contactId, tags: unique });
}
async function updateContact(accessToken, contactId, lead, customFields) {
  const body = { id: contactId };
  const telephones = buildTeamleaderTelephones(lead.telefoonnummer);
  if (telephones) body.telephones = telephones;
  const addresses = buildTeamleaderContactAddresses(lead);
  if (addresses) body.addresses = addresses;
  if (lead.remarks?.trim()) body.remarks = lead.remarks.trim();
  if (customFields?.length) {
    body.custom_fields = customFields;
    body.custom_fields_update_strategy = "partial";
  }
  await teamleaderRequest(accessToken, "contacts.update", body);
}
async function createContact(accessToken, lead, customFields) {
  const { firstName, lastName } = splitContactName(lead.naam_klant || "");
  const body = {
    first_name: firstName,
    last_name: lastName,
    tags: [WARME_LEADS_CONTACT_TAG]
  };
  if (lead.email?.trim()) {
    body.emails = [{ type: "primary", email: lead.email.trim() }];
  }
  const telephones = buildTeamleaderTelephones(lead.telefoonnummer);
  if (telephones) body.telephones = telephones;
  const addresses = buildTeamleaderContactAddresses(lead);
  if (addresses) body.addresses = addresses;
  if (lead.remarks?.trim()) body.remarks = lead.remarks.trim();
  if (customFields?.length) {
    body.custom_fields = customFields;
  }
  const created = await teamleaderRequest(accessToken, "contacts.add", body);
  if (!created?.id) throw new Error("contacts.add returned no id");
  return created.id;
}
async function findOrCreateContact(accessToken, lead, customFields) {
  if (lead.email?.trim()) {
    const existing = await findContactByEmail(accessToken, lead.email);
    if (existing) {
      await updateContact(accessToken, existing, lead, customFields);
      await tagContact(accessToken, existing);
      return existing;
    }
  }
  return createContact(accessToken, lead, customFields);
}

// src/lib/teamleader/syncLeadRecord.ts
async function getBranchName(supabase, branchSlug) {
  if (!branchSlug) return "Lead";
  const { data } = await supabase.from("branches").select("name").eq("slug", branchSlug).maybeSingle();
  return data?.name || branchSlug;
}
async function getBranchFields2(supabase, branchSlug) {
  const { data: branch } = await supabase.from("branches").select("id").eq("slug", branchSlug).maybeSingle();
  if (!branch?.id) return [];
  const { data: fields } = await supabase.from("branch_fields").select("key, label").eq("branch_id", branch.id).order("sort_order", { ascending: true });
  return (fields || []).map((f) => ({ key: f.key, label: f.label }));
}
async function syncLeadRecordToTeamleader(args) {
  const {
    supabase,
    accessToken,
    phaseId,
    settings,
    lead,
    assignmentId,
    leadId,
    dealTitlePrefix = "",
    summaryPreamble = ""
  } = args;
  const branchSlug = lead.branch || "";
  const branchFields = await getBranchFields2(supabase, branchSlug);
  const portalFields = getPortalFieldsForBranch(branchFields);
  let branchMapping = mergeMappings(settings.field_mappings, branchSlug);
  const hasAnyMapping = Object.keys(branchMapping.contact).length > 0 || Object.keys(branchMapping.deal).length > 0;
  const { contact: tlContactDefs, deal: tlDealDefs } = await listGroupedCustomFieldDefinitions(accessToken);
  if (!hasAnyMapping) {
    branchMapping = tlContactDefs.length > 0 || tlDealDefs.length > 0 ? suggestFieldMapping(portalFields, tlContactDefs, tlDealDefs) : suggestDefaultFieldMapping(portalFields);
  }
  const leadRecord = lead;
  const contactCustom = buildMappedCustomFields(leadRecord, branchMapping.contact, tlContactDefs, "contact");
  const dealCustom = buildMappedCustomFields(leadRecord, branchMapping.deal, tlDealDefs, "deal");
  const summaryExtras = collectSummaryExtras(leadRecord, portalFields, branchMapping);
  const branchName = await getBranchName(supabase, lead.branch);
  const remarks = buildContactRemarks(leadRecord, summaryExtras);
  const contactId = await findOrCreateContact(
    accessToken,
    {
      naam_klant: lead.naam_klant || "Onbekend",
      email: lead.email,
      telefoonnummer: lead.telefoonnummer,
      postcode: lead.postcode,
      huisnummer: lead.huisnummer,
      plaatsnaam: lead.plaatsnaam,
      remarks
    },
    contactCustom
  );
  let title = formatDealTitle(settings.deal_title_template, {
    branch_name: branchName,
    naam_klant: lead.naam_klant || "Onbekend",
    branch: lead.branch || ""
  });
  if (dealTitlePrefix) title = `${dealTitlePrefix}${title}`;
  let summary = buildDealSummary(
    leadRecord,
    assignmentId,
    leadId,
    Object.keys(summaryExtras).length > 0 ? summaryExtras : void 0
  );
  if (summaryPreamble) summary = `${summaryPreamble}${summary}`;
  const dealId = await createDeal(accessToken, {
    contactId,
    title,
    summary,
    phaseId,
    customFields: dealCustom
  });
  return { contactId, dealId, branchSlug, branchName };
}

// src/lib/teamleader/syncAssignment.ts
async function syncAssignmentToTeamleader(args) {
  const supabase = createServerClient();
  const { customerId, leadId, assignmentId } = args;
  const integration = await getTeamleaderIntegration(supabase, customerId);
  if (!integration?.connected_at) return;
  if (integration.settings.enabled === false) return;
  const pipelineId = integration.settings.pipeline_id;
  if (!pipelineId) return;
  const { data: assignment } = await supabase.from("lead_assignments").select("id, customer_id, lead_id").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.customer_id !== customerId || assignment.lead_id !== leadId) {
    return;
  }
  const { data: existingLog } = await supabase.from("integration_sync_log").select("id, status, attempts").eq("assignment_id", assignmentId).eq("provider", TEAMLEADER_PROVIDER).maybeSingle();
  if (existingLog?.status === "success" && !args.options?.forceResend) return;
  if (existingLog?.status === "success" && args.options?.forceResend) {
    await supabase.from("integration_sync_log").update({
      status: "pending",
      error_message: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", existingLog.id);
  }
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead || lead.bron === "demo") return;
  const logPayload = {
    customer_id: customerId,
    lead_id: leadId,
    assignment_id: assignmentId,
    provider: TEAMLEADER_PROVIDER,
    status: "pending",
    attempts: (existingLog?.attempts ?? 0) + 1,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (existingLog?.id) {
    await supabase.from("integration_sync_log").update(logPayload).eq("id", existingLog.id);
  } else {
    const { error: insErr } = await supabase.from("integration_sync_log").insert({
      ...logPayload,
      attempts: 1
    });
    if (insErr?.code === "23505") return;
  }
  try {
    const accessToken = await ensureValidAccessToken(supabase, integration);
    const phaseId = integration.settings.phase_id || await resolvePhaseIdForPipeline(supabase, integration, accessToken, pipelineId);
    if (!phaseId) {
      throw new Error("Geen deal-fase gevonden voor de gekozen pipeline");
    }
    const { contactId, dealId } = await syncLeadRecordToTeamleader({
      supabase,
      accessToken,
      pipelineId,
      phaseId,
      settings: integration.settings,
      lead,
      assignmentId,
      leadId
    });
    await supabase.from("integration_sync_log").update({
      status: "success",
      teamleader_contact_id: contactId,
      teamleader_deal_id: dealId,
      error_message: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("assignment_id", assignmentId).eq("provider", TEAMLEADER_PROVIDER);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync mislukt";
    await supabase.from("integration_sync_log").update({
      status: "failed",
      error_message: message.slice(0, 2e3),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("assignment_id", assignmentId).eq("provider", TEAMLEADER_PROVIDER);
    throw err;
  }
}

// src/lib/integrations/outboundWebhook/categoryMap.ts
var ISOLATIE_TOKEN_MAP = {
  dak: "Dakisolatie",
  dakisolatie: "Dakisolatie",
  vloer: "Vloerisolatie",
  vloerisolatie: "Vloerisolatie",
  bodem: "Bodemisolatie",
  bodemisolatie: "Bodemisolatie",
  "(spouw) muur": "Spouwmuurisolatie",
  "spouw muur": "Spouwmuurisolatie",
  spouwmuur: "Spouwmuurisolatie",
  spouwmuurisolatie: "Spouwmuurisolatie",
  muur: "Spouwmuurisolatie",
  muurisolatie: "Spouwmuurisolatie"
};
function normalizeToken(token) {
  return token.trim().toLowerCase().replace(/\s+/g, " ");
}
function titleCase(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
function resolveCategorieen(branch, customFields) {
  if (branch === "thuisbatterij") return ["Thuisbatterij"];
  if (branch === "isolatie") {
    const raw = customFields?.["interesse"];
    const rawStr = typeof raw === "string" ? raw : "";
    const mapped = [];
    for (const part of rawStr.split(",")) {
      const token = normalizeToken(part);
      if (!token) continue;
      const category = ISOLATIE_TOKEN_MAP[token];
      if (category && !mapped.includes(category)) mapped.push(category);
    }
    return mapped.length > 0 ? mapped : ["Isolatie"];
  }
  return [branch ? titleCase(branch) : "Onbekend"];
}

// src/lib/integrations/outboundWebhook/fields.ts
var CUSTOM_FIELD_PREFIX = "custom:";
var WEBHOOK_BASE_FIELDS = [
  { key: "categorie", defaultTarget: "categorie", label: "Categorie" },
  { key: "categorieen", defaultTarget: "categorieen", label: "Categorie\xEBn (lijst)" },
  { key: "aanhef", defaultTarget: "aanhef", label: "Aanhef" },
  { key: "naam", defaultTarget: "naam", label: "Naam" },
  { key: "voornaam", defaultTarget: "voornaam", label: "Voornaam (afgeleid)" },
  { key: "achternaam", defaultTarget: "achternaam", label: "Achternaam (afgeleid, incl. tussenvoegsel)" },
  { key: "email", defaultTarget: "email", label: "E-mailadres" },
  { key: "telefoonnummer", defaultTarget: "telefoonnummer", label: "Telefoonnummer" },
  { key: "adres", defaultTarget: "adres", label: "Adres (straat + huisnummer)" },
  { key: "straat", defaultTarget: "straat", label: "Straatnaam" },
  { key: "huisnummer", defaultTarget: "huisnummer", label: "Huisnummer" },
  { key: "postcode", defaultTarget: "postcode", label: "Postcode" },
  { key: "plaats", defaultTarget: "plaats", label: "Plaats" },
  { key: "provincie", defaultTarget: "provincie", label: "Provincie" },
  { key: "land", defaultTarget: "land", label: "Land" },
  { key: "branch", defaultTarget: "branch", label: "Branche" },
  { key: "lead_id", defaultTarget: "lead_id", label: "Lead-ID (uniek)" },
  { key: "assignment_id", defaultTarget: "assignment_id", label: "Toewijzings-ID" },
  { key: "aangemaakt_op", defaultTarget: "aangemaakt_op", label: "Aangemaakt op" }
];
function defaultFieldMappings(catalog = WEBHOOK_BASE_FIELDS) {
  return catalog.map((f) => ({ source: f.key, target: f.defaultTarget, enabled: true }));
}

// src/lib/integrations/outboundWebhook/naam.ts
var TUSSENVOEGSELS = /* @__PURE__ */ new Set([
  "van",
  "de",
  "den",
  "der",
  "het",
  "'t",
  "ten",
  "ter",
  "te",
  "op",
  "in",
  "aan",
  "bij",
  "onder",
  "over",
  "uit",
  "voor",
  "du",
  "des",
  "del",
  "della",
  "di",
  "da",
  "dos",
  "das",
  "la",
  "le",
  "les",
  "el",
  "al",
  "ibn",
  "bin",
  "bint",
  "von",
  "zu",
  "zur",
  "vom",
  "af",
  "av",
  "'s",
  "st",
  "ver"
]);
function isTussenvoegsel(woord) {
  return TUSSENVOEGSELS.has(woord.toLowerCase().replace(/[.,]/g, ""));
}
function splitsNaam(volledig) {
  const schoon = (volledig ?? "").replace(/\s+/g, " ").trim();
  if (!schoon) return { voornaam: null, achternaam: null };
  const komma = schoon.indexOf(",");
  if (komma > 0) {
    const achternaam = schoon.slice(0, komma).trim();
    const voornaam = schoon.slice(komma + 1).trim();
    return {
      voornaam: voornaam || null,
      achternaam: achternaam || null
    };
  }
  const delen = schoon.split(" ");
  if (delen.length === 1) {
    return { voornaam: delen[0], achternaam: null };
  }
  if (isTussenvoegsel(delen[0])) {
    return { voornaam: null, achternaam: delen.join(" ") };
  }
  return { voornaam: delen[0], achternaam: delen.slice(1).join(" ") };
}

// src/lib/integrations/outboundWebhook/payload.ts
function nullable(value) {
  if (value === null || value === void 0) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}
function buildLeadSourceValues(lead, assignmentId, straat) {
  const categorieen = resolveCategorieen(lead.branch, lead.custom_fields ?? null);
  const gesplitst = splitsNaam(lead.naam_klant);
  const straatnaam = nullable(straat);
  const huisnummer = nullable(lead.huisnummer);
  const adres = straatnaam ? [straatnaam, huisnummer].filter(Boolean).join(" ").trim() : [nullable(lead.postcode), huisnummer].filter(Boolean).join(" ").trim();
  const values = {
    categorie: categorieen[0] ?? null,
    categorieen,
    aanhef: null,
    naam: nullable(lead.naam_klant),
    voornaam: gesplitst.voornaam,
    achternaam: gesplitst.achternaam,
    email: nullable(lead.email),
    telefoonnummer: nullable(lead.telefoonnummer),
    adres: adres.length > 0 ? adres : null,
    straat: straatnaam,
    huisnummer,
    postcode: nullable(lead.postcode),
    plaats: nullable(lead.plaatsnaam),
    provincie: nullable(lead.provincie),
    land: nullable(lead.land) ?? "NL",
    branch: nullable(lead.branch),
    lead_id: lead.id,
    assignment_id: assignmentId,
    aangemaakt_op: nullable(lead.created_at)
  };
  const cf = lead.custom_fields ?? {};
  for (const [k, v] of Object.entries(cf)) {
    values[`${CUSTOM_FIELD_PREFIX}${k}`] = typeof v === "string" ? v.trim() || null : v ?? null;
  }
  return values;
}
function applyFieldMappings(values, mappings) {
  const out = {};
  for (const m of mappings) {
    if (m.enabled === false) continue;
    const target = m.target?.trim();
    if (!target) continue;
    out[target] = values[m.source] ?? null;
  }
  return out;
}
function applyConstants(payload, constants) {
  const out = { ...payload };
  for (const c of constants ?? []) {
    const target = c?.target?.trim();
    if (!target) continue;
    out[target] = c.value ?? "";
  }
  return out;
}
function buildWebhookPayload(lead, assignmentId, mappings, straat, constants) {
  const values = buildLeadSourceValues(lead, assignmentId, straat);
  const effective = mappings && mappings.length > 0 ? mappings : defaultFieldMappings();
  return applyConstants(applyFieldMappings(values, effective), constants);
}

// src/lib/ssrfGuard.ts
var import_dns = __toESM(require("dns"));
var import_net = __toESM(require("net"));
var BLOCKED_HOSTNAMES = /* @__PURE__ */ new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog"
]);
function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}
function isBlockedIp(ip) {
  if (import_net.default.isIPv4(ip)) return isPrivateIPv4(ip);
  if (import_net.default.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}
async function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Ongeldige URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Alleen https:// is toegestaan" };
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, reason: "Ongeldige host" };
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".internal") || host.endsWith(".local")) {
    return { ok: false, reason: "Interne host is niet toegestaan" };
  }
  if (import_net.default.isIP(host)) {
    if (isBlockedIp(host)) return { ok: false, reason: "Priv\xE9/gereserveerd IP is niet toegestaan" };
    return { ok: true };
  }
  let addresses;
  try {
    addresses = await import_dns.default.promises.lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "Host kon niet worden opgezocht" };
  }
  if (addresses.length === 0) return { ok: false, reason: "Host heeft geen adres" };
  for (const addr of addresses) {
    if (isBlockedIp(addr.address)) {
      return { ok: false, reason: "URL verwijst naar een priv\xE9/gereserveerd adres" };
    }
  }
  return { ok: true };
}

// src/lib/integrations/outboundWebhook/transport.ts
var WEBHOOK_TIMEOUT_MS = 25e3;
var MAX_RESPONSE_BYTES = 1e6;
async function sendWebhookRequest(url, token, payload, options) {
  const guard = await assertPublicHttpUrl(url);
  if (!guard.ok) {
    return {
      ok: false,
      status: 0,
      bodySnippet: "",
      outcome: "http_error",
      errorMessage: `Webhook-URL geweigerd: ${guard.reason}`
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options?.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      // Volg geen redirects: voorkomt public→intern redirect-SSRF.
      redirect: "manual"
    });
    let bodySnippet = "";
    try {
      const lenHeader = Number(res.headers.get("content-length") || "0");
      if (!Number.isFinite(lenHeader) || lenHeader <= MAX_RESPONSE_BYTES) {
        bodySnippet = (await res.text()).slice(0, 500);
      }
    } catch {
    }
    if (res.ok) {
      return { ok: true, status: res.status, bodySnippet, outcome: "success", errorMessage: null };
    }
    const detail = bodySnippet ? `: ${bodySnippet}` : "";
    return {
      ok: false,
      status: res.status,
      bodySnippet,
      outcome: "http_error",
      errorMessage: `Webhook gaf HTTP ${res.status}${detail}`
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError" || typeof err === "object" && err !== null && err.name === "AbortError";
    if (isAbort) {
      return {
        ok: false,
        status: 0,
        bodySnippet: "",
        outcome: "timeout",
        errorMessage: `Geen antwoord binnen ${WEBHOOK_TIMEOUT_MS / 1e3}s (verzonden, niet bevestigd)`
      };
    }
    return {
      ok: false,
      status: 0,
      bodySnippet: "",
      outcome: "network_error",
      errorMessage: err instanceof Error ? err.message : "Netwerkfout bij webhook-aflevering"
    };
  } finally {
    clearTimeout(timeout);
  }
}

// src/lib/integrations/outboundWebhook/syncAssignment.ts
async function syncAssignmentToOutboundWebhook(args) {
  const supabase = createServerClient();
  const { customerId, leadId, assignmentId } = args;
  const config = await getOutboundWebhookConfig(supabase, customerId);
  if (!isOutboundWebhookSyncReady(config)) return;
  const { data: assignment } = await supabase.from("lead_assignments").select("id, customer_id, lead_id").eq("id", assignmentId).maybeSingle();
  if (!assignment || assignment.customer_id !== customerId || assignment.lead_id !== leadId) {
    return;
  }
  const { data: existingLog } = await supabase.from("integration_sync_log").select("id, status, attempts").eq("assignment_id", assignmentId).eq("provider", OUTBOUND_WEBHOOK_PROVIDER).maybeSingle();
  if (existingLog?.status === "success" && !args.options?.forceResend) return;
  const { data: leadRow } = await supabase.from("leads").select("*").eq("id", leadId).single();
  const lead = leadRow;
  if (!lead || lead.bron === "demo") return;
  if (!isBranchAllowed(config.settings, lead.branch)) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const logPayload = {
    customer_id: customerId,
    lead_id: leadId,
    assignment_id: assignmentId,
    provider: OUTBOUND_WEBHOOK_PROVIDER,
    status: "pending",
    attempts: (existingLog?.attempts ?? 0) + 1,
    updated_at: now
  };
  if (existingLog?.id) {
    await supabase.from("integration_sync_log").update(logPayload).eq("id", existingLog.id);
  } else {
    const { error: insErr } = await supabase.from("integration_sync_log").insert({ ...logPayload, attempts: 1 });
    if (insErr?.code === "23505") return;
  }
  try {
    const cf = lead.custom_fields && typeof lead.custom_fields === "object" && !Array.isArray(lead.custom_fields) ? lead.custom_fields : {};
    const storedStraat = cf.straat ?? cf.street ?? cf.adres;
    let straat = typeof storedStraat === "string" && storedStraat.trim() !== "" ? storedStraat.trim() : null;
    if (!straat && lead.postcode && lead.huisnummer) {
      straat = await resolveStreetName(lead.postcode, lead.huisnummer, {
        land: lead.land ?? null,
        telefoonnummer: lead.telefoonnummer ?? void 0,
        email: lead.email ?? void 0
      });
    }
    const payload = buildWebhookPayload(
      lead,
      assignmentId,
      config.settings.field_mappings,
      straat,
      config.settings.constants
    );
    const res = await sendWebhookRequest(config.settings.url, config.token, payload, {
      idempotencyKey: assignmentId
    });
    if (res.outcome === "timeout") {
      await supabase.from("integration_sync_log").update({
        status: "success",
        error_message: res.errorMessage,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("assignment_id", assignmentId).eq("provider", OUTBOUND_WEBHOOK_PROVIDER);
      console.warn("[outbound_webhook] afgeleverd zonder bevestiging (timeout), geen retry", {
        customerId,
        assignmentId
      });
      return;
    }
    if (!res.ok) {
      throw new Error(res.errorMessage ?? `Webhook gaf HTTP ${res.status}`);
    }
    await supabase.from("integration_sync_log").update({ status: "success", error_message: null, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("assignment_id", assignmentId).eq("provider", OUTBOUND_WEBHOOK_PROVIDER);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook-aflevering mislukt";
    await supabase.from("integration_sync_log").update({
      status: "failed",
      error_message: message.slice(0, 2e3),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("assignment_id", assignmentId).eq("provider", OUTBOUND_WEBHOOK_PROVIDER);
    throw err;
  }
}

// src/lib/integrations/onLeadAssigned.ts
function onLeadAssignedToCustomer(args) {
  void runIntegrationSyncs(args).catch((err) => {
    console.error("[integrations] sync routing failed", {
      customerId: args.customerId,
      assignmentId: args.assignmentId,
      message: err instanceof Error ? err.message : String(err)
    });
  });
}
async function runIntegrationSyncs(args) {
  const supabase = createServerClient();
  const { data: customer } = await supabase.from("customers").select("branches").eq("id", args.customerId).maybeSingle();
  const branches = customer?.branches ?? [];
  const targets = await resolveIntegrationSyncTargets(supabase, args.customerId, branches);
  if (targets.teamleader) {
    await syncAssignmentToTeamleader(args).catch((err) => {
      console.error("[teamleader] sync failed", {
        customerId: args.customerId,
        assignmentId: args.assignmentId,
        message: err instanceof Error ? err.message : String(err)
      });
    });
  }
  if (targets.google_sheets) {
    await syncAssignmentToGoogleSheets(args).catch((err) => {
      console.error("[google_sheets] sync failed", {
        customerId: args.customerId,
        assignmentId: args.assignmentId,
        message: err instanceof Error ? err.message : String(err)
      });
    });
  }
  if (await isOutboundWebhookReadyForCustomer(supabase, args.customerId)) {
    await syncAssignmentToOutboundWebhook(args).catch((err) => {
      console.error("[outbound_webhook] sync failed", {
        customerId: args.customerId,
        assignmentId: args.assignmentId,
        message: err instanceof Error ? err.message : String(err)
      });
    });
  }
}

// src/data/provinces.ts
var PROVINCES_NL = [
  "Drenthe",
  "Flevoland",
  "Friesland",
  "Gelderland",
  "Groningen",
  "Limburg",
  "Noord-Brabant",
  "Noord-Holland",
  "Overijssel",
  "Utrecht",
  "Zeeland",
  "Zuid-Holland"
];
var PROVINCES_BE = [
  "Antwerpen",
  "Brussels",
  "Henegouwen",
  "Limburg",
  "Luik",
  "Luxemburg",
  "Namen",
  "Oost-Vlaanderen",
  "Vlaams-Brabant",
  "Waals-Brabant",
  "West-Vlaanderen"
];
function provinceTargetValue(land, name) {
  return `${land}:${name}`;
}
function provinceTargetLabel(land, name) {
  return name === "Limburg" ? `Limburg (${land})` : name;
}
var PROVINCES_ALL = [
  ...PROVINCES_NL.map((p) => provinceTargetValue("NL", p)),
  ...PROVINCES_BE.map((p) => provinceTargetValue("BE", p))
].sort(
  (a, b) => provinceTargetLabel(
    a.startsWith("BE:") ? "BE" : "NL",
    a.split(":").slice(1).join(":")
  ).localeCompare(
    provinceTargetLabel(b.startsWith("BE:") ? "BE" : "NL", b.split(":").slice(1).join(":")),
    "nl"
  )
);
function provinceOption(name, land) {
  return {
    name,
    land,
    value: provinceTargetValue(land, name),
    label: provinceTargetLabel(land, name)
  };
}
var PROVINCE_OPTIONS_NL = PROVINCES_NL.map((p) => provinceOption(p, "NL"));
var PROVINCE_OPTIONS_BE = PROVINCES_BE.map((p) => provinceOption(p, "BE"));
function leadProvinceValue(name, land) {
  if (name === "Limburg" && land === "BE") return "Limburg (BE)";
  return name;
}
function leadProvinceLabel(name, land) {
  return name === "Limburg" ? `Limburg (${land})` : name;
}
var LEAD_PROVINCE_OPTIONS_NL = PROVINCES_NL.map((p) => ({ value: leadProvinceValue(p, "NL"), label: leadProvinceLabel(p, "NL") }));
var LEAD_PROVINCE_OPTIONS_BE = PROVINCES_BE.map((p) => ({ value: leadProvinceValue(p, "BE"), label: leadProvinceLabel(p, "BE") }));

// src/lib/provinceTargetMatch.ts
var TOKEN_RE = /^(NL|BE):(.+)$/;
function parseProvinceTargetToken(token) {
  const trimmed = token.trim();
  if (trimmed === "Limburg (BE)") return { land: "BE", name: "Limburg" };
  if (trimmed === "Limburg (NL)") return { land: "NL", name: "Limburg" };
  const m = trimmed.match(TOKEN_RE);
  if (m) return { land: m[1], name: m[2] };
  return { land: null, name: normalizeProvincie(trimmed) || trimmed };
}
function inferLandFromProvinceName(name) {
  if (name === "Limburg") return null;
  if (PROVINCES_BE.includes(name)) return "BE";
  if (PROVINCES_NL.includes(name)) return "NL";
  return null;
}
function resolveLeadLandForProvinceMatch(lead) {
  const raw = lead.land?.trim().toUpperCase();
  if (raw === "NL" || raw === "BE") return raw;
  const pc = (lead.postcode || "").replace(/\s/g, "").toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(pc)) return "NL";
  if (/^\d{4}$/.test(pc)) {
    const n = parseInt(pc, 10);
    if (n >= 1e3 && n <= 9999) return "BE";
  }
  return null;
}
function leadMatchesProvinceTarget(lead, targetToken) {
  const leadProv = normalizeProvincie(lead.provincie || "");
  if (!leadProv) return false;
  const parsed = parseProvinceTargetToken(targetToken);
  const targetName = normalizeProvincie(parsed.name) || parsed.name;
  if (leadProv !== targetName) return false;
  const requiredLand = parsed.land ?? inferLandFromProvinceName(targetName);
  if (!requiredLand) return false;
  const leadLand = resolveLeadLandForProvinceMatch(lead);
  if (!leadLand) return false;
  return leadLand === requiredLand;
}
function leadMatchesAnyProvinceTarget(lead, targetTokens) {
  if (!targetTokens.length) return false;
  return targetTokens.some((t) => leadMatchesProvinceTarget(lead, t));
}

// src/data/provincieGrenzen.json
var provincieGrenzen_default = { "NL:Groningen": { bbox: [6.176, 52.838, 7.218, 53.554], ringen: [[[7.093, 52.838], [7.087, 52.85], [7.182, 52.942], [7.213, 53.011], [7.199, 53.081], [7.203, 53.113], [7.183, 53.122], [7.179, 53.139], [7.218, 53.198], [7.217, 53.215], [7.206, 53.236], [7.104, 53.252], [7.078, 53.267], [7.084, 53.298], [7.027, 53.302], [6.968, 53.319], [6.897, 53.356], [6.888, 53.396], [6.874, 53.408], [6.882, 53.44], [6.865, 53.45], [6.814, 53.463], [6.798, 53.455], [6.746, 53.466], [6.634, 53.451], [6.599, 53.438], [6.547, 53.429], [6.368, 53.416], [6.306, 53.393], [6.261, 53.414], [6.191, 53.411], [6.185, 53.403], [6.218, 53.364], [6.232, 53.367], [6.25, 53.349], [6.287, 53.341], [6.279, 53.303], [6.254, 53.289], [6.256, 53.271], [6.218, 53.242], [6.23, 53.218], [6.2, 53.195], [6.177, 53.167], [6.176, 53.135], [6.206, 53.115], [6.262, 53.114], [6.291, 53.1], [6.344, 53.087], [6.383, 53.15], [6.408, 53.178], [6.443, 53.188], [6.448, 53.196], [6.486, 53.204], [6.53, 53.195], [6.564, 53.158], [6.581, 53.164], [6.588, 53.146], [6.619, 53.132], [6.635, 53.106], [6.695, 53.121], [6.737, 53.119], [6.937, 52.993], [7.016, 52.925], [7.046, 52.916], [7.015, 52.873], [7.04, 52.873], [7.072, 52.845], [7.093, 52.838]], [[6.505, 53.551], [6.487, 53.554], [6.461, 53.539], [6.486, 53.527], [6.506, 53.538], [6.505, 53.551]]], landzijde: ["1000000000000000000000000000000000111111111111111111111111111111110", "00000"] }, "NL:Friesland": { bbox: [4.845, 52.801, 6.428, 53.516], ringen: [[[5.16, 53.296], [5.127, 53.3], [5.133, 53.284], [5.16, 53.296]], [[5.1, 53.301], [5.064, 53.308], [5.036, 53.302], [4.854, 53.222], [4.845, 53.208], [4.869, 53.204], [4.88, 53.215], [4.919, 53.216], [4.979, 53.249], [4.972, 53.265], [5.1, 53.301]], [[6.191, 53.411], [6.177, 53.415], [6.139, 53.404], [6.095, 53.408], [6.016, 53.403], [5.933, 53.388], [5.888, 53.391], [5.587, 53.3], [5.527, 53.257], [5.483, 53.241], [5.449, 53.22], [5.42, 53.182], [5.404, 53.122], [5.379, 53.108], [5.378, 53.095], [5.349, 53.078], [5.293, 53.067], [5.166, 53], [5.297, 53.067], [5.344, 53.074], [5.375, 53.091], [5.393, 53.063], [5.376, 53.055], [5.408, 53.02], [5.397, 53.003], [5.413, 52.964], [5.401, 52.939], [5.407, 52.91], [5.371, 52.899], [5.357, 52.884], [5.366, 52.874], [5.426, 52.848], [5.454, 52.855], [5.545, 52.833], [5.567, 52.834], [5.585, 52.849], [5.645, 52.86], [5.658, 52.844], [5.749, 52.84], [5.795, 52.807], [5.82, 52.817], [5.844, 52.805], [5.876, 52.801], [5.924, 52.824], [5.93, 52.835], [5.972, 52.842], [5.997, 52.817], [6.053, 52.824], [6.06, 52.826], [6.053, 52.837], [6.081, 52.839], [6.207, 52.891], [6.257, 52.928], [6.303, 52.925], [6.333, 52.906], [6.393, 52.933], [6.428, 52.972], [6.363, 53.034], [6.368, 53.067], [6.305, 53.081], [6.315, 53.094], [6.262, 53.114], [6.206, 53.115], [6.176, 53.135], [6.177, 53.167], [6.2, 53.195], [6.23, 53.218], [6.218, 53.242], [6.256, 53.271], [6.254, 53.289], [6.279, 53.303], [6.287, 53.341], [6.254, 53.348], [6.221, 53.342], [6.218, 53.354], [6.197, 53.353], [6.162, 53.369], [6.155, 53.392], [6.162, 53.408], [6.191, 53.411]], [[5.543, 53.439], [5.495, 53.444], [5.201, 53.395], [5.165, 53.37], [5.151, 53.35], [5.191, 53.348], [5.221, 53.364], [5.257, 53.373], [5.293, 53.37], [5.357, 53.388], [5.384, 53.402], [5.459, 53.405], [5.476, 53.417], [5.541, 53.433], [5.543, 53.439]], [[5.731, 53.462], [5.652, 53.47], [5.616, 53.453], [5.616, 53.44], [5.643, 53.427], [5.68, 53.425], [5.73, 53.443], [5.805, 53.438], [5.891, 53.451], [5.931, 53.468], [5.731, 53.462]], [[6.379, 53.507], [6.345, 53.516], [6.15, 53.497], [6.119, 53.483], [6.115, 53.463], [6.252, 53.478], [6.338, 53.506], [6.379, 53.507]]], landzijde: ["000", "0000000000", "0000000000000000000000000000000000000111111111111111111111111111111111110000000", "00000000000000", "0000000000", "0000000"] }, "NL:Drenthe": { bbox: [6.12, 52.612, 7.093, 53.204], ringen: [[[7.093, 52.838], [7.072, 52.845], [7.04, 52.873], [7.015, 52.873], [7.046, 52.916], [7.016, 52.925], [6.937, 52.993], [6.737, 53.119], [6.695, 53.121], [6.635, 53.106], [6.619, 53.132], [6.588, 53.146], [6.581, 53.164], [6.564, 53.158], [6.53, 53.195], [6.486, 53.204], [6.448, 53.196], [6.443, 53.188], [6.408, 53.178], [6.383, 53.15], [6.344, 53.087], [6.315, 53.094], [6.305, 53.081], [6.368, 53.067], [6.363, 53.034], [6.428, 52.972], [6.393, 52.933], [6.333, 52.906], [6.303, 52.925], [6.257, 52.928], [6.207, 52.891], [6.12, 52.854], [6.202, 52.794], [6.156, 52.763], [6.12, 52.75], [6.163, 52.68], [6.183, 52.675], [6.202, 52.685], [6.273, 52.665], [6.323, 52.67], [6.326, 52.66], [6.364, 52.643], [6.384, 52.612], [6.406, 52.621], [6.453, 52.614], [6.464, 52.624], [6.519, 52.614], [6.514, 52.646], [6.553, 52.666], [6.615, 52.674], [6.708, 52.649], [6.71, 52.628], [6.742, 52.645], [6.777, 52.652], [6.897, 52.651], [6.919, 52.64], [6.939, 52.638], [6.975, 52.646], [7.042, 52.633], [7.055, 52.644], [7.072, 52.81], [7.093, 52.838]]], landzijde: ["0111111111111111111111111111111111111111111111111110000000000"] }, "NL:Overijssel": { bbox: [5.795, 52.118, 7.072, 52.854], ringen: [[[6.152, 52.829], [6.12, 52.854], [6.081, 52.839], [6.053, 52.837], [6.06, 52.826], [6.053, 52.824], [5.997, 52.817], [5.972, 52.842], [5.93, 52.835], [5.924, 52.824], [5.876, 52.801], [5.844, 52.805], [5.82, 52.817], [5.795, 52.807], [5.819, 52.788], [5.85, 52.785], [5.922, 52.751], [5.943, 52.715], [5.965, 52.694], [5.934, 52.676], [6.019, 52.643], [5.986, 52.623], [5.958, 52.625], [5.931, 52.614], [5.888, 52.617], [5.843, 52.611], [5.829, 52.587], [5.858, 52.546], [5.863, 52.521], [5.887, 52.517], [5.926, 52.474], [5.951, 52.484], [5.965, 52.476], [6.008, 52.504], [6.028, 52.51], [6.054, 52.5], [6.071, 52.482], [6.102, 52.466], [6.105, 52.443], [6.119, 52.433], [6.111, 52.408], [6.13, 52.399], [6.124, 52.381], [6.082, 52.372], [6.071, 52.322], [6.084, 52.302], [6.101, 52.301], [6.112, 52.278], [6.13, 52.261], [6.124, 52.251], [6.148, 52.228], [6.183, 52.234], [6.217, 52.226], [6.339, 52.227], [6.338, 52.236], [6.382, 52.246], [6.416, 52.242], [6.429, 52.223], [6.479, 52.183], [6.496, 52.177], [6.59, 52.182], [6.612, 52.163], [6.645, 52.174], [6.671, 52.166], [6.674, 52.143], [6.663, 52.13], [6.716, 52.118], [6.855, 52.12], [6.873, 52.133], [6.882, 52.156], [6.916, 52.178], [6.951, 52.181], [6.989, 52.227], [7.019, 52.225], [7.061, 52.235], [7.066, 52.241], [7.042, 52.256], [7.026, 52.292], [7.056, 52.338], [7.072, 52.352], [7.072, 52.373], [7.059, 52.399], [7.036, 52.403], [7.011, 52.429], [6.994, 52.465], [6.978, 52.466], [6.962, 52.445], [6.942, 52.435], [6.862, 52.451], [6.854, 52.46], [6.753, 52.464], [6.698, 52.486], [6.705, 52.521], [6.681, 52.553], [6.716, 52.549], [6.726, 52.563], [6.753, 52.559], [6.767, 52.564], [6.719, 52.589], [6.727, 52.615], [6.71, 52.628], [6.708, 52.649], [6.615, 52.674], [6.553, 52.666], [6.514, 52.646], [6.519, 52.614], [6.464, 52.624], [6.453, 52.614], [6.406, 52.621], [6.384, 52.612], [6.364, 52.643], [6.326, 52.66], [6.323, 52.67], [6.273, 52.665], [6.202, 52.685], [6.183, 52.675], [6.163, 52.68], [6.12, 52.75], [6.156, 52.763], [6.202, 52.794], [6.152, 52.829]]], landzijde: ["111111111111111111110001101111111111111111111111111111111111111111000000000000000000000000000000000011111111111111111111"] }, "NL:Flevoland": { bbox: [5.129, 52.253, 5.983, 52.844], ringen: [[[5.795, 52.807], [5.749, 52.84], [5.725, 52.844], [5.66, 52.828], [5.595, 52.763], [5.593, 52.663], [5.616, 52.651], [5.652, 52.617], [5.628, 52.605], [5.559, 52.592], [5.501, 52.556], [5.456, 52.55], [5.448, 52.535], [5.428, 52.538], [5.44, 52.556], [5.469, 52.57], [5.456, 52.594], [5.4, 52.649], [5.354, 52.678], [5.287, 52.691], [5.36, 52.674], [5.399, 52.649], [5.455, 52.594], [5.467, 52.572], [5.438, 52.555], [5.427, 52.538], [5.435, 52.511], [5.129, 52.383], [5.138, 52.326], [5.184, 52.335], [5.221, 52.334], [5.317, 52.304], [5.402, 52.253], [5.47, 52.263], [5.529, 52.275], [5.553, 52.321], [5.553, 52.334], [5.538, 52.35], [5.564, 52.368], [5.614, 52.362], [5.625, 52.38], [5.661, 52.398], [5.72, 52.416], [5.747, 52.415], [5.797, 52.439], [5.848, 52.493], [5.857, 52.518], [5.858, 52.546], [5.813, 52.577], [5.655, 52.597], [5.663, 52.613], [5.832, 52.613], [5.964, 52.639], [5.983, 52.658], [5.934, 52.676], [5.965, 52.694], [5.943, 52.715], [5.922, 52.751], [5.85, 52.785], [5.819, 52.788], [5.795, 52.807]]], landzijde: ["111000000000000000000000000000111110000000011111000101111111"] }, "NL:Gelderland": { bbox: [5, 51.735, 6.829, 52.519], ringen: [[[6.761, 52.119], [6.716, 52.118], [6.663, 52.13], [6.674, 52.143], [6.671, 52.166], [6.645, 52.174], [6.612, 52.163], [6.59, 52.182], [6.496, 52.177], [6.479, 52.183], [6.429, 52.223], [6.416, 52.242], [6.382, 52.246], [6.338, 52.236], [6.339, 52.227], [6.217, 52.226], [6.183, 52.234], [6.148, 52.228], [6.124, 52.251], [6.13, 52.261], [6.112, 52.278], [6.101, 52.301], [6.084, 52.302], [6.071, 52.322], [6.082, 52.372], [6.124, 52.381], [6.13, 52.399], [6.111, 52.408], [6.119, 52.433], [6.105, 52.443], [6.102, 52.466], [6.071, 52.482], [6.054, 52.5], [6.028, 52.51], [6.008, 52.504], [5.965, 52.476], [5.951, 52.484], [5.926, 52.474], [5.887, 52.517], [5.866, 52.519], [5.841, 52.467], [5.817, 52.457], [5.811, 52.436], [5.7, 52.381], [5.678, 52.379], [5.653, 52.365], [5.615, 52.363], [5.611, 52.346], [5.559, 52.311], [5.527, 52.264], [5.471, 52.264], [5.454, 52.254], [5.404, 52.247], [5.393, 52.221], [5.41, 52.219], [5.439, 52.202], [5.44, 52.171], [5.47, 52.166], [5.499, 52.147], [5.495, 52.122], [5.484, 52.106], [5.486, 52.094], [5.459, 52.08], [5.484, 52.07], [5.523, 52.078], [5.554, 52.1], [5.563, 52.078], [5.558, 52.049], [5.587, 52.031], [5.591, 52.003], [5.614, 51.99], [5.626, 51.974], [5.627, 51.952], [5.606, 51.943], [5.486, 51.984], [5.442, 51.986], [5.383, 51.969], [5.348, 51.968], [5.333, 51.957], [5.27, 51.965], [5.247, 51.977], [5.23, 51.976], [5.206, 51.959], [5.18, 51.967], [5.113, 51.888], [5.088, 51.888], [5.081, 51.876], [5.055, 51.873], [5.059, 51.858], [5.005, 51.858], [5, 51.848], [5.031, 51.841], [5.026, 51.819], [5, 51.821], [5.016, 51.808], [5.048, 51.798], [5.067, 51.781], [5.096, 51.788], [5.138, 51.773], [5.138, 51.751], [5.163, 51.743], [5.255, 51.735], [5.276, 51.74], [5.3, 51.737], [5.36, 51.761], [5.369, 51.79], [5.402, 51.821], [5.439, 51.81], [5.474, 51.815], [5.486, 51.829], [5.541, 51.816], [5.558, 51.828], [5.589, 51.83], [5.635, 51.82], [5.657, 51.798], [5.694, 51.788], [5.702, 51.778], [5.732, 51.772], [5.745, 51.759], [5.78, 51.752], [5.864, 51.758], [5.868, 51.776], [5.893, 51.778], [5.915, 51.753], [5.953, 51.748], [5.991, 51.766], [5.979, 51.798], [5.945, 51.824], [5.963, 51.837], [5.987, 51.831], [6.036, 51.843], [6.055, 51.852], [6.063, 51.865], [6.107, 51.848], [6.167, 51.841], [6.167, 51.862], [6.145, 51.87], [6.137, 51.886], [6.11, 51.895], [6.157, 51.905], [6.191, 51.892], [6.184, 51.883], [6.215, 51.868], [6.262, 51.868], [6.28, 51.874], [6.301, 51.865], [6.306, 51.849], [6.345, 51.851], [6.363, 51.835], [6.407, 51.828], [6.408, 51.854], [6.388, 51.862], [6.391, 51.873], [6.451, 51.865], [6.465, 51.855], [6.675, 51.916], [6.693, 51.915], [6.722, 51.896], [6.77, 51.916], [6.794, 51.935], [6.799, 51.959], [6.829, 51.964], [6.827, 51.994], [6.753, 52.028], [6.714, 52.04], [6.688, 52.04], [6.696, 52.07], [6.735, 52.075], [6.751, 52.085], [6.761, 52.119]]], landzijde: ["1111111111111111111111111111111111111111111000001111111111111111111111111111111111111111111111111111111111111111111111111111000000000000000000000000000000000000000000000"] }, "NL:Utrecht": { bbox: [4.792, 51.858, 5.627, 52.302], ringen: [[[5.065, 52.285], [5.043, 52.282], [5.022, 52.302], [4.961, 52.278], [4.926, 52.278], [4.929, 52.268], [4.911, 52.253], [4.87, 52.253], [4.843, 52.237], [4.795, 52.227], [4.814, 52.202], [4.844, 52.18], [4.892, 52.162], [4.874, 52.156], [4.875, 52.139], [4.855, 52.137], [4.833, 52.145], [4.813, 52.14], [4.792, 52.122], [4.825, 52.107], [4.826, 52.075], [4.868, 52.063], [4.829, 52.05], [4.803, 52.014], [4.847, 52.018], [4.857, 52.006], [4.818, 52], [4.86, 51.968], [4.878, 51.938], [4.932, 51.948], [4.939, 51.929], [4.956, 51.916], [4.995, 51.902], [4.999, 51.884], [5.024, 51.881], [5.027, 51.859], [5.059, 51.858], [5.055, 51.873], [5.081, 51.876], [5.088, 51.888], [5.113, 51.888], [5.18, 51.967], [5.206, 51.959], [5.23, 51.976], [5.247, 51.977], [5.27, 51.965], [5.333, 51.957], [5.348, 51.968], [5.383, 51.969], [5.442, 51.986], [5.486, 51.984], [5.606, 51.943], [5.627, 51.952], [5.626, 51.974], [5.614, 51.99], [5.591, 52.003], [5.587, 52.031], [5.558, 52.049], [5.563, 52.078], [5.554, 52.1], [5.523, 52.078], [5.484, 52.07], [5.459, 52.08], [5.486, 52.094], [5.484, 52.106], [5.495, 52.122], [5.499, 52.147], [5.47, 52.166], [5.44, 52.171], [5.439, 52.202], [5.41, 52.219], [5.393, 52.221], [5.404, 52.247], [5.357, 52.27], [5.266, 52.282], [5.193, 52.178], [5.121, 52.181], [5.046, 52.166], [5.034, 52.213], [5.042, 52.231], [5.057, 52.237], [5.027, 52.264], [5.033, 52.275], [5.066, 52.281], [5.065, 52.285]]], landzijde: ["111111111111011111111111111111111111111111111111111111111111111111111111101111111111"] }, "NL:Noord-Holland": { bbox: [4.494, 52.166, 5.314, 53.183], ringen: [[[4.682, 52.96], [4.693, 52.98], [4.667, 52.983], [4.663, 52.969], [4.682, 52.96]], [[5.287, 52.691], [5.299, 52.703], [5.288, 52.715], [5.283, 52.74], [5.258, 52.753], [5.193, 52.755], [5.18, 52.741], [5.146, 52.742], [5.104, 52.774], [5.114, 52.846], [5.039, 52.931], [5.166, 53], [5.054, 52.941], [4.968, 52.93], [4.935, 52.903], [4.875, 52.888], [4.809, 52.911], [4.791, 52.936], [4.802, 52.953], [4.779, 52.955], [4.763, 52.965], [4.731, 52.963], [4.717, 52.947], [4.706, 52.875], [4.637, 52.729], [4.638, 52.708], [4.615, 52.596], [4.593, 52.513], [4.575, 52.479], [4.605, 52.467], [4.554, 52.461], [4.562, 52.446], [4.555, 52.423], [4.494, 52.328], [4.564, 52.309], [4.569, 52.316], [4.612, 52.314], [4.588, 52.28], [4.568, 52.269], [4.557, 52.219], [4.633, 52.216], [4.67, 52.231], [4.686, 52.227], [4.704, 52.234], [4.724, 52.232], [4.725, 52.213], [4.814, 52.227], [4.87, 52.253], [4.911, 52.253], [4.929, 52.268], [4.926, 52.278], [4.961, 52.278], [5.022, 52.302], [5.043, 52.282], [5.066, 52.281], [5.033, 52.275], [5.027, 52.264], [5.057, 52.237], [5.042, 52.231], [5.034, 52.213], [5.046, 52.166], [5.121, 52.181], [5.193, 52.178], [5.266, 52.282], [5.306, 52.278], [5.297, 52.293], [5.314, 52.303], [5.291, 52.297], [5.248, 52.312], [5.174, 52.304], [5.148, 52.315], [5.138, 52.326], [5.077, 52.34], [5.037, 52.334], [5.035, 52.345], [4.974, 52.372], [5.014, 52.385], [5.052, 52.413], [5.067, 52.413], [5.075, 52.429], [5.092, 52.437], [5.095, 52.448], [5.133, 52.46], [5.103, 52.467], [5.093, 52.452], [5.093, 52.44], [5.049, 52.439], [5.048, 52.455], [5.068, 52.472], [5.059, 52.486], [5.086, 52.504], [5.031, 52.567], [5.02, 52.596], [5.019, 52.63], [5.046, 52.642], [5.068, 52.635], [5.089, 52.643], [5.128, 52.62], [5.159, 52.623], [5.175, 52.633], [5.199, 52.636], [5.236, 52.657], [5.246, 52.686], [5.287, 52.691]], [[4.879, 53.157], [4.861, 53.183], [4.841, 53.183], [4.758, 53.106], [4.724, 53.068], [4.709, 53.022], [4.714, 52.997], [4.737, 52.989], [4.785, 53.002], [4.819, 53.029], [4.847, 53.034], [4.873, 53.055], [4.873, 53.065], [4.897, 53.079], [4.9, 53.125], [4.908, 53.135], [4.879, 53.157]]], landzijde: ["0000", "0000000000000000000000000000000001111111111111111111100111111111000100000000000000000000000000000000000", "0000000000000000"] }, "NL:Zuid-Holland": { bbox: [3.839, 51.655, 5.031, 52.328], ringen: [[[4.311, 51.747], [4.264, 51.754], [4.262, 51.747], [4.311, 51.728], [4.337, 51.727], [4.353, 51.737], [4.311, 51.747]], [[3.956, 51.778], [3.934, 51.79], [3.905, 51.771], [3.956, 51.778]], [[4.795, 52.227], [4.725, 52.213], [4.724, 52.232], [4.704, 52.234], [4.686, 52.227], [4.67, 52.231], [4.633, 52.216], [4.557, 52.219], [4.568, 52.269], [4.588, 52.28], [4.612, 52.314], [4.569, 52.316], [4.564, 52.309], [4.494, 52.328], [4.374, 52.187], [4.332, 52.15], [4.137, 52.01], [4.093, 51.985], [4.047, 51.994], [4.042, 51.986], [4.004, 51.989], [3.984, 51.985], [3.965, 51.967], [3.963, 51.954], [3.984, 51.918], [3.999, 51.915], [4.04, 51.924], [4.053, 51.918], [4.029, 51.886], [4.068, 51.849], [4.036, 51.824], [4, 51.849], [3.86, 51.814], [3.855, 51.803], [3.865, 51.782], [3.86, 51.771], [3.839, 51.758], [3.855, 51.758], [3.869, 51.781], [3.896, 51.785], [3.897, 51.794], [3.949, 51.803], [3.989, 51.802], [4.02, 51.779], [4.017, 51.756], [4.022, 51.743], [4.059, 51.712], [4.111, 51.708], [4.155, 51.697], [4.157, 51.682], [4.189, 51.683], [4.22, 51.674], [4.232, 51.661], [4.281, 51.655], [4.357, 51.671], [4.368, 51.685], [4.404, 51.699], [4.406, 51.722], [4.53, 51.701], [4.619, 51.723], [4.637, 51.717], [4.675, 51.724], [4.737, 51.756], [4.755, 51.782], [4.797, 51.8], [4.846, 51.799], [4.889, 51.819], [4.936, 51.828], [5.026, 51.819], [5.031, 51.841], [5, 51.848], [5.005, 51.858], [5.027, 51.859], [5.024, 51.881], [4.999, 51.884], [4.995, 51.902], [4.956, 51.916], [4.939, 51.929], [4.932, 51.948], [4.878, 51.938], [4.86, 51.968], [4.818, 52], [4.857, 52.006], [4.847, 52.018], [4.803, 52.014], [4.829, 52.05], [4.868, 52.063], [4.826, 52.075], [4.825, 52.107], [4.792, 52.122], [4.813, 52.14], [4.833, 52.145], [4.855, 52.137], [4.875, 52.139], [4.874, 52.156], [4.892, 52.162], [4.844, 52.18], [4.814, 52.202], [4.795, 52.227]], [[4.058, 51.838], [4.074, 51.843], [4.094, 51.829], [4.131, 51.82], [4.156, 51.823], [4.182, 51.805], [4.212, 51.8], [4.249, 51.766], [4.349, 51.743], [4.404, 51.723], [4.384, 51.702], [4.329, 51.703], [4.263, 51.728], [4.188, 51.776], [4.126, 51.789], [4.044, 51.819], [4.058, 51.838]]], landzijde: ["000000", "000", "11111111111110000000000000000000000000000000000000000000000011111111111111111111111111111111111111", "0000000000000000"] }, "NL:Zeeland": { bbox: [3.358, 51.2, 4.277, 51.756], ringen: [[[3.519, 51.407], [3.44, 51.388], [3.431, 51.392], [3.37, 51.372], [3.374, 51.349], [3.385, 51.334], [3.358, 51.315], [3.377, 51.302], [3.37, 51.292], [3.407, 51.257], [3.45, 51.242], [3.528, 51.246], [3.515, 51.287], [3.563, 51.296], [3.576, 51.288], [3.591, 51.304], [3.641, 51.288], [3.658, 51.29], [3.694, 51.276], [3.756, 51.269], [3.795, 51.256], [3.789, 51.246], [3.791, 51.214], [3.86, 51.211], [3.889, 51.223], [3.886, 51.2], [3.959, 51.216], [4.006, 51.242], [4.058, 51.243], [4.166, 51.293], [4.235, 51.348], [4.206, 51.374], [4.173, 51.373], [4.139, 51.361], [4.053, 51.366], [4.018, 51.401], [3.974, 51.407], [3.955, 51.367], [3.917, 51.361], [3.867, 51.336], [3.807, 51.338], [3.789, 51.35], [3.723, 51.35], [3.687, 51.371], [3.641, 51.376], [3.585, 51.388], [3.548, 51.405], [3.519, 51.407]], [[3.842, 51.756], [3.813, 51.741], [3.764, 51.743], [3.71, 51.731], [3.689, 51.72], [3.679, 51.707], [3.689, 51.678], [3.722, 51.663], [3.714, 51.642], [3.698, 51.639], [3.683, 51.623], [3.681, 51.6], [3.634, 51.589], [3.599, 51.594], [3.552, 51.59], [3.438, 51.542], [3.433, 51.528], [3.496, 51.494], [3.527, 51.463], [3.575, 51.439], [3.64, 51.444], [3.658, 51.457], [3.692, 51.444], [3.735, 51.411], [3.755, 51.415], [3.812, 51.386], [3.876, 51.397], [3.901, 51.395], [3.926, 51.434], [3.921, 51.445], [3.975, 51.462], [4.033, 51.432], [4.05, 51.43], [4.062, 51.414], [4.157, 51.395], [4.197, 51.407], [4.232, 51.395], [4.243, 51.375], [4.277, 51.376], [4.268, 51.384], [4.264, 51.416], [4.276, 51.425], [4.219, 51.505], [4.236, 51.543], [4.228, 51.564], [4.192, 51.594], [4.192, 51.609], [4.214, 51.628], [4.237, 51.634], [4.201, 51.639], [4.169, 51.654], [4.155, 51.683], [4.109, 51.678], [4.092, 51.667], [4.044, 51.685], [4.015, 51.687], [4.007, 51.703], [3.982, 51.718], [3.973, 51.733], [3.914, 51.731], [3.888, 51.744], [3.826, 51.739], [3.842, 51.756]], [[3.807, 51.697], [3.825, 51.684], [3.857, 51.678], [3.877, 51.667], [3.89, 51.633], [3.914, 51.629], [3.869, 51.596], [3.835, 51.606], [3.715, 51.592], [3.682, 51.601], [3.687, 51.622], [3.714, 51.635], [3.725, 51.669], [3.807, 51.697]], [[4.097, 51.667], [4.109, 51.674], [4.15, 51.678], [4.16, 51.67], [4.152, 51.655], [4.12, 51.654], [4.101, 51.643], [4.099, 51.633], [4.126, 51.613], [4.075, 51.613], [3.99, 51.593], [3.984, 51.581], [4.049, 51.553], [4.077, 51.525], [4.164, 51.523], [4.177, 51.502], [4.214, 51.492], [4.223, 51.439], [4.181, 51.444], [4.133, 51.431], [4.093, 51.446], [4.056, 51.482], [4.043, 51.503], [4, 51.521], [3.957, 51.531], [3.94, 51.525], [3.927, 51.544], [3.868, 51.54], [3.873, 51.555], [3.897, 51.56], [3.869, 51.596], [3.914, 51.629], [3.94, 51.634], [3.968, 51.614], [4.007, 51.617], [4.071, 51.632], [4.097, 51.648], [4.097, 51.667]], [[3.707, 51.517], [3.683, 51.53], [3.67, 51.55], [3.644, 51.56], [3.628, 51.575], [3.641, 51.588], [3.655, 51.569], [3.688, 51.556], [3.725, 51.526], [3.707, 51.517]]], landzijde: ["00011111111111111100011101111100000000000000000", "00000000000000000000000000000000000001111111111010000000000000", "0000000000000", "0000000000000000000000000000000000000", "000000000"] }, "NL:Noord-Brabant": { bbox: [4.192, 51.221, 6.04, 51.83], ringen: [[[5.864, 51.758], [5.78, 51.752], [5.745, 51.759], [5.732, 51.772], [5.702, 51.778], [5.694, 51.788], [5.657, 51.798], [5.635, 51.82], [5.589, 51.83], [5.558, 51.828], [5.541, 51.816], [5.486, 51.829], [5.474, 51.815], [5.439, 51.81], [5.402, 51.821], [5.369, 51.79], [5.36, 51.761], [5.3, 51.737], [5.276, 51.74], [5.255, 51.735], [5.163, 51.743], [5.138, 51.751], [5.138, 51.773], [5.096, 51.788], [5.067, 51.781], [5.048, 51.798], [5.016, 51.808], [5, 51.821], [4.936, 51.828], [4.889, 51.819], [4.846, 51.799], [4.797, 51.8], [4.774, 51.793], [4.755, 51.782], [4.737, 51.756], [4.675, 51.724], [4.636, 51.717], [4.602, 51.697], [4.49, 51.683], [4.404, 51.699], [4.394, 51.694], [4.388, 51.669], [4.35, 51.648], [4.214, 51.628], [4.192, 51.609], [4.192, 51.594], [4.228, 51.564], [4.236, 51.543], [4.219, 51.505], [4.276, 51.425], [4.264, 51.416], [4.268, 51.384], [4.277, 51.376], [4.335, 51.378], [4.341, 51.358], [4.385, 51.354], [4.422, 51.365], [4.432, 51.375], [4.392, 51.408], [4.397, 51.442], [4.385, 51.449], [4.442, 51.469], [4.538, 51.482], [4.548, 51.473], [4.53, 51.45], [4.535, 51.423], [4.575, 51.433], [4.67, 51.426], [4.667, 51.444], [4.693, 51.452], [4.753, 51.5], [4.815, 51.495], [4.821, 51.483], [4.84, 51.479], [4.836, 51.461], [4.823, 51.449], [4.829, 51.423], [4.787, 51.433], [4.767, 51.431], [4.771, 51.415], [4.789, 51.409], [4.886, 51.417], [4.929, 51.396], [5.004, 51.445], [5.011, 51.472], [5.022, 51.482], [5.046, 51.471], [5.079, 51.471], [5.105, 51.431], [5.071, 51.393], [5.132, 51.347], [5.134, 51.316], [5.163, 51.31], [5.2, 51.323], [5.242, 51.305], [5.226, 51.268], [5.238, 51.261], [5.263, 51.267], [5.296, 51.261], [5.336, 51.263], [5.346, 51.276], [5.417, 51.262], [5.442, 51.282], [5.465, 51.285], [5.485, 51.3], [5.516, 51.295], [5.558, 51.262], [5.555, 51.244], [5.566, 51.221], [5.619, 51.229], [5.626, 51.274], [5.672, 51.315], [5.875, 51.353], [5.931, 51.385], [5.872, 51.45], [5.838, 51.566], [5.891, 51.56], [5.907, 51.552], [6.004, 51.57], [6.032, 51.552], [6.04, 51.582], [6.026, 51.596], [6.02, 51.622], [5.972, 51.646], [5.963, 51.657], [5.965, 51.676], [5.955, 51.709], [5.885, 51.728], [5.88, 51.75], [5.864, 51.758]]], landzijde: ["111111111111111111111111111111111111000000011111111111111110111111111111111111111111111111111111111111111111111111111111111111111"] }, "NL:Limburg": { bbox: [5.566, 50.751, 6.226, 51.778], ringen: [[[5.953, 51.748], [5.915, 51.753], [5.893, 51.778], [5.868, 51.776], [5.864, 51.758], [5.88, 51.75], [5.885, 51.728], [5.955, 51.709], [5.965, 51.676], [5.963, 51.657], [5.972, 51.646], [6.02, 51.622], [6.026, 51.596], [6.04, 51.582], [6.032, 51.552], [6.004, 51.57], [5.907, 51.552], [5.891, 51.56], [5.838, 51.566], [5.872, 51.45], [5.931, 51.385], [5.875, 51.353], [5.672, 51.315], [5.626, 51.274], [5.619, 51.229], [5.566, 51.221], [5.646, 51.2], [5.658, 51.185], [5.767, 51.184], [5.778, 51.151], [5.824, 51.168], [5.836, 51.154], [5.856, 51.145], [5.81, 51.118], [5.834, 51.1], [5.824, 51.092], [5.795, 51.09], [5.804, 51.077], [5.793, 51.059], [5.772, 51.06], [5.758, 51.034], [5.776, 51.022], [5.766, 50.998], [5.72, 50.962], [5.756, 50.958], [5.726, 50.921], [5.725, 50.911], [5.698, 50.91], [5.683, 50.889], [5.644, 50.871], [5.639, 50.846], [5.656, 50.824], [5.694, 50.812], [5.697, 50.775], [5.683, 50.761], [5.695, 50.755], [5.72, 50.765], [5.739, 50.757], [5.747, 50.77], [5.777, 50.783], [5.807, 50.756], [5.886, 50.77], [5.89, 50.756], [5.921, 50.751], [5.969, 50.761], [5.974, 50.755], [6.021, 50.754], [6.028, 50.774], [5.975, 50.798], [5.985, 50.81], [6.004, 50.801], [6.025, 50.814], [6.016, 50.834], [6.019, 50.846], [6.077, 50.861], [6.088, 50.872], [6.075, 50.893], [6.082, 50.922], [6.018, 50.935], [6.017, 50.983], [5.966, 50.98], [5.955, 50.988], [5.897, 50.975], [5.906, 51.002], [5.879, 51.018], [5.878, 51.038], [5.887, 51.052], [5.913, 51.067], [5.938, 51.035], [5.969, 51.047], [5.97, 51.061], [6.01, 51.091], [6.036, 51.097], [6.076, 51.119], [6.092, 51.135], [6.163, 51.149], [6.175, 51.158], [6.139, 51.173], [6.181, 51.186], [6.165, 51.194], [6.113, 51.175], [6.082, 51.172], [6.073, 51.183], [6.068, 51.221], [6.086, 51.223], [6.073, 51.243], [6.125, 51.275], [6.169, 51.333], [6.226, 51.36], [6.205, 51.4], [6.224, 51.475], [6.213, 51.491], [6.212, 51.513], [6.2, 51.527], [6.177, 51.539], [6.157, 51.567], [6.121, 51.593], [6.091, 51.606], [6.117, 51.657], [6.037, 51.673], [6.026, 51.709], [6.045, 51.717], [5.994, 51.738], [5.955, 51.738], [5.953, 51.748]]], landzijde: ["1111111111111111111111111111111011111111111111111111111111111011110000000000000000000000000000000000000000000000000000000000"] }, "BE:Brussels": { bbox: [4.258, 50.768, 4.48, 50.906], ringen: [[[4.477, 50.82], [4.48, 50.794], [4.371, 50.768], [4.258, 50.822], [4.308, 50.89], [4.401, 50.906], [4.477, 50.82]]], landzijde: ["111111"] }, "BE:Oost-Vlaanderen": { bbox: [3.331, 50.726, 4.327, 51.354], ringen: [[[4.307, 51.277], [4.327, 51.17], [4.308, 51.125], [4.176, 51.101], [4.201, 51.044], [4.241, 51.037], [4.147, 50.969], [4.157, 50.929], [4.137, 50.919], [4.105, 50.929], [4.059, 50.797], [3.896, 50.733], [3.815, 50.751], [3.776, 50.748], [3.719, 50.775], [3.629, 50.726], [3.541, 50.734], [3.46, 50.766], [3.513, 50.808], [3.467, 50.902], [3.42, 50.911], [3.449, 50.94], [3.44, 51.026], [3.331, 51.099], [3.411, 51.16], [3.381, 51.274], [3.5, 51.247], [3.534, 51.29], [3.602, 51.301], [3.856, 51.211], [3.978, 51.225], [4.105, 51.265], [4.166, 51.293], [4.242, 51.354], [4.307, 51.277]]], landzijde: ["1111111111111111111111111111011111"] }, "BE:Vlaams-Brabant": { bbox: [3.896, 50.691, 5.168, 51.039], ringen: [[[4.789, 51.039], [4.829, 51.015], [4.982, 51.035], [5.121, 51.02], [5.064, 50.941], [5.168, 50.886], [5.103, 50.709], [5.02, 50.751], [4.759, 50.803], [4.663, 50.788], [4.628, 50.75], [4.597, 50.764], [4.273, 50.696], [4.105, 50.708], [3.939, 50.691], [3.896, 50.733], [4.059, 50.797], [4.105, 50.929], [4.137, 50.919], [4.157, 50.929], [4.147, 50.969], [4.241, 51.037], [4.529, 50.992], [4.789, 51.039]], [[4.258, 50.822], [4.371, 50.768], [4.48, 50.794], [4.477, 50.82], [4.401, 50.906], [4.308, 50.89], [4.258, 50.822]]], landzijde: ["11111111111111111111111", "111111"] }, "BE:West-Vlaanderen": { bbox: [2.546, 50.708, 3.513, 51.37], ringen: [[[3.513, 50.808], [3.46, 50.766], [3.324, 50.722], [3.297, 50.751], [3.177, 50.756], [3.098, 50.779], [3.019, 50.774], [3.002, 50.805], [2.954, 50.797], [2.942, 50.769], [2.853, 50.75], [2.863, 50.708], [2.707, 50.81], [2.636, 50.821], [2.607, 50.913], [2.623, 50.957], [2.546, 51.089], [2.749, 51.162], [3.111, 51.312], [3.195, 51.355], [3.366, 51.37], [3.381, 51.274], [3.411, 51.16], [3.331, 51.099], [3.44, 51.026], [3.449, 50.94], [3.42, 50.911], [3.467, 50.902], [3.513, 50.808]]], landzijde: ["1111001111100000000011111111"] }, "BE:Waals-Brabant": { bbox: [4.105, 50.531, 5.02, 50.803], ringen: [[[5.02, 50.751], [4.983, 50.642], [4.672, 50.597], [4.578, 50.542], [4.501, 50.531], [4.247, 50.596], [4.181, 50.644], [4.108, 50.645], [4.105, 50.708], [4.273, 50.696], [4.597, 50.764], [4.628, 50.75], [4.663, 50.788], [4.759, 50.803], [5.02, 50.751]]], landzijde: ["11111111111111"] }, "BE:Henegouwen": { bbox: [2.853, 49.942, 4.608, 50.805], ringen: [[[3.719, 50.775], [3.776, 50.748], [3.815, 50.751], [3.896, 50.733], [3.939, 50.691], [4.105, 50.708], [4.108, 50.645], [4.181, 50.644], [4.247, 50.596], [4.501, 50.531], [4.578, 50.542], [4.608, 50.412], [4.589, 50.321], [4.475, 50.328], [4.331, 50.258], [4.385, 50.219], [4.378, 50.147], [4.432, 49.942], [4.233, 49.958], [4.141, 49.979], [4.209, 50.079], [4.149, 50.151], [4.198, 50.25], [4.028, 50.358], [3.894, 50.333], [3.77, 50.35], [3.708, 50.322], [3.667, 50.356], [3.656, 50.462], [3.615, 50.49], [3.524, 50.497], [3.491, 50.527], [3.386, 50.495], [3.303, 50.522], [3.245, 50.713], [3.195, 50.755], [3.297, 50.751], [3.324, 50.722], [3.46, 50.766], [3.541, 50.734], [3.629, 50.726], [3.719, 50.775]], [[3.019, 50.774], [2.908, 50.702], [2.863, 50.708], [2.853, 50.75], [2.942, 50.769], [2.954, 50.797], [3.002, 50.805], [3.019, 50.774]]], landzijde: ["11111111111111111000000000000000000111111", "0011111"] }, "BE:Luik": { bbox: [4.983, 50.13, 6.405, 50.812], ringen: [[[5.77, 50.747], [5.819, 50.715], [5.887, 50.719], [5.892, 50.755], [6.021, 50.754], [6.119, 50.712], [6.184, 50.638], [6.256, 50.622], [6.189, 50.566], [6.192, 50.521], [6.316, 50.497], [6.368, 50.445], [6.355, 50.379], [6.405, 50.323], [6.315, 50.313], [6.193, 50.241], [6.138, 50.13], [6.025, 50.183], [6.012, 50.291], [5.98, 50.33], [5.876, 50.341], [5.837, 50.269], [5.722, 50.262], [5.713, 50.351], [5.676, 50.369], [5.425, 50.419], [5.393, 50.379], [5.303, 50.374], [5.221, 50.417], [5.203, 50.466], [5.063, 50.537], [4.983, 50.642], [5.02, 50.751], [5.103, 50.709], [5.377, 50.745], [5.432, 50.72], [5.688, 50.812], [5.682, 50.757], [5.77, 50.747]]], landzijde: ["11110000000000000111111111111111111111"] }, "BE:Luxemburg": { bbox: [4.969, 49.497, 6.025, 50.419], ringen: [[[5.713, 50.351], [5.722, 50.262], [5.837, 50.269], [5.876, 50.341], [5.98, 50.33], [6.012, 50.291], [6.025, 50.183], [5.901, 50.108], [5.869, 50.047], [5.776, 49.948], [5.746, 49.854], [5.759, 49.802], [5.871, 49.715], [5.899, 49.657], [5.861, 49.574], [5.818, 49.546], [5.735, 49.546], [5.471, 49.497], [5.394, 49.617], [5.32, 49.621], [5.291, 49.68], [5.154, 49.718], [4.969, 49.802], [5.097, 49.93], [5.084, 49.968], [5.002, 50.003], [5.028, 50.047], [5.081, 50.091], [5.263, 50.108], [5.246, 50.217], [5.384, 50.288], [5.393, 50.379], [5.425, 50.419], [5.676, 50.369], [5.713, 50.351]]], landzijde: ["1111110000000000000000111111111111"] }, "BE:Namen": { bbox: [4.331, 49.802, 5.393, 50.642], ringen: [[[5.221, 50.417], [5.303, 50.374], [5.393, 50.379], [5.384, 50.288], [5.246, 50.217], [5.263, 50.108], [5.081, 50.091], [5.028, 50.047], [5.002, 50.003], [5.084, 49.968], [5.097, 49.93], [4.969, 49.802], [4.864, 49.811], [4.879, 49.913], [4.802, 49.965], [4.869, 50.144], [4.797, 50.149], [4.697, 50.085], [4.695, 50.047], [4.678, 49.996], [4.432, 49.942], [4.378, 50.147], [4.385, 50.219], [4.331, 50.258], [4.475, 50.328], [4.589, 50.321], [4.608, 50.412], [4.578, 50.542], [4.672, 50.597], [4.983, 50.642], [5.063, 50.537], [5.203, 50.466], [5.221, 50.417]]], landzijde: ["11111111111000000000111111111111"] }, "BE:Antwerpen": { bbox: [4.176, 50.992, 5.261, 51.502], ringen: [[[4.829, 51.48], [4.841, 51.428], [4.899, 51.406], [5.042, 51.479], [5.102, 51.429], [5.088, 51.382], [5.145, 51.321], [5.226, 51.309], [5.238, 51.262], [5.219, 51.226], [5.261, 51.147], [5.02, 51.072], [4.982, 51.035], [4.829, 51.015], [4.789, 51.039], [4.529, 50.992], [4.201, 51.044], [4.176, 51.101], [4.308, 51.125], [4.327, 51.17], [4.307, 51.277], [4.242, 51.354], [4.244, 51.375], [4.406, 51.365], [4.39, 51.444], [4.486, 51.478], [4.528, 51.476], [4.548, 51.429], [4.67, 51.426], [4.76, 51.502], [4.829, 51.48]], [[4.746, 51.438], [4.788, 51.396], [4.831, 51.415], [4.782, 51.445], [4.746, 51.438]]], landzijde: ["111111111111111111111011111111", "1111"] }, "BE:Limburg": { bbox: [4.982, 50.709, 5.892, 51.296], ringen: [[[5.688, 50.812], [5.432, 50.72], [5.377, 50.745], [5.103, 50.709], [5.168, 50.886], [5.064, 50.941], [5.121, 51.02], [4.982, 51.035], [5.02, 51.072], [5.261, 51.147], [5.219, 51.226], [5.238, 51.262], [5.498, 51.296], [5.548, 51.269], [5.566, 51.221], [5.835, 51.156], [5.798, 51.06], [5.766, 51.009], [5.733, 50.927], [5.654, 50.866], [5.688, 50.812]], [[5.887, 50.719], [5.819, 50.715], [5.77, 50.747], [5.682, 50.757], [5.774, 50.775], [5.892, 50.755], [5.887, 50.719]]], landzijde: ["11111111111111111111", "111111"] } };

// src/lib/provincieMarge.ts
var GRENZEN = provincieGrenzen_default;
var KM_PER_GRAAD_LAT = 110.574;
function kmPerGraadLng(lat) {
  return 111.32 * Math.cos(lat * Math.PI / 180);
}
function grensSleutelsVoor(provincieNaam) {
  const naam = provincieNaam.trim();
  if (!naam) return [];
  return ["NL", "BE"].map((land) => `${land}:${naam}`).filter((sleutel) => sleutel in GRENZEN);
}
function grensSleutelsVoorSelectie(provincies) {
  return [...new Set(provincies.flatMap(grensSleutelsVoor))];
}
function afstandTotSegmentKm(lat, lng, aLng, aLat, bLng, bLat) {
  const schaalLng = kmPerGraadLng(lat);
  const px = (lng - aLng) * schaalLng;
  const py = (lat - aLat) * KM_PER_GRAAD_LAT;
  const vx = (bLng - aLng) * schaalLng;
  const vy = (bLat - aLat) * KM_PER_GRAAD_LAT;
  const lengte2 = vx * vx + vy * vy;
  if (lengte2 === 0) return Math.hypot(px, py);
  let t = (px * vx + py * vy) / lengte2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - t * vx, py - t * vy);
}
function afstandTotProvincieGrensKm(lat, lng, sleutels, maxKm) {
  let best = Infinity;
  for (const sleutel of sleutels) {
    const provincie = GRENZEN[sleutel];
    if (!provincie) continue;
    if (maxKm != null) {
      const [minLng, minLat, maxLng, maxLat] = provincie.bbox;
      const marge = maxKm / Math.min(KM_PER_GRAAD_LAT, Math.max(kmPerGraadLng(lat), 1));
      if (lat < minLat - marge || lat > maxLat + marge) continue;
      if (lng < minLng - marge || lng > maxLng + marge) continue;
    }
    for (let r = 0; r < provincie.ringen.length; r++) {
      const ring = provincie.ringen[r];
      const landzijde = provincie.landzijde?.[r] ?? "";
      for (let i = 0; i < ring.length - 1; i++) {
        if (landzijde[i] !== "1") continue;
        const d = afstandTotSegmentKm(lat, lng, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
        if (d < best) {
          best = d;
          if (best === 0) return 0;
        }
      }
    }
  }
  return best === Infinity ? null : Math.round(best * 10) / 10;
}

// src/lib/provincieDoelMarge.ts
function grenssleutelsVoorTokens(tokens) {
  const namen = tokens.map((t) => parseProvinceTargetToken(t).name).map((n) => n.trim()).filter(Boolean);
  return grensSleutelsVoorSelectie(namen);
}
function binnenProvincieMarge(locatie, provincieTokens, margeKm) {
  if (!margeKm || margeKm <= 0) return false;
  if (locatie.lat == null || locatie.lng == null) return false;
  if (!provincieTokens.length) return false;
  const sleutels = grenssleutelsVoorTokens(provincieTokens);
  if (sleutels.length === 0) return false;
  const afstand = afstandTotProvincieGrensKm(locatie.lat, locatie.lng, sleutels, margeKm);
  return afstand != null && afstand <= margeKm;
}
function margeVan(target) {
  const m = Number(target.marge_km);
  return Number.isFinite(m) && m > 0 ? Math.min(100, m) : 0;
}

// src/lib/targetCountryMatch.ts
function targetCountryAllowsLead(target, lead) {
  const required = (target.country || "").toUpperCase();
  if (required !== "NL" && required !== "BE") return true;
  const leadLand = resolveLeadLandForProvinceMatch(lead);
  if (!leadLand) return false;
  return leadLand === required;
}

// src/lib/matchLeadToTargets.ts
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function matchLeadToTargets(lead, targets) {
  if (!targets.length) {
    return { matches: false, distance_km: null, matched_target_type: null };
  }
  const hasCoords = lead.lat != null && lead.lng != null && !Number.isNaN(lead.lat) && !Number.isNaN(lead.lng);
  let bestDistance = null;
  let matchedType = null;
  for (const t of targets) {
    if (!targetCountryAllowsLead(t, lead)) continue;
    if ((t.target_type || "radius") === "province") {
      const provs = Array.isArray(t.provinces) ? t.provinces : [];
      if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) {
        return { matches: true, distance_km: 0, matched_target_type: "province" };
      }
      const marge = margeVan(t);
      if (provs.length > 0 && marge > 0 && binnenProvincieMarge(lead, provs, marge)) {
        return { matches: true, distance_km: null, matched_target_type: "province" };
      }
    } else if (hasCoords && t.lat != null && t.lng != null && t.radius_km != null) {
      const dist = haversineKm(lead.lat, lead.lng, t.lat, t.lng);
      if (dist <= t.radius_km) {
        const rounded = Math.round(dist * 10) / 10;
        if (bestDistance == null || rounded < bestDistance) {
          bestDistance = rounded;
          matchedType = "radius";
        }
      }
    }
  }
  if (matchedType) {
    return { matches: true, distance_km: bestDistance, matched_target_type: matchedType };
  }
  return { matches: false, distance_km: null, matched_target_type: null };
}

// src/lib/manualAssignmentGuardrails.ts
var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1e3;
function checkBranchGuardrail(lead, customer) {
  const customerBranches = customer.branches || [];
  if (customerBranches.length === 0) return null;
  const leadBranch = lead.branch?.trim();
  if (!leadBranch || !customerBranches.includes(leadBranch)) {
    return {
      code: "branch_mismatch",
      message: `Lead-branche "${leadBranch || "?"}" hoort niet bij klant (${customerBranches.join(", ")})`
    };
  }
  return null;
}
function checkRecentAssignmentGuardrail(assignedAt) {
  if (!assignedAt) return null;
  const ts = new Date(assignedAt).getTime();
  if (Number.isNaN(ts)) return null;
  if (Date.now() - ts < THIRTY_DAYS_MS) {
    return {
      code: "recent_assignment",
      message: "Lead is al binnen 30 dagen aan deze klant toegewezen"
    };
  }
  return null;
}

// src/lib/assignLeadToBatch.ts
async function assignLeadToBatch(input) {
  const { supabase, lead, customer, batchId, source, skipGuardrails, negeerGeo } = input;
  if (!skipGuardrails) {
    const branchIssue = checkBranchGuardrail(lead, customer);
    if (branchIssue) return { ok: false, reason: branchIssue.message, code: branchIssue.code };
    const { data: targets } = await supabase.from("customer_targets").select("target_type, lat, lng, radius_km, provinces, country, is_active, marge_km").eq("customer_id", customer.id).eq("is_active", true);
    const activeTargets = targets || [];
    if (activeTargets.length > 0) {
      const geo = matchLeadToTargets(lead, activeTargets);
      if (!geo.matches && !negeerGeo) {
        return {
          ok: false,
          reason: "Lead valt buiten de doelgebieden van de klant",
          code: "geo_mismatch"
        };
      }
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString();
    const { data: recent } = await supabase.from("lead_assignments").select("assigned_at").eq("customer_id", customer.id).eq("lead_id", lead.id).gte("assigned_at", thirtyDaysAgo).limit(1).maybeSingle();
    const recentIssue = checkRecentAssignmentGuardrail(recent?.assigned_at);
    if (recentIssue) return { ok: false, reason: recentIssue.message, code: recentIssue.code };
  }
  let distance_km = input.distance_km ?? null;
  if (distance_km == null && !skipGuardrails) {
    const { data: targets } = await supabase.from("customer_targets").select("target_type, lat, lng, radius_km, provinces, country, is_active, marge_km").eq("customer_id", customer.id).eq("is_active", true);
    const geo = matchLeadToTargets(lead, targets || []);
    distance_km = geo.distance_km;
  }
  const insertRow = {
    lead_id: lead.id,
    customer_id: customer.id,
    batch_id: batchId || null,
    source,
    distance_km
  };
  if (input.assignedAt) insertRow.assigned_at = input.assignedAt;
  if (input.status != null) insertRow.status = input.status;
  if (input.notities != null) insertRow.notities = input.notities;
  if (input.portalUserId !== void 0) insertRow.portal_user_id = input.portalUserId;
  const { data: inserted, error } = await supabase.from("lead_assignments").insert(insertRow).select("id").single();
  if (error || !inserted) {
    return { ok: false, reason: error?.message || "Insert mislukt", code: "insert_failed" };
  }
  const { error: leadLinkErr } = await supabase.from("leads").update({ customer_id: customer.id }).eq("id", lead.id);
  if (leadLinkErr) {
    console.error("[assignLeadToBatch] leads.customer_id sync failed", {
      leadId: lead.id,
      customerId: customer.id,
      leadLinkErr
    });
  }
  onLeadAssignedToCustomer({
    customerId: customer.id,
    leadId: lead.id,
    assignmentId: inserted.id
  });
  if (batchId) {
    try {
      await syncBatchDelivered(supabase, batchId);
    } catch (syncErr) {
      console.error("[assignLeadToBatch] syncBatchDelivered failed", { batchId, syncErr });
    }
  }
  return { ok: true, assignmentId: inserted.id, distance_km };
}

// scripts/meta-inhaalslag.ts
var BRON_BESTAND = process.env.LIJST || "./jens-weg.json";
var VERSLAG = process.env.VERSLAG || "./inhaalslag-verslag.json";
var TRANCHES = 3;
var INFINITE_SCALE = "5bb1dfc6-def7-4067-9723-e0713cc08c74";
var DIRECTE_PROVINCIES = ["Noord-Holland", "Zuid-Holland", "Utrecht", "Flevoland"];
var VELDEN = {
  "heb_je_zonnepanelen?": "zonnepanelen",
  "heb_je_een_dynamisch_energiecontract?": "dynamisch_contract",
  "hoeveel_kwh_stroom_verbruik_je_per_jaar_ongeveer?": "stroomverbruik",
  "wat_is_je_budget_voor_een_thuisbatterij?": "budget",
  "voornaamste_reden_voor_je_interesse_in_een_thuisbatterij?": "reden_thuisbatterij"
};
var arg = (naam) => {
  const i = process.argv.indexOf(naam);
  return i >= 0 ? process.argv[i + 1] ?? "" : null;
};
var heeft = (naam) => process.argv.includes(naam);
var staart = (t) => {
  const d = String(t ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : null;
};
function verslagLezen() {
  return (0, import_fs.existsSync)(VERSLAG) ? JSON.parse((0, import_fs.readFileSync)(VERSLAG, "utf8")) : {};
}
async function main() {
  const supabase = (0, import_supabase_js2.createClient)(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const droog = heeft("--dry-run");
  if (heeft("--infinite-scale")) return infiniteScale(supabase, droog);
  const tranche = Number(arg("--tranche") || 0);
  if (!tranche || tranche < 1 || tranche > TRANCHES) {
    console.error(`Geef --tranche 1 t/m ${TRANCHES} op, of --infinite-scale.`);
    process.exit(1);
  }
  const alle = JSON.parse((0, import_fs.readFileSync)(BRON_BESTAND, "utf8")).slice().sort((a, b) => a.id.localeCompare(b.id));
  const perTranche = Math.ceil(alle.length / TRANCHES);
  const deel = alle.slice((tranche - 1) * perTranche, tranche * perTranche);
  console.log(`Tranche ${tranche} van ${TRANCHES}: ${deel.length} leads van de ${alle.length}${droog ? "  (PROEFDRAAI)" : ""}
`);
  const mails = /* @__PURE__ */ new Set(), tels = /* @__PURE__ */ new Set();
  for (let p = 0; p < 40; p++) {
    const { data } = await supabase.from("leads").select("email, telefoonnummer, created_at").gte("created_at", "2026-07-01T00:00:00Z").order("created_at").range(p * 1e3, p * 1e3 + 999);
    if (!data?.length) break;
    for (const r of data) {
      if (r.email) mails.add(String(r.email).toLowerCase().trim());
      const s = staart(r.telefoonnummer);
      if (s) tels.add(s);
    }
    if (data.length < 1e3) break;
  }
  const vandaag = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const gemaakt = [];
  const overgeslagen = {};
  const provincies = {};
  const sla = (reden) => {
    overgeslagen[reden] = (overgeslagen[reden] ?? 0) + 1;
  };
  for (const m of deel) {
    const email = (m.email ?? "").toLowerCase().trim();
    const tel = staart(m.tel);
    if (email && mails.has(email) || tel && tels.has(tel)) {
      sla("stond er al in");
      continue;
    }
    if (!m.naam) {
      sla("geen naam");
      continue;
    }
    const customFields = {};
    for (const [metaKey, onsKey] of Object.entries(VELDEN)) {
      const v = m.velden?.[metaKey];
      if (v) customFields[onsKey] = String(v);
    }
    const lead = await enrichLeadAddress({
      branch: "thuisbatterij",
      naam_klant: m.naam,
      email: m.email ?? "",
      telefoonnummer: m.tel ?? "",
      phone_valid: isPhoneValid(m.tel ?? ""),
      postcode: m.postcode ?? "",
      huisnummer: m.huisnummer ?? "",
      plaatsnaam: "",
      provincie: "",
      land: "",
      wervingsdatum: vandaag,
      status: "nieuw",
      bron: "zapier",
      notities: "",
      custom_fields: customFields,
      ...m.camp && { meta_campaign_id: m.camp },
      meta_leadgen_id: String(m.id)
    });
    if (checkLeadProfanity(lead).blocked) {
      sla("ongepaste inhoud");
      continue;
    }
    const prov = lead.provincie || "(onbekend)";
    provincies[prov] = (provincies[prov] ?? 0) + 1;
    if (droog) {
      gemaakt.push("(proefdraai)");
      continue;
    }
    const quality_score = calculateQualityScore(lead);
    const { data, error } = await supabase.from("leads").insert({ ...lead, quality_score }).select("id").single();
    if (error) {
      console.error("  inserten mislukt:", m.naam, error.message);
      sla("inserten mislukt");
      continue;
    }
    gemaakt.push(data.id);
    if (email) mails.add(email);
    if (tel) tels.add(tel);
  }
  console.log(droog ? "zou inladen:" : "ingeladen:", gemaakt.length);
  if (Object.keys(overgeslagen).length) {
    console.log("overgeslagen:");
    for (const [k, n] of Object.entries(overgeslagen)) console.log("  ", String(n).padStart(3), k);
  }
  console.log("\nper provincie:");
  for (const [k, n] of Object.entries(provincies).sort((a, b) => b[1] - a[1])) {
    const direct = DIRECTE_PROVINCIES.includes(k) ? "  <- direct naar Infinite Scale" : "";
    console.log("  ", String(n).padStart(3), k + direct);
  }
  if (!droog) {
    const verslag = verslagLezen();
    verslag[`tranche-${tranche}`] = gemaakt;
    (0, import_fs.writeFileSync)(VERSLAG, JSON.stringify(verslag, null, 1));
    console.log(`
lead-ids weggeschreven naar ${VERSLAG} (nodig om terug te draaien)`);
  }
}
async function infiniteScale(supabase, droog) {
  const verslag = verslagLezen();
  const ids = Object.values(verslag).flat();
  if (!ids.length) {
    console.error("Geen ingeladen leads gevonden; draai eerst een tranche.");
    process.exit(1);
  }
  const { data: batch } = await supabase.from("customer_batches").select("id, batch_size, leads_delivered").eq("customer_id", INFINITE_SCALE).eq("status", "active").eq("branch", "thuisbatterij").maybeSingle();
  if (!batch) {
    console.error("Infinite Scale heeft geen actieve thuisbatterij-batch.");
    process.exit(1);
  }
  const { data: klant } = await supabase.from("customers").select("id, branches").eq("id", INFINITE_SCALE).maybeSingle();
  const { data: leads } = await supabase.from("leads").select("*").in("id", ids).in("provincie", DIRECTE_PROVINCIES);
  console.log(`leads in ${DIRECTE_PROVINCIES.join(", ")}: ${leads?.length ?? 0}`);
  if (droog) {
    console.log("(PROEFDRAAI, niets toegewezen)");
    return;
  }
  let ok = 0;
  for (const lead of leads ?? []) {
    const r = await assignLeadToBatch({
      supabase,
      lead,
      customer: { id: klant.id, branches: klant.branches ?? null },
      batchId: batch.id,
      source: "distribution"
    });
    if (r.ok) ok++;
    else console.log("  overgeslagen:", lead.naam_klant, "::", r.reason);
  }
  console.log("toegewezen aan Infinite Scale:", ok);
}
main().catch((e) => {
  console.error("FOUT:", e.message);
  process.exit(1);
});
