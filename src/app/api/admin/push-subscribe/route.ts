import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

/**
 * Pushmeldingen in het admin-paneel (migratie 203), voor terugbelafspraken met
 * prospects. Eén browser hoort bij de admin die er het laatst mee werkte.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { subscription } = (await request.json().catch(() => ({}))) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return NextResponse.json({ error: 'Ongeldige aanmelding' }, { status: 400 });
  }
  const supabase = createServerClient();
  const { error } = await supabase
    .from('admin_push_subscriptions')
    .upsert({ admin_user_id: admin.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof endpoint !== 'string' || !endpoint) return NextResponse.json({ error: 'Endpoint is verplicht' }, { status: 400 });
  const supabase = createServerClient();
  await supabase.from('admin_push_subscriptions').delete().eq('admin_user_id', admin.id).eq('endpoint', endpoint);
  return NextResponse.json({ success: true });
}
