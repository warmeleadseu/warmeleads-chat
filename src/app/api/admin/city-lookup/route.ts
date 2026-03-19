import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { resolveCity } from '@/lib/pdok';

const COUNTRY_PRESETS: Record<string, { lat: number; lng: number; naam: string; land: string; radius: number }> = {
  'heel-nederland': { lat: 52.1326, lng: 5.2913, naam: 'Heel Nederland', land: 'NL', radius: 200 },
  'heel-belgie': { lat: 50.5039, lng: 4.4699, naam: 'Heel België', land: 'BE', radius: 170 },
};

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const q = request.nextUrl.searchParams.get('q');
  const country = request.nextUrl.searchParams.get('country') as 'NL' | 'BE' | null;

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Zoekterm te kort' }, { status: 400 });
  }

  const presetKey = q.toLowerCase().replace(/\s+/g, '-');
  if (COUNTRY_PRESETS[presetKey]) {
    return NextResponse.json(COUNTRY_PRESETS[presetKey]);
  }

  const result = await resolveCity(q, country || undefined);
  if (!result) {
    return NextResponse.json({ error: 'Plaats niet gevonden' }, { status: 404 });
  }

  return NextResponse.json(result);
}
