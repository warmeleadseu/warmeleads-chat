import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { getCustomerScope } from '@/lib/permissions';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customer_id');

  const supabase = createServerClient();
  let q = supabase
    .from('portal_users')
    .select('id, customer_id, name, email, role, is_active')
    .order('name', { ascending: true });

  // AM-scoping: accountmanagers zien alleen portaal-gebruikers van hun klanten.
  const scope = await getCustomerScope(admin);
  if (scope.scoped) {
    if (scope.customerIds.length === 0) return NextResponse.json({ users: [] });
    if (customerId && !scope.customerIds.includes(customerId)) return forbidden();
    q = q.in('customer_id', customerId ? [customerId] : scope.customerIds);
  } else if (customerId) {
    q = q.eq('customer_id', customerId);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 });
  return NextResponse.json({ users: data || [] });
}
