import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const DEMO_STATUS_DISTRIBUTION: { status: string; notities: string | null }[] = [
  { status: 'nieuw', notities: null },
  { status: 'nieuw', notities: null },
  { status: 'gecontacteerd', notities: 'Terugbellen na 17:00' },
  { status: 'offerte', notities: 'Interesse in 10kWh systeem' },
];

async function ensureDemoLeads(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  branches: string[],
) {
  const { count } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('source', 'demo');

  if (count && count > 0) return;

  const { data: demoLeads } = await supabase
    .from('leads')
    .select('id, branch')
    .eq('bron', 'demo')
    .is('customer_id', null)
    .in('branch', branches);

  if (!demoLeads || demoLeads.length === 0) return;

  const assignments = demoLeads.map((lead, i) => {
    const preset = DEMO_STATUS_DISTRIBUTION[i % DEMO_STATUS_DISTRIBUTION.length];
    return {
      lead_id: lead.id,
      customer_id: customerId,
      batch_id: null,
      distance_km: Math.round((3 + Math.random() * 25) * 10) / 10,
      source: 'demo',
      status: preset.status,
      notities: preset.notities,
    };
  });

  await supabase.from('lead_assignments').insert(assignments);
}

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

      // Re-seed demo leads if customer is in demo mode but has no demo assignments
      if (customer.demo_mode) {
        ensureDemoLeads(supabase, customer.id, customer.branches).catch((e) =>
          console.error('[login] demo re-seed error:', e)
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
