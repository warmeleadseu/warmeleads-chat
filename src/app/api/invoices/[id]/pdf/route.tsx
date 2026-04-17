import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin } from '@/lib/adminAuth';
import { verifyCustomer } from '@/lib/portalAuth';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdf, type InvoiceData } from '@/lib/invoicePdf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServerClient();

  // Auth: admin or owning customer
  const admin = await verifyAdmin(request);
  const session = !admin ? await verifyCustomer(request) : null;

  if (!admin && !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase.from('invoices').select('*').eq('id', id);
  if (session) query = query.eq('customer_id', session.customer.id);
  const { data: invoice } = await query.single();

  if (!invoice) {
    return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });
  }

  // Serve uploaded PDF if available
  if (invoice.uploaded_pdf_path) {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('invoices')
      .download(invoice.uploaded_pdf_path);

    if (!dlErr && fileData) {
      const arrayBuf = await fileData.arrayBuffer();
      return new NextResponse(new Uint8Array(arrayBuf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }
  }

  // Get company details
  const keys = [
    'company_name', 'company_address', 'company_postcode', 'company_city',
    'company_kvk', 'company_btw', 'company_iban', 'company_email',
  ];
  const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', keys);
  const map: Record<string, string> = {};
  (settings || []).forEach(r => { map[r.key] = r.value || ''; });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';

  const invoiceData: InvoiceData = {
    invoice_number: invoice.invoice_number,
    created_at: invoice.created_at,
    paid_at: invoice.paid_at,

    logo_url: `${siteUrl}/warmeleads-logo-2026.png`,
    company_name: map.company_name || 'WarmeLeads',
    company_address: map.company_address || '',
    company_postcode: map.company_postcode || '',
    company_city: map.company_city || '',
    company_kvk: map.company_kvk || '',
    company_btw: map.company_btw || '',
    company_iban: map.company_iban || '',
    company_email: map.company_email || 'info@warmeleads.eu',

    customer_name: invoice.customer_name,
    customer_email: invoice.customer_email,
    customer_address: invoice.customer_address,
    customer_kvk: invoice.customer_kvk || null,
    customer_vat_id: invoice.customer_vat_id,

    description: invoice.description,
    line_items: invoice.line_items || [],
    subtotal: Number(invoice.subtotal),
    btw_percentage: Number(invoice.btw_percentage),
    btw_amount: Number(invoice.btw_amount),
    total_incl_btw: Number(invoice.total_incl_btw),
    mollie_payment_id: invoice.mollie_payment_id,
  };

  const buffer = await renderToBuffer(<InvoicePdf data={invoiceData} />);
  const uint8 = new Uint8Array(buffer);

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
