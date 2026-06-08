/**
 * Gedeelde helper voor het normaliseren en valideren van branche-strings
 * die uit Excel/CSV-imports of API-input komen.
 *
 * Single source of truth voor:
 *  - synoniemen (bv. `airconditioning` → `airco`)
 *  - suffix-strippen (bv. `thuisbatterij leads` → `thuisbatterij`)
 *  - composities (bv. `kozijnen / glas` → `[kozijnen, glas]`)
 *  - ambigue waarden silent droppen (`beide`, `anders`)
 *
 * Doel: nooit meer onbekende branche-slugs in `prospects.branches` of
 * `customers.branches`. Wordt aangeroepen door:
 *  - `/api/admin/prospects/import` (server)
 *  - `ConvertToCustomerDialog` (client, voor defensieve filter)
 *  - migratie 135 (eenmalige cleanup van historische data)
 */

import type { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

/**
 * Statische alias-map: deze waarden komen vaak voor in Excel-bestanden
 * (vrij ingetypt door personen) maar zijn geen geldige slug.
 * Key = lowercase trim-normalisatie van wat in de cel staat.
 * Value = lijst met geldige branche-slugs waar het naar gemapt wordt.
 * Lege array = silent drop (ambigu of betekenisloos).
 */
const STATIC_BRANCH_ALIASES: Record<string, string[]> = {
  airconditioning: ['airco'],
  airco: ['airco'],
  klimaat: ['airco'],
  klimaattechniek: ['airco'],
  zonnepaneel: ['zonnepanelen'],
  pv: ['zonnepanelen'],
  solar: ['zonnepanelen'],
  warmtepompen: ['warmtepomp'],
  batterij: ['thuisbatterij'],
  thuisbatterijen: ['thuisbatterij'],
  beide: [],
  anders: [],
  overig: [],
  overige: [],
  onbekend: [],
  divers: [],
};

/**
 * Splits een ruwe celwaarde in losse kandidaat-strings.
 * Ondersteunt komma, puntkomma, pipe, slash, ampersand en " en " / " of ".
 */
function splitRawBranchCell(raw: string): string[] {
  return raw
    .split(/[,;|/&]| en | of /i)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Normaliseer één losse string naar een lowercase canonieke vorm zodat we
 * 'm tegen `branches.slug` of de alias-map kunnen matchen.
 * Strip ook veelvoorkomende suffixen die we in geïmporteerde Excels zien
 * (bv. "Thuisbatterij Leads", "Airco leads").
 */
function canonicalize(part: string): string {
  let s = part.toLowerCase().trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s*(?:leads?|lead|prospects?|aanvragen|aanvraag)\s*$/i, '').trim();
  s = s.replace(/\s+/g, '_');
  return s;
}

/**
 * Probeer één kandidaat-string te mappen naar geldige slugs.
 * 1) Direct in `validSlugs` → behoud.
 * 2) In `STATIC_BRANCH_ALIASES` → vervang.
 * 3) Onbekend → drop (en rapporteer terug).
 */
function mapCandidate(
  raw: string,
  validSlugs: Set<string>,
): { kept: string[]; dropped: string | null } {
  const canonical = canonicalize(raw);
  if (!canonical) return { kept: [], dropped: null };

  if (validSlugs.has(canonical)) {
    return { kept: [canonical], dropped: null };
  }

  if (canonical in STATIC_BRANCH_ALIASES) {
    const mapped = STATIC_BRANCH_ALIASES[canonical].filter(s => validSlugs.has(s));
    return { kept: mapped, dropped: mapped.length === 0 ? raw.trim() : null };
  }

  return { kept: [], dropped: raw.trim() };
}

export interface BranchResolution {
  /** Gevalideerde, unieke, geldige branche-slugs (in volgorde van eerste voorkomen). */
  valid: string[];
  /** Originele input-strings die we niet konden mappen (voor reporting/UI). */
  dropped: string[];
}

/**
 * Pure, sync resolver: gebruik wanneer je de set geldige slugs al hebt
 * (bv. omdat je 'em uit `branches`-tabel hebt voorgeladen).
 *
 * Accepteert ofwel een array (bv. `['zonnepanelen', 'beide']`) ofwel een
 * losse string (bv. `'kozijnen / glas, beide'`) ofwel `null/undefined`.
 */
export function resolveBranchSlugsAgainst(
  raw: unknown,
  validSlugs: Set<string>,
): BranchResolution {
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      parts.push(...splitRawBranchCell(item));
    }
  } else if (typeof raw === 'string') {
    parts.push(...splitRawBranchCell(raw));
  } else if (raw != null) {
    parts.push(...splitRawBranchCell(String(raw)));
  }

  const valid: string[] = [];
  const dropped: string[] = [];
  const seenValid = new Set<string>();
  const seenDropped = new Set<string>();

  for (const part of parts) {
    const { kept, dropped: drop } = mapCandidate(part, validSlugs);
    for (const slug of kept) {
      if (seenValid.has(slug)) continue;
      seenValid.add(slug);
      valid.push(slug);
    }
    if (drop !== null && !seenDropped.has(drop)) {
      seenDropped.add(drop);
      dropped.push(drop);
    }
  }

  return { valid, dropped };
}

/**
 * Async wrapper: laadt eenmalig alle geldige slugs uit `branches`-tabel
 * (alleen `is_active = true`) en resolved meerdere ruwe waarden in één keer.
 *
 * Gebruik dit aan de server-kant in import-endpoints zodat we niet voor
 * elke rij apart de tabel hoeven te raadplegen.
 */
export async function loadValidBranchSlugs(supabase: Supabase): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('branches')
    .select('slug')
    .eq('is_active', true);
  if (error) throw new Error(`Branches laden mislukt: ${error.message}`);
  return new Set((data || []).map((r: { slug: string }) => String(r.slug)));
}
