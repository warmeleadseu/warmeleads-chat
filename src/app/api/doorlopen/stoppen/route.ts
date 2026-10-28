import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimitShared, getClientIp } from '@/lib/rateLimit';
import { controleerStopToken } from '@/lib/doorloopToken';
import { zetDoorlopend } from '@/lib/doorlopen';

/**
 * Stopknop uit de mails over doorlopen, zonder inloggen. Alleen met een
 * geldige link, en alleen uitzetten. Pas na een klik op de pagina (POST),
 * zodat een virusscanner die de link opent niets uitzet.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rl = await rateLimitShared(`doorlopen-stop:${getClientIp(request)}`, 'doorlopen-stop', 10, 10 * 60_000);
  if (rl.limited && rl.response) return rl.response;

  const body = await request.json().catch(() => ({}));
  const klantId = typeof body?.k === 'string' ? body.k : '';
  const t = controleerStopToken(klantId, body?.v, body?.t);
  if (t === 'ongeldig') return NextResponse.json({ error: 'Deze link is niet geldig.' }, { status: 404 });
  if (t === 'verlopen') {
    return NextResponse.json({ error: 'Deze link is verlopen. Zet het uit in je portaal onder Account › Bestellingen, of beantwoord onze mail.' }, { status: 410 });
  }

  const r = await zetDoorlopend(createServerClient(), klantId, false, { soort: 'klant', naam: 'Klant (stoplink in mail)' });
  if (!r.ok) return NextResponse.json({ error: 'Uitzetten lukte niet. Probeer het opnieuw of neem contact met ons op.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
