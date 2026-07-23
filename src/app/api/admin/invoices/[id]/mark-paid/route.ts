import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { notifyCustomerInvoicePaid } from '@/lib/invoice';
import { finalizePaidLeadBatch, finalizePaidBulkLeadBatch } from '@/lib/finalizePaidLeadBatch';
import { isBulkLeadsBatchKind } from '@/lib/batchKind';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

/**
 * Markeert een open factuur handmatig als betaald (bijv. bankoverschrijving).
 * Activeert de gekoppelde (lead-/afspraak-)batch net als de Mollie-webhook en
 * stuurt de klant een betaalbevestiging.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status, customer_id, batch_id, appointment_batch_id, mollie_payment_id')
    .eq('id', id)
    .single();

  if (!invoice) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id')
      .eq('id', invoice.customer_id)
      .or(amCustomerAccessOrFilter(admin.id))
      .single();
    if (!myCust) return forbidden();
  }

  if (invoice.status !== 'open') {
    return NextResponse.json({ error: 'Alleen een openstaande factuur kan als betaald worden gemarkeerd' }, { status: 400 });
  }

  const paymentRef = invoice.mollie_payment_id || `admin-manual-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('id', id)
    .eq('status', 'open')
    .select('*')
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ error: updateErr?.message || 'Markeren als betaald mislukt' }, { status: 500 });
  }

  // Betaalbevestiging mailen (zelfde als Mollie-webhook).
  await notifyCustomerInvoicePaid(updated.id).catch(() => {});

  // Gekoppelde lead-batch activeren + afronden (spiegelt de invoice:-webhook).
  if (invoice.batch_id) {
    const { data: batchClaim } = await supabase
      .from('customer_batches')
      .update({ is_paid: true, mollie_payment_id: paymentRef, status: 'active' })
      .eq('id', invoice.batch_id)
      .eq('is_paid', false)
      .select('id, customer_id, branch, batch_size, price_per_lead, total_price, leads_per_week, leads_per_day, lead_filters, starts_at, lookback_days, batch_kind')
      .single();

    if (batchClaim) {
      try {
        if (isBulkLeadsBatchKind(batchClaim.batch_kind)) {
          await finalizePaidBulkLeadBatch(supabase, batchClaim, paymentRef, { skipInvoiceHandling: true });
        } else {
          await finalizePaidLeadBatch(supabase, batchClaim, paymentRef, { skipInvoiceHandling: true });
        }
      } catch (e) {
        console.error('[admin/invoices/mark-paid] batch finalize failed:', e);
      }
    }
  } else if (invoice.appointment_batch_id) {
    await supabase
      .from('appointment_batches')
      .update({ is_paid: true, mollie_payment_id: paymentRef, status: 'active' })
      .eq('id', invoice.appointment_batch_id)
      .eq('is_paid', false);
  }

  return NextResponse.json({ ok: true, invoice: updated });
}
