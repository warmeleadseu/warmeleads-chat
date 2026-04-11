import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select('name, contact_person, email, phone, branches, email_notifications, notification_frequency, created_at, account_manager_id')
    .eq('id', customer.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Kon accountgegevens niet ophalen' }, { status: 500 });
  }

  let accountManager = null;
  if (data.account_manager_id) {
    const { data: am } = await supabase
      .from('admin_users')
      .select('id, name, email, phone, title, avatar_url')
      .eq('id', data.account_manager_id)
      .eq('is_active', true)
      .single();
    if (am) accountManager = am;
  }

  const { account_manager_id: _amId, ...customerData } = data;
  return NextResponse.json({ customer: customerData, account_manager: accountManager });
}

export async function PUT(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  try {
    const body = await request.json();
    const { current_password, new_password, email_notifications, notification_frequency } = body;

    const supabase = createServerClient();

    if (current_password && new_password) {
      const { data: existing } = await supabase
        .from('customers')
        .select('password_hash')
        .eq('id', customer.id)
        .single();

      if (!existing?.password_hash) {
        return NextResponse.json({ error: 'Geen wachtwoord ingesteld' }, { status: 400 });
      }

      const valid = await bcrypt.compare(current_password, existing.password_hash);
      if (!valid) {
        return NextResponse.json({ error: 'Huidig wachtwoord is onjuist' }, { status: 401 });
      }

      const hash = await bcrypt.hash(new_password, 12);
      const { error: pwError } = await supabase
        .from('customers')
        .update({ password_hash: hash, portal_password: hash })
        .eq('id', customer.id);

      if (pwError) {
        return NextResponse.json({ error: 'Wachtwoord bijwerken mislukt' }, { status: 500 });
      }
    }

    if (email_notifications !== undefined || notification_frequency !== undefined) {
      const updates: Record<string, unknown> = {};
      if (email_notifications !== undefined) updates.email_notifications = email_notifications;
      if (notification_frequency !== undefined) updates.notification_frequency = notification_frequency;

      const { error: notifError } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customer.id);

      if (notifError) {
        return NextResponse.json({ error: 'Voorkeuren bijwerken mislukt' }, { status: 500 });
      }
    }

    const { data: updated } = await supabase
      .from('customers')
      .select('name, contact_person, email, phone, branches, email_notifications, notification_frequency, created_at')
      .eq('id', customer.id)
      .single();

    return NextResponse.json({ customer: updated });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
