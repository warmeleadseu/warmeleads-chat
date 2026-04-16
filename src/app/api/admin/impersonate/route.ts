import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { SignJWT } from 'jose';

const SECRET = new TextEncoder().encode(process.env.CRON_SECRET || 'fallback-impersonate-key');
const ISSUER = 'warmeleads-admin';
const EXPIRY = '1h';

export async function POST(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const { customer_id } = await request.json();
  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: customer, error } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, branches, portal_active')
    .eq('id', customer_id)
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }

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
    .sign(SECRET);

  return NextResponse.json({ token });
}
