import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const { customer } = session;

  try {
    const { subscription } = await request.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Ongeldige subscription data' }, { status: 400 });
    }

    const supabase = createServerClient();

    await supabase.from('push_subscriptions').upsert({
      customer_id: customer.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    }, { onConflict: 'customer_id,endpoint' });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const { customer } = session;

  try {
    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();
    await supabase.from('push_subscriptions').delete()
      .eq('customer_id', customer.id)
      .eq('endpoint', endpoint);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 });
  }
}
