import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  await supabase
    .from('customers')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', customer.id);

  return NextResponse.json({ ok: true });
}
