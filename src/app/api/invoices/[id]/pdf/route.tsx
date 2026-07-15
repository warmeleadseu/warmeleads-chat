import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin } from '@/lib/adminAuth';
import { verifyCustomer } from '@/lib/portalAuth';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { loadCompanySettings, getInvoicePdfBytes } from '@/lib/invoicePdfRender';

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
  if (session && !hasPermission(session, PERMISSIONS.INVOICES_VIEW)) {
    return forbidden();
  }

  let query = supabase.from('invoices').select('*').eq('id', id);
  if (session) query = query.eq('customer_id', session.customer.id);
  const { data: invoice } = await query.single();

  if (!invoice) {
    return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });
  }

  const companyMap = await loadCompanySettings(supabase);
  const uint8 = await getInvoicePdfBytes(supabase, invoice, companyMap);

  return new NextResponse(Buffer.from(uint8), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
