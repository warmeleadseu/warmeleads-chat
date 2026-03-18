import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { resolveCity } from '@/lib/pdok';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const q = request.nextUrl.searchParams.get('q');
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Zoekterm te kort' }, { status: 400 });
  }

  const result = await resolveCity(q);
  if (!result) {
    return NextResponse.json({ error: 'Plaats niet gevonden' }, { status: 404 });
  }

  return NextResponse.json(result);
}
