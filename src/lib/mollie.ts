import createMollieClient from '@mollie/api-client';

const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY || '';

let mollieClient: ReturnType<typeof createMollieClient> | null = null;

export function getMollieClient() {
  if (!MOLLIE_API_KEY) throw new Error('MOLLIE_API_KEY is not configured');
  if (!mollieClient) {
    mollieClient = createMollieClient({ apiKey: MOLLIE_API_KEY });
  }
  return mollieClient;
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
}: CreateBatchPaymentParams) {
  const mollie = getMollieClient();

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
  });

  void customerName;
  return payment;
}

export async function getPayment(paymentId: string) {
  const mollie = getMollieClient();
  return mollie.payments.get(paymentId);
}
