import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { resolveCity } from '@/lib/pdok';

/**
 * Plaatsnaam omzetten naar coordinaten, voor het werkgebied van een agent.
 *
 * Dezelfde bron als de admin gebruikt (PDOK voor Nederland, Nominatim voor
 * België). Alleen voor wie teamleden mag beheren: het werkgebied van een agent
 * wordt door de eigenaar ingesteld, niet door de agent zelf.
 */
export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.TEAM_MANAGE)) return forbidden();

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ error: 'Vul minstens twee letters in' }, { status: 400 });
  }

  const land = request.nextUrl.searchParams.get('land') as 'NL' | 'BE' | null;
  const gevonden = await resolveCity(q, land || undefined);

  if (!gevonden) {
    return NextResponse.json({ error: `"${q}" niet gevonden` }, { status: 404 });
  }

  return NextResponse.json({
    label: gevonden.naam || q,
    lat: gevonden.lat,
    lng: gevonden.lng,
    land: gevonden.land,
  });
}
