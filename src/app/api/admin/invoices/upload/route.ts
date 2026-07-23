import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const formData = await request.formData();

  const file = formData.get('file') as File | null;
  const invoiceId = formData.get('invoice_id') as string | null;

  if (!file || !invoiceId) {
    return NextResponse.json({ error: 'Bestand en factuur-ID zijn verplicht' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Alleen PDF-bestanden zijn toegestaan' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Bestand mag maximaal 10MB zijn' }, { status: 400 });
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, uploaded_pdf_path, customer_id')
    .eq('id', invoiceId)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });
  }

  if (admin.role === 'accountmanager' && invoice.customer_id) {
    const { data: cust } = await supabase.from('customers').select('id').eq('id', invoice.customer_id).or(amCustomerAccessOrFilter(admin.id)).single();
    if (!cust) return forbidden();
  }

  // Remove old file if exists
  if (invoice.uploaded_pdf_path) {
    await supabase.storage.from('invoices').remove([invoice.uploaded_pdf_path]);
  }

  const ext = 'pdf';
  const path = `${invoiceId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from('invoices')
    .upload(path, arrayBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: `Upload mislukt: ${uploadErr.message}` }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from('invoices')
    .update({ uploaded_pdf_path: path })
    .eq('id', invoiceId);

  if (updateErr) {
    return NextResponse.json({ error: `Factuur bijwerken mislukt: ${updateErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ path });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { invoice_id } = await request.json();

  if (!invoice_id) {
    return NextResponse.json({ error: 'invoice_id is verplicht' }, { status: 400 });
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('uploaded_pdf_path, customer_id')
    .eq('id', invoice_id)
    .single();

  if (!invoice?.uploaded_pdf_path) {
    return NextResponse.json({ error: 'Geen geüpload bestand gevonden' }, { status: 404 });
  }

  if (admin.role === 'accountmanager' && invoice.customer_id) {
    const { data: cust } = await supabase.from('customers').select('id').eq('id', invoice.customer_id).or(amCustomerAccessOrFilter(admin.id)).single();
    if (!cust) return forbidden();
  }

  await supabase.storage.from('invoices').remove([invoice.uploaded_pdf_path]);

  await supabase
    .from('invoices')
    .update({ uploaded_pdf_path: null })
    .eq('id', invoice_id);

  return NextResponse.json({ ok: true });
}
