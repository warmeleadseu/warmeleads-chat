import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCity } from '@/lib/pdok';
import {
  formatProvinceTargetLabel,
  normalizeProvinceTargetTokens,
  type ProvinceLand,
} from '@/lib/provinceTargetMatch';

const KNOWN_PRESETS = ['Heel Nederland', 'Heel België'];

export type BatchTargetInsertInput = {
  label: string;
  target_type?: 'radius' | 'province';
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  provinces?: string[] | null;
  country?: 'NL' | 'BE' | null;
};

function sanitizeCountry(raw: unknown): 'NL' | 'BE' | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const v = String(raw).trim().toUpperCase();
  return v === 'NL' || v === 'BE' ? v : null;
}

function deriveRadiusCountryDefault(label: string): 'NL' | 'BE' | null {
  const lower = (label || '').toLowerCase();
  if (/(heel\s+nederland|hele\s+nederland|geheel\s+nederland|heel\s+nl\b)/.test(lower)) return 'NL';
  if (/(heel\s+belg|hele\s+belg|geheel\s+belg|heel\s+be\b)/.test(lower)) return 'BE';
  return null;
}

function deriveProvinceCountryDefault(tokens: string[]): 'NL' | 'BE' | null {
  if (!tokens.length) return null;
  const lands = new Set(tokens.map(t => (t.startsWith('NL:') ? 'NL' : t.startsWith('BE:') ? 'BE' : '?')));
  if (lands.size === 1 && lands.has('NL')) return 'NL';
  if (lands.size === 1 && lands.has('BE')) return 'BE';
  return null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function verifyAndResolveCoords(
  label: string,
  clientLat: number,
  clientLng: number,
): Promise<{ lat: number; lng: number; resolvedLabel: string }> {
  if (KNOWN_PRESETS.includes(label)) {
    return { lat: clientLat, lng: clientLng, resolvedLabel: label };
  }
  const resolved = await resolveCity(label);
  if (!resolved) return { lat: clientLat, lng: clientLng, resolvedLabel: label };
  const drift = haversineKm(clientLat, clientLng, resolved.lat, resolved.lng);
  if (drift > 5) return { lat: resolved.lat, lng: resolved.lng, resolvedLabel: resolved.naam };
  return { lat: clientLat, lng: clientLng, resolvedLabel: label };
}

async function provinceTokensForCustomer(
  supabase: SupabaseClient,
  customerId: string,
  provinces: string[],
): Promise<string[]> {
  const { data: customer } = await supabase
    .from('customers')
    .select('country')
    .eq('id', customerId)
    .single();
  const defaultLand: ProvinceLand = customer?.country === 'BE' ? 'BE' : 'NL';
  return normalizeProvinceTargetTokens(provinces, defaultLand);
}

/** Voegt één batch-target toe. Retourneert fouttekst bij mislukking. */
export async function insertBatchTarget(
  supabase: SupabaseClient,
  batchId: string,
  customerId: string,
  raw: BatchTargetInsertInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { label, target_type, lat, lng, radius_km, provinces } = raw;
  if (!label?.trim()) return { ok: false, error: 'Label ontbreekt' };

  const type = target_type || 'radius';
  const explicitCountry = 'country' in raw ? sanitizeCountry(raw.country) : undefined;

  if (type === 'province') {
    if (!Array.isArray(provinces) || provinces.length === 0) {
      return { ok: false, error: 'Selecteer minimaal 1 provincie' };
    }
    const normalized = await provinceTokensForCustomer(supabase, customerId, provinces);
    if (normalized.length === 0) {
      return { ok: false, error: 'Selecteer minimaal 1 provincie' };
    }
    const resolvedLabel = label.trim() || normalized.map(formatProvinceTargetLabel).join(', ');
    const country = explicitCountry !== undefined ? explicitCountry : deriveProvinceCountryDefault(normalized);
    const { error } = await supabase.from('batch_targets').insert({
      batch_id: batchId,
      label: resolvedLabel,
      target_type: 'province',
      provinces: normalized,
      lat: null,
      lng: null,
      radius_km: 0,
      country,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (lat == null || lng == null) {
    return { ok: false, error: 'Lat/lng is verplicht voor radius-targets' };
  }

  const verified = await verifyAndResolveCoords(label, lat, lng);
  const country = explicitCountry !== undefined ? explicitCountry : deriveRadiusCountryDefault(verified.resolvedLabel);

  const { error } = await supabase.from('batch_targets').insert({
    batch_id: batchId,
    label: verified.resolvedLabel,
    target_type: 'radius',
    lat: verified.lat,
    lng: verified.lng,
    radius_km: radius_km || 25,
    country,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertBatchTargets(
  supabase: SupabaseClient,
  batchId: string,
  customerId: string,
  inputs: BatchTargetInsertInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const input of inputs) {
    const result = await insertBatchTarget(supabase, batchId, customerId, input);
    if (!result.ok) return result;
  }
  return { ok: true };
}
