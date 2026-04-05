import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getPayment } from '@/lib/mollie';
import { distributeUnassignedLeads } from '@/lib/distribution';
import { sendOrderConfirmationEmail, sendEmail } from '@/lib/email';
import { sendPushToCustomer } from '@/lib/pushNotification';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const paymentId = formData.get('id') as string;

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });
    }

    const payment = await getPayment(paymentId);
    const rawOrderId = (payment.metadata as { orderId?: string })?.orderId;

    if (!rawOrderId) {
      console.error('[mollie-webhook] no orderId in metadata for payment', paymentId);
      return NextResponse.json({ ok: true });
    }

    const supabase = createServerClient();
    const status = payment.status;

    // Direct batch payment (from portal pay-batch endpoint)
    if (rawOrderId.startsWith('batch:')) {
      const batchId = rawOrderId.replace('batch:', '');
      const { data: batch } = await supabase
        .from('customer_batches')
        .select('id, is_paid, customer_id, branch, batch_size')
        .eq('id', batchId)
        .single();

      if (!batch) {
        console.error('[mollie-webhook] batch not found for direct payment', batchId);
        return NextResponse.json({ ok: true });
      }

      if (batch.is_paid) return NextResponse.json({ ok: true });

      if (status === 'paid') {
        await supabase
          .from('customer_batches')
          .update({ is_paid: true })
          .eq('id', batchId);

        const { data: cust } = await supabase
          .from('customers')
          .select('id, name, email, contact_person')
          .eq('id', batch.customer_id)
          .single();

        if (cust) {
          const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', batch.branch).single();
          const branchName = branchRow?.name || batch.branch;

          sendPushToCustomer(cust.id, {
            title: 'Betaling ontvangen!',
            body: `Uw batch ${branchName} (${batch.batch_size} leads) is betaald.`,
            url: '/portal',
            tag: 'batch-paid',
          }).catch(() => {});
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Portal order payment (from bestellen page)
    const orderId = rawOrderId;

    const { data: order } = await supabase
      .from('batch_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) {
      console.error('[mollie-webhook] order not found', orderId);
      return NextResponse.json({ ok: true });
    }

    if (order.status === 'paid') {
      return NextResponse.json({ ok: true });
    }

    if (status === 'paid') {
      const { data: newBatch, error: batchError } = await supabase
        .from('customer_batches')
        .insert({
          customer_id: order.customer_id,
          branch: order.branch,
          batch_size: order.batch_size,
          price_per_lead: order.price_per_lead,
          total_price: order.total_price,
          leads_per_week: order.leads_per_week,
          lead_filters: order.lead_filters || [],
          notes: order.notes ? `[Portal bestelling] ${order.notes}` : '[Portal bestelling]',
          status: 'active',
          leads_delivered: 0,
          is_paid: true,
        })
        .select()
        .single();

      if (batchError || !newBatch) {
        console.error('[mollie-webhook] batch insert FAILED for order', orderId, batchError);
        await supabase
          .from('batch_orders')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', orderId);

        sendEmail(
          'info@warmeleads.eu',
          `[URGENT] Batch aanmaken mislukt voor order ${orderId}`,
          `<p>De Mollie betaling is gelukt maar de batch kon niet worden aangemaakt in de database.</p>
           <p><strong>Order ID:</strong> ${orderId}</p>
           <p><strong>Klant ID:</strong> ${order.customer_id}</p>
           <p><strong>Branche:</strong> ${order.branch}</p>
           <p><strong>Batch size:</strong> ${order.batch_size}</p>
           <p><strong>Error:</strong> ${batchError?.message || 'Unknown'}</p>
           <p>Maak de batch handmatig aan via de admin.</p>`,
        ).catch(() => {});

        return NextResponse.json({ ok: true });
      }

      await supabase
        .from('batch_orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          batch_id: newBatch.id,
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
          price_per_lead: order.price_per_lead,
        }).catch(() => {});

        sendPushToCustomer(customer.id, {
          title: 'Bestelling bevestigd!',
          body: `Uw nieuwe batch ${branchName} (${order.batch_size} leads) is aangemaakt.`,
          url: '/portal',
          tag: 'order-confirmed',
        }).catch(() => {});
      }

      distributeUnassignedLeads().catch(() => {});

    } else if (status === 'failed') {
      await supabase.from('batch_orders').update({ status: 'failed' }).eq('id', orderId);
    } else if (status === 'expired') {
      await supabase.from('batch_orders').update({ status: 'expired' }).eq('id', orderId);
    } else if (status === 'canceled') {
      await supabase.from('batch_orders').update({ status: 'cancelled' }).eq('id', orderId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mollie-webhook] error:', err);
    return NextResponse.json({ ok: true });
  }
}
