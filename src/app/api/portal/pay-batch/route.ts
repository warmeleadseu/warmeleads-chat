import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { createBatchPayment } from '@/lib/mollie';

export async function POST(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  try {
    const { batch_id } = await request.json();
    if (!batch_id) return NextResponse.json({ error: 'batch_id is verplicht' }, { status: 400 });

    const supabase = createServerClient();

    const { data: batch } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, price_per_lead, total_price, is_paid, mollie_payment_id')
      .eq('id', batch_id)
      .eq('customer_id', customer.id)
      .single();

    if (!batch) return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
    if (batch.is_paid) return NextResponse.json({ error: 'Batch is al betaald' }, { status: 400 });

    const { data: custData } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('id', customer.id)
      .single();

    if (!custData) return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });

    const totalExBtw = Number(batch.total_price || 0);
    const totalInclBtw = Math.round(totalExBtw * 1.21 * 100) / 100;

    if (totalInclBtw <= 0) {
      return NextResponse.json({ error: 'Geen geldig bedrag voor deze batch' }, { status: 400 });
    }

    const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', batch.branch).single();
    const branchName = branchRow?.name || batch.branch;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
    const payment = await createBatchPayment({
      orderId: `batch:${batch.id}`,
      amount: totalInclBtw,
      description: `WarmeLeads batch: ${batch.batch_size} ${branchName} leads (incl. 21% BTW)`,
      redirectUrl: `${baseUrl}/portal?paid=${batch.id}`,
      webhookUrl: `${baseUrl}/api/webhooks/mollie`,
      customerEmail: custData.email,
      customerName: custData.name,
    });

    await supabase
      .from('customer_batches')
      .update({ mollie_payment_id: payment.id })
      .eq('id', batch.id);

    return NextResponse.json({ checkoutUrl: payment.getCheckoutUrl() });
  } catch (err) {
    console.error('Pay batch error:', err);
    return NextResponse.json({ error: 'Er is iets misgegaan bij het starten van de betaling' }, { status: 500 });
  }
}
