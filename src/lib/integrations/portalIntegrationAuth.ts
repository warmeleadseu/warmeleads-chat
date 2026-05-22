import { NextResponse } from 'next/server';
import type { PortalSession } from '@/lib/portalAuth';

export function requireIntegrationOwner(session: PortalSession): NextResponse | null {
  if (!session.isOwner) {
    return NextResponse.json(
      { error: 'Alleen de accounteigenaar kan integraties beheren' },
      { status: 403 },
    );
  }
  return null;
}
