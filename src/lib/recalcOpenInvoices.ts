/**
 * Herberekent alle openstaande (status='open') facturen van een klant op basis
 * van de huidige `customers.country` en `customers.vat_id`. Past `vat_mode`,
 * `btw_percentage`, `btw_amount` en `total_incl_btw` aan wanneer de uitkomst
 * afwijkt van wat er nu in de DB staat.
 *
 * Wordt aangeroepen wanneer een admin het land of BTW-nummer van een klant
 * wijzigt, zodat al klaarstaande betaallinks (Mollie) meteen het correcte
 * bedrag krijgen.
 *
 * Bij een verschil wordt ook `mollie_payment_id` op `null` gezet, zodat bij de
 * volgende portaalklik een nieuwe Mollie-sessie wordt aangemaakt met het juiste
 * bedrag (zie `ensureInvoiceMollieCheckout`). Bestaande Mollie-sessies in
 * verzonden e-mails blijven bestaan, maar de portal en de admin tonen vanaf nu
 * het correcte bedrag.
 */
import type { createServerClient } from '@/lib/supabase';
import { computeInvoiceVat } from '@/lib/invoiceVat';
import {
  invoicesHaveVatModeColumn,
  sanitizeInvoiceWritePayload,
} from '@/lib/customerCountrySupport';

type Supabase = ReturnType<typeof createServerClient>;

export type RecalcedInvoiceSummary = {
  id: string;
  invoice_number: string | null;
  previous: {
    vat_mode: string | null;
    btw_amount: number;
    total_incl_btw: number;
  };
  next: {
    vat_mode: 'domestic_nl' | 'reverse_charge_be';
    btw_amount: number;
    total_incl_btw: number;
  };
  mollie_payment_cleared: boolean;
};

export async function recalcOpenInvoicesForCustomer(
  supabase: Supabase,
  customerId: string,
): Promise<RecalcedInvoiceSummary[]> {
  if (!customerId) return [];

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, country, vat_id')
    .eq('id', customerId)
    .maybeSingle();
  if (custErr || !customer) return [];

  type OpenInvoiceRow = {
    id: string;
    invoice_number: string | null;
    subtotal: number | string | null;
    btw_percentage: number | string | null;
    btw_amount: number | string | null;
    total_incl_btw: number | string | null;
    mollie_payment_id: string | null;
    status: string | null;
    vat_mode?: string | null;
  };

  const hasVatMode = await invoicesHaveVatModeColumn(supabase);
  const baseInvoiceCols = 'id, invoice_number, subtotal, btw_percentage, btw_amount, total_incl_btw, mollie_payment_id, status';
  const selectCols = hasVatMode ? `${baseInvoiceCols}, vat_mode` : baseInvoiceCols;

  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select(selectCols)
    .eq('customer_id', customerId)
    .eq('status', 'open')
    .returns<OpenInvoiceRow[]>();
  if (invErr || !Array.isArray(invoices)) return [];

  const results: RecalcedInvoiceSummary[] = [];

  for (const raw of invoices) {
    const subtotal = Number(raw.subtotal ?? 0);
    if (!Number.isFinite(subtotal) || subtotal <= 0) continue;

    const recomputed = computeInvoiceVat({
      subtotalExclBtw: subtotal,
      country: (customer as { country?: string | null }).country ?? 'NL',
      customerVatId: customer.vat_id ?? null,
    });

    const previousBtw = Number(raw.btw_amount ?? 0);
    const previousTotal = Number(raw.total_incl_btw ?? 0);
    const previousVatMode = raw.vat_mode ?? null;

    const totalsDiffer = Math.abs(recomputed.total_incl_btw - previousTotal) > 0.005
      || Math.abs(recomputed.btw_amount - previousBtw) > 0.005;
    const modeDiffers = hasVatMode && previousVatMode !== recomputed.vat_mode;

    if (!totalsDiffer && !modeDiffers) continue;

    const updatePayload = await sanitizeInvoiceWritePayload(supabase, {
      btw_percentage: recomputed.btw_percentage,
      btw_amount: recomputed.btw_amount,
      total_incl_btw: recomputed.total_incl_btw,
      vat_mode: recomputed.vat_mode,
      mollie_payment_id: null,
    });

    const { error: upErr } = await supabase
      .from('invoices')
      .update(updatePayload)
      .eq('id', raw.id)
      .eq('status', 'open');
    if (upErr) {
      console.error('[recalcOpenInvoices] update failed for invoice', raw.id, upErr);
      continue;
    }

    results.push({
      id: raw.id,
      invoice_number: raw.invoice_number,
      previous: {
        vat_mode: previousVatMode,
        btw_amount: previousBtw,
        total_incl_btw: previousTotal,
      },
      next: {
        vat_mode: recomputed.vat_mode,
        btw_amount: recomputed.btw_amount,
        total_incl_btw: recomputed.total_incl_btw,
      },
      mollie_payment_cleared: !!raw.mollie_payment_id,
    });
  }

  return results;
}
