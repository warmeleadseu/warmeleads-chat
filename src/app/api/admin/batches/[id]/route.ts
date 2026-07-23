import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { adminBatchListSelect, adminBatchListSelectNoBatchTargets, isMissingBatchTargetsError } from '@/lib/adminBatchQueries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  const supabase = createServerClient();

  const [batchRes, ordersRes, invoicesRes] = await Promise.all([
    supabase
      .from('customer_batches')
      .select(adminBatchListSelect)
      .eq('id', id)
      .single(),
    supabase
      .from('batch_orders')
      .select('id, branch, batch_size, price_per_lead, total_price, status, mollie_payment_id, created_at, paid_at')
      .eq('batch_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('id, invoice_number, description, subtotal, btw_percentage, btw_amount, total_incl_btw, status, paid_at, created_at, uploaded_pdf_path')
      .eq('batch_id', id)
      .order('created_at', { ascending: false }),
  ]);

  let batchData = batchRes.data;
  let batchErr = batchRes.error;
  // Fallback: `batch_targets` bestaat nog niet (migratie 144 niet toegepast).
  if (batchErr && isMissingBatchTargetsError(batchErr.message)) {
    const retry = await supabase
      .from('customer_batches')
      .select(adminBatchListSelectNoBatchTargets)
      .eq('id', id)
      .single();
    batchData = retry.data;
    batchErr = retry.error;
  }

  if (batchErr || !batchData) {
    return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
  }

  const batch = batchData;

  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase
      .from('customers')
      .select('id')
      .eq('account_manager_id', admin.id);
    const ids = (myCustomers || []).map(c => c.id);
    if (!ids.includes(batch.customer_id)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }
  }

  return NextResponse.json({
    batch,
    orders: ordersRes.data || [],
    invoices: invoicesRes.data || [],
  });
}
