import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_VIEW)) return forbidden();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('appointment_batches')
    .select('*')
    .eq('customer_id', session.customer.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Kon batches niet ophalen' }, { status: 500 });
  return NextResponse.json(data || []);
}
