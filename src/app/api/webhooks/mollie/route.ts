import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getPayment } from '@/lib/mollie';
import { distributeUnassignedLeads } from '@/lib/distribution';
import { sendOrderConfirmationEmail, sendEmail } from '@/lib/email';
import { sendPushToCustomer } from '@/lib/pushNotification';
import { createInvoice, sendNewBatchAdminEmail } from '@/lib/invoice';

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

      if (status === 'paid') {
        // Atomic claim: only update if currently unpaid
        const { data: claimed, error: claimErr } = await supabase
          .from('customer_batches')
          .update({ is_paid: true, mollie_payment_id: paymentId })
          .eq('id', batchId)
          .eq('is_paid', false)
          .select('id, customer_id, branch, batch_size, price_per_lead, total_price')
          .single();

        if (claimErr || !claimed) {
          return NextResponse.json({ ok: true });
        }

        const { data: cust } = await supabase
          .from('customers')
          .select('id, name, email, contact_person')
          .eq('id', claimed.customer_id)
          .single();

        const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', claimed.branch).single();
        const branchName = branchRow?.name || claimed.branch;

        if (cust) {
          sendPushToCustomer(cust.id, {
            title: 'Betaling ontvangen!',
            body: `Uw batch ${branchName} (${claimed.batch_size} leads) is betaald.`,
            url: '/portal',
            tag: 'batch-paid',
          }).catch(() => {});
        }

        // Create invoice
        if (Number(claimed.price_per_lead) > 0 && Number(claimed.total_price) > 0) {
          createInvoice({
            customer_id: claimed.customer_id,
            batch_id: claimed.id,
            branch_name: branchName,
            batch_size: claimed.batch_size,
            price_per_lead: Number(claimed.price_per_lead),
            total_price: Number(claimed.total_price),
            mollie_payment_id: paymentId,
            paid_at: new Date().toISOString(),
          }).catch(e => {
            console.error('[mollie-webhook] invoice creation failed:', e);
            sendEmail('info@warmeleads.eu', `[WAARSCHUWING] Factuur aanmaken mislukt`,
              `<p>Batch betaling is gelukt maar de factuur kon niet worden aangemaakt.</p>
               <p><strong>Batch ID:</strong> ${claimed.id}</p>
               <p><strong>Klant:</strong> ${cust?.name || 'Onbekend'}</p>
               <p><strong>Error:</strong> ${e?.message || String(e)}</p>`
            ).catch(() => {});
          });
        }

        // Admin notification
        sendNewBatchAdminEmail({
          customer_name: cust?.name || 'Onbekend',
          branch_name: branchName,
          batch_size: claimed.batch_size,
          total_price: Number(claimed.total_price || 0),
          price_per_lead: Number(claimed.price_per_lead || 0),
          is_paid: true,
          source: 'portal_pay',
        }).catch(() => {});

        distributeUnassignedLeads().catch(() => {});
      }

      return NextResponse.json({ ok: true });
    }

    // Portal order payment (from bestellen page)
    const orderId = rawOrderId;

    // Atomic claim: only process if not already paid
    if (status === 'paid') {
      const { data: claimedOrder, error: claimErr } = await supabase
        .from('batch_orders')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', orderId)
        .neq('status', 'paid')
        .select('*')
        .single();

      if (claimErr || !claimedOrder) {
        return NextResponse.json({ ok: true });
      }

      const order = claimedOrder;
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
        .update({ batch_id: newBatch.id })
        .eq('id', orderId);

      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, email, contact_person')
        .eq('id', order.customer_id)
        .single();

      const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', order.branch).single();
      const branchName = branchRow?.name || order.branch;

      if (customer) {
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

      // Create invoice
      createInvoice({
        customer_id: order.customer_id,
        batch_order_id: orderId,
        batch_id: newBatch.id,
        branch_name: branchName,
        batch_size: order.batch_size,
        price_per_lead: Number(order.price_per_lead),
        total_price: Number(order.total_price),
        mollie_payment_id: paymentId,
        paid_at: new Date().toISOString(),
      }).catch(e => {
        console.error('[mollie-webhook] invoice creation failed:', e);
        sendEmail('info@warmeleads.eu', `[WAARSCHUWING] Factuur aanmaken mislukt`,
          `<p>Bestelling is betaald maar de factuur kon niet worden aangemaakt.</p>
           <p><strong>Order ID:</strong> ${orderId}</p>
           <p><strong>Klant:</strong> ${customer?.name || 'Onbekend'}</p>
           <p><strong>Error:</strong> ${e?.message || String(e)}</p>`
        ).catch(() => {});
      });

      // Admin notification
      sendNewBatchAdminEmail({
        customer_name: customer?.name || 'Onbekend',
        branch_name: branchName,
        batch_size: order.batch_size,
        total_price: Number(order.total_price),
        price_per_lead: Number(order.price_per_lead),
        is_paid: true,
        source: 'portal',
      }).catch(() => {});

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
