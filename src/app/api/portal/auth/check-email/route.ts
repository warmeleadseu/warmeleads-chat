import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 20;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Te veel verzoeken' }, { status: 429 });
  }

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
