import { PROVINCES_BE, PROVINCES_NL } from '@/data/provinces';
import { normalizeProvincie } from '@/lib/pdok';

import type { ProvinceLand } from '@/data/provinces';

export type { ProvinceLand };

const TOKEN_RE = /^(NL|BE):(.+)$/;

/** Opgeslagen waarde in `customer_targets.provinces` en portal assignment rules. */
export function provinceTargetToken(land: ProvinceLand, name: string): string {
  return `${land}:${name}`;
}

export function parseProvinceTargetToken(token: string): { land: ProvinceLand | null; name: string } {
  const trimmed = token.trim();
  if (trimmed === 'Limburg (BE)') return { land: 'BE', name: 'Limburg' };
  if (trimmed === 'Limburg (NL)') return { land: 'NL', name: 'Limburg' };
  const m = trimmed.match(TOKEN_RE);
  if (m) return { land: m[1] as ProvinceLand, name: m[2] };
  return { land: null, name: normalizeProvincie(trimmed) || trimmed };
}

export function formatProvinceTargetLabel(token: string): string {
  const { land, name } = parseProvinceTargetToken(token);
  if (name === 'Limburg' && land) return `Limburg (${land})`;
  return name || token;
}

function inferLandFromProvinceName(name: string): ProvinceLand | null {
  if (name === 'Limburg') return null;
  if ((PROVINCES_BE as readonly string[]).includes(name)) return 'BE';
  if ((PROVINCES_NL as readonly string[]).includes(name)) return 'NL';
  return null;
}

export function resolveLeadLandForProvinceMatch(lead: {
  land?: string | null;
  postcode?: string | null;
}): ProvinceLand | null {
  const raw = lead.land?.trim().toUpperCase();
  if (raw === 'NL' || raw === 'BE') return raw;
  const pc = (lead.postcode || '').replace(/\s/g, '').toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(pc)) return 'NL';
  if (/^\d{4}$/.test(pc)) {
    const n = parseInt(pc, 10);
    if (n >= 1000 && n <= 9999) return 'BE';
  }
  return null;
}

export function leadMatchesProvinceTarget(
  lead: { provincie?: string | null; land?: string | null; postcode?: string | null },
  targetToken: string,
): boolean {
  const leadProv = normalizeProvincie(lead.provincie || '');
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

export function leadMatchesAnyProvinceTarget(
  lead: { provincie?: string | null; land?: string | null; postcode?: string | null },
  targetTokens: string[],
): boolean {
  if (!targetTokens.length) return false;
  return targetTokens.some(t => leadMatchesProvinceTarget(lead, t));
}

/** Normaliseer UI/API-input naar canonieke tokens (`NL:…` / `BE:…`). */
export function normalizeProvinceTargetTokens(
  tokens: string[],
  defaultLand: ProvinceLand = 'NL',
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tokens) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const parsed = parseProvinceTargetToken(raw.trim());
    const land =
      parsed.land ??
      inferLandFromProvinceName(parsed.name) ??
      (parsed.name === 'Limburg' ? defaultLand : null);
    if (!land || !parsed.name) continue;
    const token = provinceTargetToken(land, parsed.name);
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}
