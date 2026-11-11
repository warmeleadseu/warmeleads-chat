import { createServerClient } from '@/lib/supabase';
import { createBatchPayment, getPayment } from '@/lib/mollie';
import { factuurBedankUrl, factuurBetaalUrl } from '@/lib/factuurBetaallink';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';

function mollieCheckoutUrl(p: {
  getCheckoutUrl?: () => string;
  _links?: { checkout?: { href?: string } };
}): string {
  if (typeof p.getCheckoutUrl === 'function') return p.getCheckoutUrl();
  const href = p._links?.checkout?.href;
  return typeof href === 'string' ? href : '';
}

export interface InvoiceRowMinimal {
  id: string;
  invoice_number: string;
  description: string;
  customer_id: string;
  total_incl_btw: number;
  mollie_payment_id?: string | null;
}

/**
 * Maakt (of hergebruikt openstaande) Mollie-sessie voor een openstaande factuur.
 * Webhook gebruikt metadata.orderId = "invoice:<uuid>".
 */
export async function ensureInvoiceMollieCheckout(
  invoice: InvoiceRowMinimal,
  opties: {
    /**
     * Waar Mollie na betalen heen stuurt. Standaard het portaal; de betaallink
     * uit de mail stuurt naar een bedankpagina zonder inlog. Een openstaande
     * betaling wordt alleen hergebruikt als hij naar dezelfde plek terugkeert.
     */
    terugUrl?: string;
  } = {},
): Promise<{
  checkoutUrl: string;
  paymentId: string;
}> {
  const supabase = createServerClient();

  if (invoice.mollie_payment_id) {
    try {
      const existing = await getPayment(invoice.mollie_payment_id);
      const openish = ['open', 'pending', 'authorized'].includes(String(existing.status));
      const zelfdeTerug = !opties.terugUrl || (existing as { redirectUrl?: string | null }).redirectUrl === opties.terugUrl;
      const checkoutUrl = mollieCheckoutUrl(existing as { getCheckoutUrl?: () => string; _links?: { checkout?: { href?: string } } });
      if (openish && zelfdeTerug && checkoutUrl) {
        return { checkoutUrl, paymentId: existing.id };
      }
    } catch {
      /* nieuwe betaling aanmaken */
    }
  }

  const { data: cust } = await supabase
    .from('customers')
    .select('id, name, email, country')
    .eq('id', invoice.customer_id)
    .single();

  if (!cust?.email) {
    throw new Error('Klant heeft geen e-mailadres voor betaling');
  }

  const amount = Number(invoice.total_incl_btw);
  if (!amount || amount <= 0) {
    throw new Error('Ongeldig factuurbedrag');
  }

  const payment = await createBatchPayment({
    orderId: `invoice:${invoice.id}`,
    amount,
    description: `WarmeLeads factuur ${invoice.invoice_number}`,
    redirectUrl: opties.terugUrl || `${BASE_URL}/portal/account?tab=invoices&paid=invoice`,
    webhookUrl: `${BASE_URL}/api/webhooks/mollie`,
    customerEmail: cust.email,
    customerName: cust.name,
    kind: 'invoice',
    billingCountry: (cust as { country?: string | null }).country ?? null,
  });

  await supabase
    .from('invoices')
    .update({ mollie_payment_id: payment.id })
    .eq('id', invoice.id);

  const checkoutUrl = mollieCheckoutUrl(payment as { getCheckoutUrl?: () => string; _links?: { checkout?: { href?: string } } });

  if (!checkoutUrl) throw new Error('Geen Mollie checkout-URL');
  return { checkoutUrl, paymentId: payment.id };
}

/**
 * Voor mails: zet een betaling klaar die na betalen naar de bedankpagina gaat,
 * en geeft onze eigen betaallink terug in plaats van de Mollie-link. Die link
 * maakt bij een klik zo nodig een verse betaling, dus hij blijft werken zolang
 * de factuur openstaat, en de klant hoeft nergens in te loggen
 * (src/lib/factuurBetaallink.ts).
 */
export async function ensureFactuurBetaallink(invoice: InvoiceRowMinimal): Promise<{
  checkoutUrl: string;
  paymentId: string;
}> {
  const { paymentId } = await ensureInvoiceMollieCheckout(invoice, { terugUrl: factuurBedankUrl(invoice.id) });
  return { checkoutUrl: factuurBetaalUrl(invoice.id), paymentId };
}
