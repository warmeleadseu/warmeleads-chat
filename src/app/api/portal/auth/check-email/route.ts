import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimitShared, getClientIp } from '@/lib/rateLimit';
import { escapeForIlikeExact, pickEmailRow } from '@/lib/emailDbLookup';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { limited, response } = await rateLimitShared(ip, 'check-email', 20, 60_000);
  if (limited) return response!;

  const email = request.nextUrl.searchParams.get('email')?.toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ available: false, reason: 'invalid' });
  }

  const supabase = createServerClient();
  const pattern = escapeForIlikeExact(email);

  const [{ data: custRows }, { data: portalRows }] = await Promise.all([
    supabase.from('customers').select('id, email').ilike('email', pattern).limit(5),
    supabase.from('portal_users').select('id, email').ilike('email', pattern).limit(5),
  ]);

  const taken =
    !!pickEmailRow(custRows || [], email) || !!pickEmailRow(portalRows || [], email);

  return NextResponse.json({ available: !taken });
}
