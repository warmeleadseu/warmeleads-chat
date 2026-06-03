import createMollieClient, { Locale } from '@mollie/api-client';

const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY || '';

let mollieClient: ReturnType<typeof createMollieClient> | null = null;

export function getMollieClient() {
  if (!MOLLIE_API_KEY) throw new Error('MOLLIE_API_KEY is not configured');
  if (!mollieClient) {
    mollieClient = createMollieClient({ apiKey: MOLLIE_API_KEY });
  }
  return mollieClient;
}

export type MollieBillingCountry = 'NL' | 'BE';

/**
 * Mapt het facturatie-land naar de Mollie-locale die de checkout bepaalt
 * welke betaalmethodes prominent getoond worden:
 *   - `nl_NL` → iDEAL als hoofdkeuze (Nederland)
 *   - `nl_BE` → Bancontact als hoofdkeuze (België)
 *
 * We laten Mollie zelf de set methodes bepalen op basis van locale; door geen
 * `method` parameter mee te geven blijven creditcard, bankoverschrijving etc.
 * beschikbaar zodat klanten zelf kunnen kiezen.
 */
export function mollieLocaleForCountry(country: string | null | undefined): 'nl_NL' | 'nl_BE' {
  return String(country || 'NL').trim().toUpperCase() === 'BE' ? 'nl_BE' : 'nl_NL';
}

function toMollieLocale(country: string | null | undefined): Locale {
  return mollieLocaleForCountry(country) === 'nl_BE' ? Locale.nl_BE : Locale.nl_NL;
}

export interface CreateBatchPaymentParams {
  orderId: string;
  amount: number;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  customerEmail: string;
  customerName: string;
  /** Kind discriminator for Mollie metadata; defaults to 'batch' (leads). */
  kind?: 'batch' | 'appointment_order' | 'invoice';
  /**
   * Facturatie-land van de klant. Bepaalt de Mollie-locale, en daarmee welke
   * betaalmethode prominent wordt getoond (Bancontact voor BE, iDEAL voor NL).
   * Default: NL.
   */
  billingCountry?: string | null;
}

export async function createBatchPayment({
  orderId,
  amount,
  description,
  redirectUrl,
  webhookUrl,
  customerEmail,
  customerName,
  kind = 'batch',
  billingCountry,
}: CreateBatchPaymentParams) {
  const mollie = getMollieClient();
  const locale = toMollieLocale(billingCountry);

  const payment = await mollie.payments.create({
    amount: {
      currency: 'EUR',
      value: amount.toFixed(2),
    },
    description,
    redirectUrl,
    webhookUrl,
    metadata: { orderId, kind },
    billingEmail: customerEmail,
    locale,
  });

  void customerName;
  return payment;
}

export async function getPayment(paymentId: string) {
  const mollie = getMollieClient();
  return mollie.payments.get(paymentId);
}
