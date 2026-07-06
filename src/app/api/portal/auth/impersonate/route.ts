import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { jwtVerify } from 'jose';
import { getSessionSecretKey } from '@/lib/sessionSecrets';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';
import { signPortalImpersonationSession } from '@/lib/portalSession';
import { qualifiesBelgiumReverseCharge } from '@/lib/invoiceVat';
import { logAudit } from '@/lib/audit';

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
      .select('id, name, email, contact_person, branches, portal_active, demo_mode, signup_source, country, vat_id')
      .eq('id', payload.customer_id as string)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
    }

    const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, customer.id);
    const show_demo_portal = shouldUseDemoPortalExperience({
      signup_source: customer.signup_source,
      demo_mode: customer.demo_mode,
      hasPaidCustomerBatch,
    });

    const adminId = typeof payload.admin_id === 'string' ? payload.admin_id : null;
    // Impersonatie-sessie draagt het admin-id (imp-claim) en heeft een korte TTL.
    const portalJwt = await signPortalImpersonationSession(customer.id, adminId ?? 'unknown');
    const billingCountry = (customer.country as string | null | undefined) ?? 'NL';
    const reverse_charge = qualifiesBelgiumReverseCharge({ country: billingCountry, vat_id: customer.vat_id });

    logAudit({
      adminId,
      adminName: typeof payload.admin_name === 'string' ? payload.admin_name : null,
      action: 'customer.impersonate_session_started',
      entityType: 'customer',
      entityId: customer.id,
      details: { customer_name: customer.name },
    }).catch(() => {});

    // BEWUST géén sessie-cookie zetten: impersonatie is volledig per-tab. De client
    // bewaart onderstaand token in sessionStorage en stuurt het als
    // X-Impersonate-Token mee bij elke aanvraag. Zo kan een admin tegelijk het
    // klantportaal én ons eigen portaal (evt. via echte login) open hebben zonder
    // dat de browserbrede cookie de sessies door elkaar haalt.
    return NextResponse.json({
      success: true,
      customer: {
        ...customer,
        country: billingCountry,
        reverse_charge,
        show_demo_portal,
        has_paid_customer_batch: hasPaidCustomerBatch,
      },
      portal_token: portalJwt,
      impersonation: {
        admin_id: payload.admin_id,
        admin_name: payload.admin_name,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Token ongeldig of verlopen' }, { status: 403 });
  }
}
