import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

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

    const supabase = createServerClient();

    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, branches, is_active, portal_active, password_hash, login_count, demo_mode')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Ongeldige inloggegevens' }, { status: 401 });
    }

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

    const { password_hash: _, ...safeCustomer } = customer;

    return NextResponse.json({
      success: true,
      token: customer.id,
      customer: safeCustomer,
    });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
