import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { partnerOpnieuw } from '@/lib/integrations/partners/service';
import { adminPartnerContext } from '../../../toegang';

export const maxDuration = 60;

/** Mislukte leveringen opnieuw proberen, met een schone teller. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ customerId: string; partner: string }> }) {
  const c = await adminPartnerContext(request, ctx.params);
  if ('fout' in c) return c.fout;
  return NextResponse.json(await partnerOpnieuw(createServerClient(), c.customerId, c.partner, c.actor));
}
