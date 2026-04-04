import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getPayment } from '@/lib/mollie';
import { distributeUnassignedLeads } from '@/lib/distribution';
import { sendOrderConfirmationEmail, sendBatchCompletionNotification } from '@/lib/email';
import { sendPushToCustomer } from '@/lib/pushNotification';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const paymentId = formData.get('id') as string;

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });
    }

    const payment = await getPayment(paymentId);
    const orderId = (payment.metadata as { orderId?: string })?.orderId;

    if (!orderId) {
      console.error('Mollie webhook: no orderId in metadata for payment', paymentId);
      return NextResponse.json({ ok: true });
    }

    const supabase = createServerClient();

    const { data: order } = await supabase
      .from('batch_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) {
      console.error('Mollie webhook: order not found', orderId);
      return NextResponse.json({ ok: true });
    }

    if (order.status === 'paid') {
      return NextResponse.json({ ok: true });
    }

    const status = payment.status;

    if (status === 'paid') {
      const { data: newBatch } = await supabase
        .from('customer_batches')
        .insert({
          customer_id: order.customer_id,
          branch: order.branch,
          batch_size: order.batch_size,
          price_per_lead: order.price_per_lead,
          total_price: order.total_price,
          leads_per_week: order.leads_per_week,
          lead_filters: order.lead_filters || [],
          notes: order.notes,
          status: 'active',
        })
        .select()
        .single();

      await supabase
        .from('batch_orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          batch_id: newBatch?.id || null,
        })
        .eq('id', orderId);

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, email, contact_person')
        .eq('id', order.customer_id)
        .single();

      if (customer) {
        const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', order.branch).single();
        const branchName = branchRow?.name || order.branch;

        sendOrderConfirmationEmail(customer, {
          branch: order.branch,
          branch_name: branchName,
          batch_size: order.batch_size,
          total_price: order.total_price,
        }).catch(() => {});

        sendPushToCustomer(customer.id, {
          title: 'Bestelling bevestigd!',
          body: `Uw nieuwe batch ${branchName} (${order.batch_size} leads) is aangemaakt.`,
          url: '/portal',
          tag: 'order-confirmed',
        }).catch(() => {});

        sendBatchCompletionNotification(
          'info@warmeleads.eu',
          customer.name,
          { id: newBatch?.id || orderId, branch: branchName, batch_size: order.batch_size, leads_delivered: 0 },
        ).catch(() => {});
      }

      try { distributeUnassignedLeads(); } catch { /* non-blocking */ }

    } else if (status === 'failed') {
      await supabase.from('batch_orders').update({ status: 'failed' }).eq('id', orderId);
    } else if (status === 'expired') {
      await supabase.from('batch_orders').update({ status: 'expired' }).eq('id', orderId);
    } else if (status === 'canceled') {
      await supabase.from('batch_orders').update({ status: 'cancelled' }).eq('id', orderId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Mollie webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}
