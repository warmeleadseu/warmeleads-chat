import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { loadCompanySettings, getInvoicePdfBytes } from '@/lib/invoicePdfRender';

/** Bovengrens: voorkomt time-outs bij het serverside renderen van te veel PDF's. */
export const MAX_ZIP_INVOICES = 200;

export const maxDuration = 300;

function safeFilePart(raw: string | null | undefined): string {
  return String(raw || 'factuur').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'factuur';
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json().catch(() => ({}));
  const rawIds = Array.isArray(body?.ids) ? body.ids : [];
  const ids = [...new Set(rawIds.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0))];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Geen facturen geselecteerd.' }, { status: 400 });
  }
  if (ids.length > MAX_ZIP_INVOICES) {
    return NextResponse.json(
      { error: `Te veel facturen (${ids.length}). Verfijn de filters — maximaal ${MAX_ZIP_INVOICES} per download.` },
      { status: 400 },
    );
  }

  let query = supabase.from('invoices').select('*').in('id', ids);
  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    const custIds = (myCustomers || []).map(c => c.id);
    if (custIds.length === 0) return NextResponse.json({ error: 'Geen toegang tot deze facturen.' }, { status: 403 });
    query = query.in('customer_id', custIds);
  }

  const { data: invoices, error } = await query.order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Kon facturen niet ophalen.' }, { status: 500 });
  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ error: 'Geen facturen gevonden.' }, { status: 404 });
  }

  const companyMap = await loadCompanySettings(supabase);
  const zip = new JSZip();
  const usedNames = new Set<string>();
  let added = 0;
  const failed: string[] = [];

  for (const invoice of invoices) {
    try {
      const bytes = await getInvoicePdfBytes(supabase, invoice, companyMap);
      let name = `${safeFilePart(invoice.invoice_number)}.pdf`;
      let n = 2;
      while (usedNames.has(name)) {
        name = `${safeFilePart(invoice.invoice_number)}-${n}.pdf`;
        n++;
      }
      usedNames.add(name);
      zip.file(name, bytes);
      added++;
    } catch (e) {
      console.error('[invoices/export-zip] render failed for', invoice.invoice_number, e);
      failed.push(invoice.invoice_number || invoice.id);
    }
  }

  if (added === 0) {
    return NextResponse.json({ error: 'Kon geen enkele factuur-PDF genereren.' }, { status: 500 });
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `facturen-${stamp}.zip`;

  return new NextResponse(Buffer.from(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Invoices-Added': String(added),
      'X-Invoices-Failed': String(failed.length),
    },
  });
}
