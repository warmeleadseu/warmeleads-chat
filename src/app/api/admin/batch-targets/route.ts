import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { backfillBatch, distributeUnassignedLeads } from '@/lib/distribution';
import { resolveCity } from '@/lib/pdok';
import {
  formatProvinceTargetLabel,
  normalizeProvinceTargetTokens,
  type ProvinceLand,
} from '@/lib/provinceTargetMatch';

type Supa = ReturnType<typeof createServerClient>;

const KNOWN_PRESETS = ['Heel Nederland', 'Heel België'];

/** Normaliseer een binnenkomende `country`-waarde naar 'NL' | 'BE' | null. */
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

/** Batch + klant ophalen en (voor accountmanagers) toegang controleren. */
async function loadBatchForAdmin(
  supabase: Supa,
  admin: { id: string; role: string },
  batchId: string,
): Promise<{ ok: true; batch: { id: string; customer_id: string; lookback_days: number | null } } | { ok: false; res: NextResponse }> {
  const { data: batch } = await supabase
    .from('customer_batches')
    .select('id, customer_id, lookback_days')
    .eq('id', batchId)
    .single();
  if (!batch) {
    return { ok: false, res: NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 }) };
  }
  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id')
      .eq('account_manager_id', admin.id)
      .eq('id', batch.customer_id)
      .single();
    if (!myCust) {
      return { ok: false, res: NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 }) };
    }
  }
  return { ok: true, batch };
}

async function provinceTokensForBatch(
  supabase: Supa,
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

/** Nieuw/gewijzigd geo-target → distributie + gerichte backfill triggeren (non-blocking). */
function triggerRedistribution(batchId: string, lookbackDays: number | null): void {
  try { distributeUnassignedLeads(); } catch { /* non-blocking */ }
  const lookback = typeof lookbackDays === 'number' ? Math.max(lookbackDays, 3) : 3;
  try { backfillBatch(batchId, lookback); } catch { /* non-blocking */ }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const batchId = request.nextUrl.searchParams.get('batch_id');
  if (!batchId) return NextResponse.json({ error: 'batch_id ontbreekt' }, { status: 400 });

  const supabase = createServerClient();
  const access = await loadBatchForAdmin(supabase, admin, batchId);
  if (!access.ok) return access.res;

  const { data, error } = await supabase
    .from('batch_targets')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { batch_id, label, target_type, lat, lng, radius_km, provinces } = body;
  if (!batch_id || !label) {
    return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
  }

  const access = await loadBatchForAdmin(supabase, admin, batch_id);
  if (!access.ok) return access.res;
  const { batch } = access;

  const type = target_type || 'radius';
  const explicitCountry = 'country' in body ? sanitizeCountry((body as { country?: unknown }).country) : undefined;

  if (type === 'province') {
    if (!Array.isArray(provinces) || provinces.length === 0) {
      return NextResponse.json({ error: 'Selecteer minimaal 1 provincie' }, { status: 400 });
    }
    const normalized = await provinceTokensForBatch(supabase, batch.customer_id, provinces);
    if (normalized.length === 0) {
      return NextResponse.json({ error: 'Selecteer minimaal 1 provincie' }, { status: 400 });
    }
    const resolvedLabel = label && String(label).trim()
      ? String(label).trim()
      : normalized.map(formatProvinceTargetLabel).join(', ');
    const country = explicitCountry !== undefined ? explicitCountry : deriveProvinceCountryDefault(normalized);
    const { data, error } = await supabase
      .from('batch_targets')
      .insert({
        batch_id,
        label: resolvedLabel,
        target_type: 'province',
        provinces: normalized,
        lat: null,
        lng: null,
        radius_km: 0,
        country,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    triggerRedistribution(batch_id, batch.lookback_days);
    return NextResponse.json(data, { status: 201 });
  }

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'Lat/lng is verplicht voor radius-targets' }, { status: 400 });
  }

  const verified = await verifyAndResolveCoords(label, lat, lng);
  const country = explicitCountry !== undefined ? explicitCountry : deriveRadiusCountryDefault(verified.resolvedLabel);

  const { data, error } = await supabase
    .from('batch_targets')
    .insert({
      batch_id,
      label: verified.resolvedLabel,
      target_type: 'radius',
      lat: verified.lat,
      lng: verified.lng,
      radius_km: radius_km || 25,
      country,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  triggerRedistribution(batch_id, batch.lookback_days);
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { data: existing } = await supabase
    .from('batch_targets')
    .select('id, batch_id, target_type, lat, lng')
    .eq('id', id)
    .single();
  if (!existing) return NextResponse.json({ error: 'Targetgebied niet gevonden' }, { status: 404 });

  const access = await loadBatchForAdmin(supabase, admin, existing.batch_id);
  if (!access.ok) return access.res;
  const { batch } = access;

  if ('country' in updates) {
    updates.country = sanitizeCountry(updates.country);
  }

  if ('provinces' in updates && Array.isArray(updates.provinces)) {
    updates.provinces = await provinceTokensForBatch(
      supabase,
      batch.customer_id,
      updates.provinces as string[],
    );
  }

  if ('label' in updates && 'lat' in updates && 'lng' in updates) {
    const verified = await verifyAndResolveCoords(updates.label, updates.lat, updates.lng);
    updates.label = verified.resolvedLabel;
    updates.lat = verified.lat;
    updates.lng = verified.lng;
  } else if ('label' in updates && !('lat' in updates)) {
    if ((existing.target_type || 'radius') === 'radius' && existing.lat != null) {
      const verified = await verifyAndResolveCoords(updates.label, existing.lat, existing.lng);
      updates.label = verified.resolvedLabel;
      updates.lat = verified.lat;
      updates.lng = verified.lng;
    }
  }

  const { data, error } = await supabase
    .from('batch_targets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const geoFieldChanged = 'lat' in updates || 'lng' in updates || 'radius_km' in updates || 'provinces' in updates || 'is_active' in updates;
  if (geoFieldChanged) triggerRedistribution(existing.batch_id, batch.lookback_days);

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { data: existing } = await supabase
    .from('batch_targets')
    .select('id, batch_id')
    .eq('id', id)
    .single();
  if (!existing) return NextResponse.json({ ok: true });

  const access = await loadBatchForAdmin(supabase, admin, existing.batch_id);
  if (!access.ok) return access.res;

  const { error } = await supabase.from('batch_targets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
