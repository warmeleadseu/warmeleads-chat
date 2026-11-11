import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimitShared, getClientIp } from '@/lib/rateLimit';
import { ensureInvoiceMollieCheckout } from '@/lib/invoiceCheckout';
import { factuurBedankUrl, factuurBetaalTokenKlopt } from '@/lib/factuurBetaallink';

/**
 * De betaalknop uit de mail (src/lib/factuurBetaallink.ts): zonder in te loggen
 * door naar Mollie. Staat de factuur niet (meer) open, of klopt de link niet,
 * dan naar de bedankpagina, die uitlegt hoe het zit.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = request.nextUrl.searchParams.get('t') || '';
  const naarPagina = (extra = '') =>
    NextResponse.redirect(new URL(`/betalen/${encodeURIComponent(id)}/klaar?t=${encodeURIComponent(t)}${extra}`, request.url), 303);

  if (!/^[0-9a-f-]{36}$/i.test(id) || !factuurBetaalTokenKlopt(id, t)) return naarPagina();

  const rl = await rateLimitShared(`betalen:${getClientIp(request)}`, 'betalen', 20, 10 * 60_000);
  if (rl.limited && rl.response) return rl.response;

  const supabase = createServerClient();
  const { data: f } = await supabase
    .from('invoices')
    .select('id, invoice_number, description, customer_id, total_incl_btw, mollie_payment_id, status')
    .eq('id', id)
    .maybeSingle();
  if (!f || f.status !== 'open') return naarPagina();

  try {
    const { checkoutUrl } = await ensureInvoiceMollieCheckout(
      {
        id: f.id,
        invoice_number: f.invoice_number,
        description: f.description,
        customer_id: f.customer_id,
        total_incl_btw: Number(f.total_incl_btw),
        mollie_payment_id: f.mollie_payment_id,
      },
      { terugUrl: factuurBedankUrl(f.id) },
    );
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (e) {
    console.error('[betalen] Mollie-betaling starten mislukt', { invoiceId: id, fout: e instanceof Error ? e.message : e });
    return naarPagina('&fout=1');
  }
}
