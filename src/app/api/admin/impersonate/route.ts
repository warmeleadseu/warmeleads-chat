import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { SignJWT } from 'jose';
import { getSessionSecretKey } from '@/lib/sessionSecrets';
import { customerVisibleToAm } from '@/lib/permissions';

const ISSUER = 'warmeleads-admin';
// Kort geldig: dit token wordt direct na openen ingewisseld voor een portal-sessie.
const EXPIRY = '3m';

/**
 * Genereert een korte-levensduur impersonate-token waarmee een admin/AM via
 * de "Bekijk portaal"-knop het klantportaal van een specifieke klant opent.
 *
 * Toegang:
 *  - superadmin / admin → elke klant
 *  - accountmanager      → eigen klanten + gedeelde (shared_with_all_ams)
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { customer_id } = await request.json();
  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, branches, portal_active, account_manager_id, shared_with_all_ams')
    .eq('id', customer_id)
    .single();

  if (custError || !customer) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }

  if (admin.role === 'accountmanager' && !customerVisibleToAm(customer, admin.id)) {
    return forbidden();
  }

  const secret = getSessionSecretKey();
  const token = await new SignJWT({
    admin_id: admin.id,
    admin_name: admin.name,
    customer_id: customer.id,
    customer_name: customer.name,
    type: 'impersonate',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret);

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'customer.impersonate',
    entityType: 'customer',
    entityId: customer.id,
    details: { customer_name: customer.name, role: admin.role },
  }).catch(() => {});

  return NextResponse.json({ token });
}
