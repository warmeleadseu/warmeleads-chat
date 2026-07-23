import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { getNextInvoiceNumber, sendCreditNoteEmail } from '@/lib/invoice';
import { sanitizeInvoiceWritePayload, invoicesHaveCreditNoteOfColumn } from '@/lib/customerCountrySupport';

type LineItem = { description: string; quantity: number; unit_price: number; total: number };

/**
 * Maakt een creditnota (gespiegelde negatieve factuur) gekoppeld aan een bestaande
 * factuur: eigen factuurnummer, negatieve bedragen, zelfde vat_mode + klant-snapshot.
 * Mailt de klant en verwijst in de PDF naar de originele factuur.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await params;
  const supabase = createServerClient();

  const { data: original } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (!original) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase
      .from('customers')
      .select('id')
      .eq('id', original.customer_id)
      .eq('account_manager_id', admin.id)
      .single();
    if (!myCust) return forbidden();
  }

  if (original.status === 'credit_note') {
    return NextResponse.json({ error: 'Een creditnota kan zelf niet worden gecrediteerd' }, { status: 400 });
  }

  // Voorkom dubbele creditnota's voor dezelfde factuur (wanneer de kolom bestaat).
  if (await invoicesHaveCreditNoteOfColumn(supabase)) {
    const { data: existingCredit } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('credit_note_of', id)
      .limit(1)
      .maybeSingle();
    if (existingCredit) {
      return NextResponse.json(
        { error: `Er bestaat al een creditnota (${existingCredit.invoice_number}) voor deze factuur` },
        { status: 409 },
      );
    }
  }

  const neg = (n: unknown) => -Math.abs(Number(n) || 0);

  const originalItems: LineItem[] = Array.isArray(original.line_items) ? original.line_items : [];
  const creditItems: LineItem[] = originalItems.length > 0
    ? originalItems.map(it => ({
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unit_price: neg(it.unit_price),
        total: neg(it.total),
      }))
    : [{ description: original.description, quantity: 1, unit_price: neg(original.subtotal), total: neg(original.subtotal) }];

  const creditNumber = await getNextInvoiceNumber(supabase);
  const nowIso = new Date().toISOString();

  const payload = await sanitizeInvoiceWritePayload(supabase, {
    invoice_number: creditNumber,
    customer_id: original.customer_id,
    customer_name: original.customer_name,
    customer_email: original.customer_email,
    customer_address: original.customer_address,
    customer_kvk: original.customer_kvk ?? null,
    customer_vat_id: original.customer_vat_id,
    description: `Creditnota bij ${original.invoice_number}: ${original.description}`,
    line_items: creditItems,
    subtotal: neg(original.subtotal),
    btw_percentage: Number(original.btw_percentage) || 0,
    btw_amount: neg(original.btw_amount),
    total_incl_btw: neg(original.total_incl_btw),
    vat_mode: original.vat_mode === 'reverse_charge_be' ? 'reverse_charge_be' : 'domestic_nl',
    status: 'credit_note',
    paid_at: nowIso,
    credit_note_of: original.id,
  });

  const { data: creditNote, error: insertErr } = await supabase
    .from('invoices')
    .insert(payload)
    .select()
    .single();

  if (insertErr || !creditNote) {
    return NextResponse.json({ error: insertErr?.message || 'Creditnota aanmaken mislukt' }, { status: 500 });
  }

  if (original.customer_email?.trim()) {
    try {
      await sendCreditNoteEmail(
        { name: original.customer_name, email: original.customer_email },
        creditNote,
        original.invoice_number,
      );
    } catch (e) {
      console.error('[admin/invoices/credit-note] mail mislukt:', e);
    }
  }

  return NextResponse.json(creditNote, { status: 201 });
}
