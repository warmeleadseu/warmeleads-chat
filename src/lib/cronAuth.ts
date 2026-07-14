import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Verifieert cron-auth (Vercel-cron of handmatige trigger). Fail-closed:
 * ontbreekt `CRON_SECRET` of is die te kort, dan altijd 500/401 — nooit
 * fail-open (de oude `authHeader !== \`Bearer ${undefined}\``-checks lieten
 * `Bearer undefined` door als de env-var ontbrak). Constant-time vergelijking
 * tegen timing-aanvallen. Ondersteunt `Authorization: Bearer <secret>` én
 * `?secret=<secret>`.
 *
 * @returns een fout-`NextResponse` bij ongeldige auth, of `null` bij succes.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: 'Cron niet correct geconfigureerd' }, { status: 500 });
  }
  const header = request.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const querySecret = request.nextUrl.searchParams.get('secret') || '';
  const provided = bearer || querySecret;
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
