import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { buildOpenInvoiceEmailContent } from '@/lib/invoice';
import { ensureInvoiceMollieCheckout } from '@/lib/invoiceCheckout';
import { computeInvoiceVat } from '@/lib/invoiceVat';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

/**
 * Preview-variant van `POST /api/admin/batches/[id]/send-invoice`.
 *
 * - Bestaat er al een open factuur voor deze batch? → bouwt de exacte mail die
 *   `resendOpenInvoiceWithPaymentLinks` zou versturen (incl. Mollie-checkoutlink).
 * - Geen open factuur? → simuleert hoe de mail eruit zou zien als de factuur ná
 *   bevestiging wordt aangemaakt: zelfde subject/HTML-template, met een
 *   placeholder-factuurnummer en BTW-bedragen op basis van klant + batch.
 *
 * Geeft géén factuur uit en stuurt geen mail. Bij "Verzenden" in de admin-UI
 * wordt de bestaande POST-route gebruikt die wél persisteert + verstuurt.
 */
export async function GET(
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
      .or(amCustomerAccessOrFilter(admin.id))
      .single();
    if (!ok) {
      return NextResponse.json({ error: 'Geen toegang tot deze klant' }, { status: 403 });
    }
  }

  if (!batch.price_per_lead || !batch.total_price) {
    return NextResponse.json({ error: 'Geen geldige prijs op deze batch' }, { status: 400 });
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, vat_id, country')
    .eq('id', batch.customer_id)
    .single();

  if (custErr || !customer) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }
  if (!customer.email) {
    return NextResponse.json({ error: 'Klant heeft geen e-mailadres' }, { status: 400 });
  }

  const { data: branchRow } = await supabase
    .from('branches')
    .select('slug, name')
    .eq('slug', batch.branch)
    .single();
  const branchName = branchRow?.name || batch.branch;

  const { data: existingOpen } = await supabase
    .from('invoices')
    .select('id, invoice_number, description, customer_id, total_incl_btw, mollie_payment_id, vat_mode')
    .eq('batch_id', batchId)
    .eq('status', 'open')
    .maybeSingle();

  let invoiceShape: {
    id: string;
    invoice_number: string;
    description: string;
    total_incl_btw: number;
    vat_mode: string;
  };
  let directCheckoutUrl: string | undefined;
  let isSimulated = false;

  if (existingOpen) {
    invoiceShape = {
      id: existingOpen.id,
      invoice_number: existingOpen.invoice_number,
      description: existingOpen.description,
      total_incl_btw: Number(existingOpen.total_incl_btw),
      vat_mode: existingOpen.vat_mode || 'domestic_nl',
    };
    try {
      const ensured = await ensureInvoiceMollieCheckout({
        id: existingOpen.id,
        invoice_number: existingOpen.invoice_number,
        description: existingOpen.description,
        customer_id: existingOpen.customer_id,
        total_incl_btw: Number(existingOpen.total_incl_btw),
        mollie_payment_id: existingOpen.mollie_payment_id,
      });
      directCheckoutUrl = ensured.checkoutUrl;
    } catch {
      /* preview ook bruikbaar zonder Mollie-link */
    }
  } else {
    const subtotal = Number(batch.total_price);
    const vat = computeInvoiceVat({
      subtotalExclBtw: subtotal,
      country: (customer.country as string | null | undefined) ?? 'NL',
      customerVatId: customer.vat_id,
    });
    const isNiche = batch.batch_kind === 'niche_research';
    const isBulk = batch.batch_kind === 'bulk_leads';
    const nicheLabel =
      typeof batch.niche_title === 'string' && batch.niche_title.trim() ? batch.niche_title.trim() : '';
    const description = isNiche
      ? `Onderzoeksbatch niche-onderzoek${nicheLabel ? ` (${nicheLabel})` : ''}`
      : isBulk
        ? `Bulk-leads: ${batch.batch_size} × ${branchName}`
        : `${batch.batch_size} ${branchName} leads`;

    invoiceShape = {
      id: 'preview',
      invoice_number: 'WL-NIEUW (concept)',
      description,
      total_incl_btw: vat.total_incl_btw,
      vat_mode: vat.vat_mode,
    };
    isSimulated = true;
  }

  const content = buildOpenInvoiceEmailContent(customer, invoiceShape, directCheckoutUrl);

  return NextResponse.json({
    subject: content.subject,
    html: content.html,
    to: content.to,
    summary: {
      ...content.summary,
      is_simulated: isSimulated,
    },
  });
}
