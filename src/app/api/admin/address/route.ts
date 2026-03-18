import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { resolveAddress } from '@/lib/pdok';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const postcode = request.nextUrl.searchParams.get('postcode') || '';
  const huisnummer = request.nextUrl.searchParams.get('huisnummer') || '';

  if (!postcode || !huisnummer) {
    return NextResponse.json({ plaatsnaam: '', provincie: '' });
  }

  const result = await resolveAddress(postcode, huisnummer);

  return NextResponse.json(result || { plaatsnaam: '', provincie: '' });
}
