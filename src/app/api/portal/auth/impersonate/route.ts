import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { jwtVerify } from 'jose';
import { getSessionSecretKey } from '@/lib/sessionSecrets';
import {
  PORTAL_SESSION_COOKIE,
  portalSessionCookieOptions,
  signPortalOwnerSession,
} from '@/lib/portalSession';

const ISSUER = 'warmeleads-admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token ontbreekt' }, { status: 400 });
    }

    const secret = getSessionSecretKey();
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });

    if (payload.type !== 'impersonate' || !payload.customer_id) {
      return NextResponse.json({ error: 'Ongeldig token type' }, { status: 403 });
    }

    const supabase = createServerClient();
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, branches, portal_active, demo_mode, signup_source')
      .eq('id', payload.customer_id as string)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
    }

    const portalJwt = await signPortalOwnerSession(customer.id);
    const res = NextResponse.json({
      success: true,
      customer,
      impersonation: {
        admin_id: payload.admin_id,
        admin_name: payload.admin_name,
      },
    });
    res.cookies.set(PORTAL_SESSION_COOKIE, portalJwt, portalSessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: 'Token ongeldig of verlopen' }, { status: 403 });
  }
}
