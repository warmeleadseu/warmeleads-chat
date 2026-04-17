import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const { customer } = session;
  const supabase = createServerClient();
  const now = new Date().toISOString();

  await supabase
    .from('customers')
    .update({ last_seen_at: now })
    .eq('id', customer.id);

  if (session.portalUser) {
    await supabase
      .from('portal_users')
      .update({ last_seen_at: now })
      .eq('id', session.portalUser.id);
  }

  return NextResponse.json({ ok: true });
}
