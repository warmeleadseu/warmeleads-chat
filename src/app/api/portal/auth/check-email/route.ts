import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const { limited, response } = rateLimit(ip, 'check-email', 20, 60_000);
  if (limited) return response!;

  const email = request.nextUrl.searchParams.get('email')?.toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ available: false, reason: 'invalid' });
  }

  const supabase = createServerClient();
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}
