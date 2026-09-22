import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { maakAgendaToken } from '@/lib/agendaIcs';

/** Geeft de ingelogde gebruiker zijn eigen abonneerlink op de agendafeed. */
export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW)) return forbidden();

  const customerId = session.customer.id;

  /* Wie alles mag zien krijgt de agenda van het hele bedrijf; een adviseur
     krijgt alleen zijn eigen afspraken, net als op het scherm. */
  const alles = hasPermission(session, PERMISSIONS.APPOINTMENTS_VIEW_ALL);
  const portalUserId = alles ? null : session.portalUser?.id ?? null;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  const q = new URLSearchParams({ klant: customerId, token: maakAgendaToken(customerId, portalUserId) });
  if (portalUserId) q.set('gebruiker', portalUserId);

  const https = `${siteUrl}/api/portal/agenda-feed?${q.toString()}`;

  return NextResponse.json({
    url: https,
    /* webcal laat de meeste agenda-apps de link meteen als abonnement openen
       in plaats van hem één keer te downloaden. */
    webcal: https.replace(/^https?:/, 'webcal:'),
    scope: alles ? 'bedrijf' : 'eigen',
  });
}
