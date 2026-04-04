import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { sendPushToCustomer } from '@/lib/pushNotification';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { customer_id, title, body, url } = await request.json();

    if (!customer_id || !title || !body) {
      return NextResponse.json({ error: 'customer_id, title en body zijn verplicht' }, { status: 400 });
    }

    const result = await sendPushToCustomer(customer_id, {
      title,
      body,
      url: url || '/portal',
      tag: 'admin-message',
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Admin push error:', err);
    return NextResponse.json({ error: 'Push versturen mislukt' }, { status: 500 });
  }
}
