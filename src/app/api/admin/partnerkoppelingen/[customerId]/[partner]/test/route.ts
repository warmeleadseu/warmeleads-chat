import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { partnerTest } from '@/lib/integrations/partners/service';
import { adminPartnerContext } from '../../../toegang';

/**
 * Testlevering vanuit de admin. Optioneel met een eigen mobiel nummer, zodat
 * je zelf ziet wat de klant van de partner ontvangt (bij Snelraak: WhatsApp).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ customerId: string; partner: string }> }) {
  const c = await adminPartnerContext(request, ctx.params);
  if ('fout' in c) return c.fout;
  const body = (await request.json().catch(() => ({}))) as { url?: unknown; telefoon?: unknown };
  return NextResponse.json(
    await partnerTest(
      createServerClient(),
      c.customerId,
      c.partner,
      typeof body.url === 'string' && body.url.trim() ? body.url : undefined,
      c.actor,
      typeof body.telefoon === 'string' && body.telefoon.trim() ? body.telefoon : null,
    ),
  );
}
