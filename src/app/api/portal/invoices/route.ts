import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, description, subtotal, btw_percentage, btw_amount, total_incl_btw, status, paid_at, created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Kon facturen niet ophalen' }, { status: 500 });

  return NextResponse.json(data || []);
}
