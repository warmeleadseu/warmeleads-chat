import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';
import type { ClientPortalUser, PortalCustomer } from '@/app/portal/portalContext';
import { qualifiesBelgiumReverseCharge } from '@/lib/invoiceVat';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, branches, demo_mode, signup_source, country, vat_id')
    .eq('id', session.customer.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: 'Kon sessie niet laden' }, { status: 500 });
  }

  const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, session.customer.id);
  const show_demo_portal = shouldUseDemoPortalExperience({
    signup_source: row.signup_source,
    demo_mode: row.demo_mode,
    hasPaidCustomerBatch,
  });

  const billingCountry = (row.country as string | null | undefined) ?? 'NL';
  const reverse_charge = qualifiesBelgiumReverseCharge({
    country: billingCountry,
    vat_id: row.vat_id,
  });
  const customer: PortalCustomer = {
    id: row.id,
    name: row.name,
    email: row.email,
    contact_person: row.contact_person || '',
    branches: row.branches ?? [],
    demo_mode: !!row.demo_mode,
    signup_source: row.signup_source,
    country: billingCountry,
    vat_id: row.vat_id ?? undefined,
    reverse_charge,
    show_demo_portal,
    has_paid_customer_batch: hasPaidCustomerBatch,
  };

  let portalUser: ClientPortalUser | null = null;
  if (session.portalUser) {
    const pu = session.portalUser;
    portalUser = {
      id: pu.id,
      customer_id: pu.customer_id,
      name: pu.name,
      email: pu.email,
      role: pu.role,
      permissions: pu.permissions,
      phone: pu.phone,
    };
  }

  return NextResponse.json({ customer, portal_user: portalUser });
}
