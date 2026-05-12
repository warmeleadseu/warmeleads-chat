import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { repairDemoAssignmentsIfNeeded } from '@/lib/demoPortalLeads';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';
import { escapeForIlikeExact, pickEmailRow } from '@/lib/emailDbLookup';
import {
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
  signPortalOwnerSession,
  signPortalUserSession,
} from '@/lib/portalSession';
import { qualifiesBelgiumReverseCharge } from '@/lib/invoiceVat';

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
    const emailPattern = escapeForIlikeExact(normalizedEmail);

    const { data: customerRows, error: customerLookupErr } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, branches, is_active, portal_active, password_hash, login_count, demo_mode, signup_source, country, vat_id')
      .ilike('email', emailPattern)
      .limit(5);

    if (customerLookupErr) {
      console.error('[portal-login] customer lookup', customerLookupErr);
      return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
    }

    const customer = pickEmailRow(customerRows || [], normalizedEmail);

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

      const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, customer.id);
      const show_demo_portal = shouldUseDemoPortalExperience({
        signup_source: customer.signup_source,
        demo_mode: customer.demo_mode,
        hasPaidCustomerBatch,
      });
      if (show_demo_portal) {
        repairDemoAssignmentsIfNeeded(supabase, customer.id, customer.branches as string[] | null).catch((e) =>
          console.error('[login] demo repair error:', e),
        );
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

      const { password_hash: _, ...safeCustomer } = customer;
      const billingCountry = (safeCustomer.country as string | null | undefined) ?? 'NL';
      const reverse_charge = qualifiesBelgiumReverseCharge({ country: billingCountry, vat_id: safeCustomer.vat_id });

      const portalJwt = await signPortalOwnerSession(customer.id);
      const res = NextResponse.json({
        success: true,
        customer: {
          ...safeCustomer,
          country: billingCountry,
          reverse_charge,
          show_demo_portal,
          has_paid_customer_batch: hasPaidCustomerBatch,
        },
        is_portal_user: false,
      });
      res.cookies.set(PORTAL_SESSION_COOKIE, portalJwt, portalSessionCookieOptions());
      return res;
    }

    // 2. Try portal_users (agent/manager) login
    const { data: portalUserRows, error: portalUserLookupErr } = await supabase
      .from('portal_users')
      .select('id, customer_id, name, email, role, is_active, permissions, assignment_rules, password_hash, login_count, phone, created_at')
      .ilike('email', emailPattern)
      .limit(5);

    if (portalUserLookupErr) {
      console.error('[portal-login] portal_user lookup', portalUserLookupErr);
      return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
    }

    const portalUser = pickEmailRow(portalUserRows || [], normalizedEmail);

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
      .select('id, name, email, contact_person, branches, is_active, portal_active, demo_mode, signup_source, country, vat_id')
      .eq('id', portalUser.customer_id)
      .eq('is_active', true)
      .eq('portal_active', true)
      .single();

    if (!parentCustomer) {
      return NextResponse.json({ error: 'Het bedrijfsaccount is niet meer actief' }, { status: 403 });
    }

    const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, portalUser.customer_id);
    const show_demo_portal = shouldUseDemoPortalExperience({
      signup_source: parentCustomer.signup_source,
      demo_mode: parentCustomer.demo_mode,
      hasPaidCustomerBatch,
    });
    if (show_demo_portal) {
      repairDemoAssignmentsIfNeeded(supabase, portalUser.customer_id, parentCustomer.branches as string[] | null).catch(
        (e) => console.error('[login] demo repair error (agent):', e),
      );
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
    const billingCountryParent = (safeParent.country as string | null | undefined) ?? 'NL';
    const reverse_charge = qualifiesBelgiumReverseCharge({ country: billingCountryParent, vat_id: safeParent.vat_id });

    const portalJwt = await signPortalUserSession(portalUser.id, portalUser.customer_id);
    const res = NextResponse.json({
      success: true,
      customer: {
        ...safeParent,
        country: billingCountryParent,
        demo_mode,
        reverse_charge,
        show_demo_portal,
        has_paid_customer_batch: hasPaidCustomerBatch,
      },
      portal_user: safePortalUser,
      is_portal_user: true,
    });
    res.cookies.set(PORTAL_SESSION_COOKIE, portalJwt, portalSessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
