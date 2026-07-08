import { createServerClient } from '@/lib/supabase';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePdf, type InvoiceData } from '@/lib/invoicePdf';

type Supa = ReturnType<typeof createServerClient>;

const COMPANY_SETTING_KEYS = [
  'company_name', 'company_address', 'company_postcode', 'company_city',
  'company_kvk', 'company_btw', 'company_iban', 'company_email',
];

/** Bedrijfsgegevens (afzender) uit app_settings — één keer ophalen, hergebruiken bij bulk. */
export async function loadCompanySettings(supabase: Supa): Promise<Record<string, string>> {
  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', COMPANY_SETTING_KEYS);
  const map: Record<string, string> = {};
  (settings || []).forEach(r => { map[r.key] = r.value || ''; });
  return map;
}

/** Bouwt de `InvoiceData` voor de PDF-renderer uit een `invoices`-rij. */
export function buildInvoiceData(
  invoice: Record<string, unknown>,
  companyMap: Record<string, string>,
  opts?: { creditedInvoiceNumber?: string | null },
): InvoiceData {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  const creditNoteOf = (invoice.credit_note_of as string | null | undefined) ?? null;
  const isCreditNote = invoice.status === 'credit_note' || !!creditNoteOf;

  return {
    invoice_number: invoice.invoice_number as string,
    created_at: invoice.created_at as string,
    paid_at: (invoice.paid_at as string | null) ?? null,

    logo_url: `${siteUrl}/warmeleads-logo-2026.png`,
    company_name: companyMap.company_name || 'WarmeLeads',
    company_address: companyMap.company_address || '',
    company_postcode: companyMap.company_postcode || '',
    company_city: companyMap.company_city || '',
    company_kvk: companyMap.company_kvk || '',
    company_btw: companyMap.company_btw || '',
    company_iban: companyMap.company_iban || '',
    company_email: companyMap.company_email || 'info@warmeleads.eu',

    customer_name: invoice.customer_name as string,
    customer_email: invoice.customer_email as string,
    customer_address: invoice.customer_address as string,
    customer_kvk: (invoice.customer_kvk as string | null) || null,
    customer_vat_id: (invoice.customer_vat_id as string | null) ?? null,

    description: invoice.description as string,
    line_items: (invoice.line_items as InvoiceData['line_items']) || [],
    subtotal: Number(invoice.subtotal),
    btw_percentage: Number(invoice.btw_percentage),
    btw_amount: Number(invoice.btw_amount),
    total_incl_btw: Number(invoice.total_incl_btw),
    vat_mode: (invoice.vat_mode as string) === 'reverse_charge_be' ? 'reverse_charge_be' : 'domestic_nl',
    mollie_payment_id: (invoice.mollie_payment_id as string | null) ?? null,
    is_credit_note: isCreditNote,
    credited_invoice_number: opts?.creditedInvoiceNumber ?? null,
  };
}

/**
 * PDF-bytes voor een factuur: geüploade PDF indien aanwezig, anders gerenderd.
 * Herbruikbaar voor de losse download-route én de bulk-zip-export.
 */
export async function getInvoicePdfBytes(
  supabase: Supa,
  invoice: Record<string, unknown>,
  companyMap: Record<string, string>,
): Promise<Uint8Array> {
  const uploadedPath = invoice.uploaded_pdf_path as string | null | undefined;
  if (uploadedPath) {
    const { data: fileData, error } = await supabase.storage.from('invoices').download(uploadedPath);
    if (!error && fileData) {
      const arrayBuf = await fileData.arrayBuffer();
      return new Uint8Array(arrayBuf);
    }
  }

  let creditedInvoiceNumber: string | null = null;
  const creditNoteOf = (invoice.credit_note_of as string | null | undefined) ?? null;
  if (creditNoteOf) {
    const { data: orig } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('id', creditNoteOf)
      .maybeSingle();
    creditedInvoiceNumber = orig?.invoice_number ?? null;
  }

  const invoiceData = buildInvoiceData(invoice, companyMap, { creditedInvoiceNumber });
  const buffer = await renderToBuffer(<InvoicePdf data={invoiceData} />);
  return new Uint8Array(buffer);
}
