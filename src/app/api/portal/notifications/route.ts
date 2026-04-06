import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select('email_notifications, notification_frequency')
    .eq('id', customer.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Voorkeuren niet gevonden' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    email_notifications: data.email_notifications ?? false,
    notification_frequency: data.notification_frequency ?? 'daily',
  });
}

export async function PUT(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.email_notifications === 'boolean') {
    updates.email_notifications = body.email_notifications;
  }
  if (typeof body.notification_frequency === 'string') {
    const allowed = ['instant', 'daily', 'weekly', 'none'];
    if (allowed.includes(body.notification_frequency)) {
      updates.notification_frequency = body.notification_frequency;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'Geen geldige velden opgegeven' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', customer.id);

  if (error) {
    return NextResponse.json(
      { error: 'Bijwerken mislukt' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...updates });
}
