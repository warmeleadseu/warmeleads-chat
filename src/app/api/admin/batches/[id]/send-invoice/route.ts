import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { createInvoice, resendOpenInvoiceWithPaymentLinks } from '@/lib/invoice';

/**
 * Stuurt (of verstuurt opnieuw) een open factuur met Mollie-betaallink + e-mail.
 * Voor onbetaalde lead-batches (incl. grote / bulk-volumes), bediend vanuit admin door AM of superadmin.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id: batchId } = await params;
  const supabase = createServerClient();

  const { data: batch, error: bErr } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, price_per_lead, total_price, is_paid, batch_kind, niche_title')
    .eq('id', batchId)
    .single();

  if (bErr || !batch) {
    return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
  }

  if (batch.is_paid) {
    return NextResponse.json({ error: 'Deze batch is al betaald' }, { status: 400 });
  }

  if (admin.role === 'accountmanager') {
    const { data: ok } = await supabase
      .from('customers')
      .select('id')
      .eq('id', batch.customer_id)
      .eq('account_manager_id', admin.id)
      .single();
    if (!ok) {
      return NextResponse.json({ error: 'Geen toegang tot deze klant' }, { status: 403 });
    }
  }

  if (!batch.price_per_lead || !batch.total_price) {
    return NextResponse.json({ error: 'Geen geldige prijs op deze batch' }, { status: 400 });
  }

  const { data: existingOpen } = await supabase
    .from('invoices')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'open')
    .maybeSingle();

  let invoiceId: string;

  if (existingOpen) {
    invoiceId = existingOpen.id;
    await resendOpenInvoiceWithPaymentLinks(invoiceId);
  } else {
    const { data: br } = await supabase.from('branches').select('name').eq('slug', batch.branch).single();
    const isResearch = batch.batch_kind === 'niche_research';
    const nicheTitle =
      typeof batch.niche_title === 'string' && batch.niche_title.trim() ? batch.niche_title.trim() : null;
    const created = await createInvoice({
      customer_id: batch.customer_id,
      batch_id: batch.id,
      branch_name: br?.name || batch.branch,
      batch_size: batch.batch_size,
      price_per_lead: Number(batch.price_per_lead),
      total_price: Number(batch.total_price),
      status: 'open',
      ...(isResearch
        ? { invoice_product: 'niche_research' as const, niche_title: nicheTitle }
        : {}),
    });
    invoiceId = created.id;
  }

  return NextResponse.json({ success: true, invoice_id: invoiceId });
}
