import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import bcrypt from 'bcryptjs';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const { customer } = session;

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select('name, contact_person, email, phone, branches, email_notifications, notification_frequency, created_at, account_manager_id, demo_mode, signup_source')
    .eq('id', customer.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Kon accountgegevens niet ophalen' }, { status: 500 });
  }

  const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, customer.id);
  const show_demo_portal = shouldUseDemoPortalExperience({
    signup_source: data.signup_source,
    demo_mode: data.demo_mode,
    hasPaidCustomerBatch,
  });

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
  return NextResponse.json({
    customer: {
      ...customerData,
      has_paid_customer_batch: hasPaidCustomerBatch,
      show_demo_portal,
    },
    account_manager: accountManager,
  });
}

export async function PUT(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ACCOUNT_EDIT)) return forbidden();

  const { customer } = session;

  try {
    const body = await request.json();
    const { current_password, new_password, email_notifications, notification_frequency } = body;

    const supabase = createServerClient();

    if (current_password && new_password) {
      if (session.portalUser && !session.isOwner) {
        // Portal user (agent/manager) changing their own password
        const { data: existing } = await supabase
          .from('portal_users')
          .select('password_hash')
          .eq('id', session.portalUser.id)
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
          .from('portal_users')
          .update({ password_hash: hash, updated_at: new Date().toISOString() })
          .eq('id', session.portalUser.id);

        if (pwError) {
          return NextResponse.json({ error: 'Wachtwoord bijwerken mislukt' }, { status: 500 });
        }
      } else {
        // Owner changing their password
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
      .select('name, contact_person, email, phone, branches, email_notifications, notification_frequency, created_at, demo_mode, signup_source')
      .eq('id', customer.id)
      .single();

    if (!updated) {
      return NextResponse.json({ error: 'Account niet gevonden' }, { status: 404 });
    }

    const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, customer.id);
    const show_demo_portal = shouldUseDemoPortalExperience({
      signup_source: updated.signup_source,
      demo_mode: updated.demo_mode,
      hasPaidCustomerBatch,
    });

    return NextResponse.json({
      customer: {
        ...updated,
        has_paid_customer_batch: hasPaidCustomerBatch,
        show_demo_portal,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
