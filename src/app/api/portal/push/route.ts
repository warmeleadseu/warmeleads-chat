import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const { customer } = session;

  try {
    const { endpoint, keys } = await request.json();

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Ongeldige push subscription' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        customer_id: customer.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: 'customer_id,endpoint' }
    );

    if (error) {
      return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const { customer } = session;

  try {
    const { endpoint } = await request.json();
    const supabase = createServerClient();

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('customer_id', customer.id)
      .eq('endpoint', endpoint);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
