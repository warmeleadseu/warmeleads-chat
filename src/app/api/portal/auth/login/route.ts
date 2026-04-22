import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { repairDemoAssignmentsIfNeeded } from '@/lib/demoPortalLeads';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited, response } = rateLimit(ip, 'portal-login', MAX_ATTEMPTS, WINDOW_MS);
    if (limited) return response!;

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail en wachtwoord zijn verplicht' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = createServerClient();

    // 1. Try customer (owner) login first
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, branches, is_active, portal_active, password_hash, login_count, demo_mode')
      .eq('email', normalizedEmail)
      .single();

    if (customer) {
      if (!customer.is_active) {
        return NextResponse.json({ error: 'Dit account is gedeactiveerd' }, { status: 403 });
      }
      if (!customer.portal_active) {
        return NextResponse.json({ error: 'Het portaal is niet actief voor dit account' }, { status: 403 });
      }
      if (!customer.password_hash) {
        return NextResponse.json({ error: 'Er is nog geen portaalwachtwoord ingesteld. Neem contact op met Warme Leads.' }, { status: 403 });
      }

      const passwordMatch = await bcrypt.compare(password, customer.password_hash);
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Ongeldige inloggegevens' }, { status: 401 });
      }

      const now = new Date().toISOString();
      supabase
        .from('customers')
        .update({
          last_login_at: now,
          last_seen_at: now,
          login_count: (customer.login_count || 0) + 1,
        })
        .eq('id', customer.id)
        .then(() => {});

      if (customer.demo_mode) {
        repairDemoAssignmentsIfNeeded(supabase, customer.id, customer.branches as string[] | null).catch((e) =>
          console.error('[login] demo repair error:', e)
        );
      }

      const { password_hash: _, ...safeCustomer } = customer;

      return NextResponse.json({
        success: true,
        token: customer.id,
        customer: safeCustomer,
        is_portal_user: false,
      });
    }

    // 2. Try portal_users (agent/manager) login
    const { data: portalUser } = await supabase
      .from('portal_users')
      .select('id, customer_id, name, email, role, is_active, permissions, assignment_rules, password_hash, login_count, phone, created_at')
      .eq('email', normalizedEmail)
      .single();

    if (!portalUser) {
      return NextResponse.json({ error: 'Ongeldige inloggegevens' }, { status: 401 });
    }

    if (!portalUser.is_active) {
      return NextResponse.json({ error: 'Dit account is gedeactiveerd. Neem contact op met je teamleider.' }, { status: 403 });
    }

    const agentMatch = await bcrypt.compare(password, portalUser.password_hash);
    if (!agentMatch) {
      return NextResponse.json({ error: 'Ongeldige inloggegevens' }, { status: 401 });
    }

    // Verify parent customer is still active
    const { data: parentCustomer } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, branches, is_active, portal_active, demo_mode')
      .eq('id', portalUser.customer_id)
      .eq('is_active', true)
      .eq('portal_active', true)
      .single();

    if (!parentCustomer) {
      return NextResponse.json({ error: 'Het bedrijfsaccount is niet meer actief' }, { status: 403 });
    }

    const now = new Date().toISOString();
    supabase
      .from('portal_users')
      .update({
        last_login_at: now,
        last_seen_at: now,
        login_count: (portalUser.login_count || 0) + 1,
      })
      .eq('id', portalUser.id)
      .then(() => {});

    const { password_hash: __, ...safePortalUser } = portalUser;
    const { demo_mode, ...safeParent } = parentCustomer;

    return NextResponse.json({
      success: true,
      token: portalUser.id,
      customer: { ...safeParent, demo_mode },
      portal_user: safePortalUser,
      is_portal_user: true,
    });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
