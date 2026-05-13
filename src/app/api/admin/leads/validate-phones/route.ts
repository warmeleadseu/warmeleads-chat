import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { isPhoneValid } from '@/lib/phoneValidation';

/** Default lookback (dagen) bij phone-validatie batch. Voorkomt full-table-scan; configureerbaar via ?days=. */
const DEFAULT_LOOKBACK_DAYS = 180;
/** Hardcap aantal pagina's × 1000 rijen om DB-load te begrenzen. */
const MAX_PAGES = 50;
const PAGE = 1000;
/** Chunkgrootte voor `update(...).in('id', chunk)` per phone_valid bucket. */
const UPDATE_CHUNK = 500;

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const t0 = Date.now();
  const url = request.nextUrl;
  const daysParam = parseInt(url.searchParams.get('days') || '');
  const lookbackDays = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 730) : DEFAULT_LOOKBACK_DAYS;
  const cutoffIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createServerClient();
  let validated = 0;
  let invalid = 0;
  let scanned = 0;
  let truncated = false;

  // Verzamel id's die geüpdatet moeten worden, gegroepeerd per phone_valid bucket.
  const toTrue: string[] = [];
  const toFalse: string[] = [];

  for (let p = 0; p < MAX_PAGES; p++) {
    const from = p * PAGE;
    const { data, error } = await supabase
      .from('leads')
      .select('id, telefoonnummer, phone_valid')
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error('[admin/validate-phones] fetch error:', error.message);
      return NextResponse.json({ error: 'Kon leads niet ophalen' }, { status: 500 });
    }
    if (!data?.length) break;
    scanned += data.length;

    for (const lead of data as { id: string; telefoonnummer: string | null; phone_valid: boolean | null }[]) {
      const valid = isPhoneValid(lead.telefoonnummer);
      if (lead.phone_valid !== valid) {
        if (valid) toTrue.push(lead.id);
        else toFalse.push(lead.id);
      }
      validated++;
      if (!valid) invalid++;
    }

    if (data.length < PAGE) break;
    if (p === MAX_PAGES - 1) truncated = true;
  }

  // Gegroepeerde updates: max 2 updates per chunk × #chunks (ipv N).
  let updateChunks = 0;
  for (let i = 0; i < toTrue.length; i += UPDATE_CHUNK) {
    const chunk = toTrue.slice(i, i + UPDATE_CHUNK);
    const { error } = await supabase.from('leads').update({ phone_valid: true }).in('id', chunk);
    updateChunks++;
    if (error) console.warn('[admin/validate-phones] update(true) chunk error:', error.message);
  }
  for (let i = 0; i < toFalse.length; i += UPDATE_CHUNK) {
    const chunk = toFalse.slice(i, i + UPDATE_CHUNK);
    const { error } = await supabase.from('leads').update({ phone_valid: false }).in('id', chunk);
    updateChunks++;
    if (error) console.warn('[admin/validate-phones] update(false) chunk error:', error.message);
  }

  console.info('[admin/validate-phones]', {
    computeMs: Date.now() - t0,
    lookbackDays,
    scanned,
    validated,
    invalid,
    updatedTrue: toTrue.length,
    updatedFalse: toFalse.length,
    updateChunks,
    truncated,
  });

  return NextResponse.json({
    success: true,
    validated,
    invalid,
    updated: toTrue.length + toFalse.length,
    scanned,
    lookbackDays,
    truncated,
  });
}
