import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getPayment } from '@/lib/mollie';
import { backfillBatch } from '@/lib/distribution';
import { sendOrderConfirmationEmail, sendEmail } from '@/lib/email';
import { sendPushToCustomer } from '@/lib/pushNotification';
import { createInvoice, markInvoicePaid, sendNewBatchAdminEmail } from '@/lib/invoice';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';

function errorEmailHtml(title: string, details: string): string {
  const logoUrl = `${SITE_URL}/warmeleads-logo-2026.png`;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9">
              <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px">
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                <tr><td style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:6px 14px">
                  <span style="color:#dc2626;font-size:12px;font-weight:700;letter-spacing:0.5px">&#9888; WAARSCHUWING</span>
                </td></tr>
              </table>
              <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">${title}</h1>
              <div style="font-size:14px;color:#475569;line-height:1.7">${details}</div>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px">
                <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
                  <a href="${SITE_URL}/admin" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Naar admin &rarr;</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${SITE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function insertCelebrationEvent(
  supabase: ReturnType<typeof createServerClient>,
  customerName: string,
  branch: string,
  amount: number,
  customerId: string,
  batchAmId?: string | null,
) {
  try {
    const { data: custRow } = await supabase
      .from('customers')
      .select('account_manager_id')
      .eq('id', customerId)
      .single();

    const resolvedAmId = batchAmId || custRow?.account_manager_id;

    let amPayload: Record<string, unknown> = {};
    if (resolvedAmId) {
      const { data: am } = await supabase
        .from('admin_users')
        .select('id, name, avatar_url, celebration_video_url, celebration_video_start, celebration_video_end')
        .eq('id', resolvedAmId)
        .single();
      if (am) {
        amPayload = {
          amId: am.id,
          amName: am.name,
          amAvatarUrl: am.avatar_url,
          celebrationVideoUrl: am.celebration_video_url,
          videoStart: am.celebration_video_start,
          videoEnd: am.celebration_video_end,
        };
      }
    }

    await supabase.from('celebration_events').insert({
      event_type: 'sale',
      payload: { customer: customerName, branch, amount, ...amPayload },
    });

    // Milestone detection: count sales today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('celebration_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'sale')
      .gte('created_at', todayStart.toISOString());

    const milestoneNumbers = [3, 5, 10, 15, 20, 25, 50, 100];
    if (count && milestoneNumbers.includes(count)) {
      await supabase.from('celebration_events').insert({
        event_type: 'milestone',
        payload: { milestoneText: `${count}e sale vandaag!`, count },
      });
    }
  } catch (e) {
    console.error('[mollie-webhook] celebration event insert failed:', e);
  }
}

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
          .select('id, customer_id, branch, batch_size, price_per_lead, total_price, leads_per_week, leads_per_day, lead_filters, starts_at, lookback_days')
          .single();

        if (claimErr || !claimed) {
          return NextResponse.json({ ok: true });
        }

        const { data: cust } = await supabase
          .from('customers')
          .select('id, name, email, contact_person, account_manager_id')
          .eq('id', claimed.customer_id)
          .single();

        if (cust?.account_manager_id) {
          await supabase.from('customer_batches').update({ account_manager_id: cust.account_manager_id }).eq('id', batchId).is('account_manager_id', null);
        }

        const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', claimed.branch).single();
        const branchName = branchRow?.name || claimed.branch;

        if (cust) {
          sendOrderConfirmationEmail(cust, {
            branch: claimed.branch,
            branch_name: branchName,
            batch_size: claimed.batch_size,
            total_price: Number(claimed.total_price),
            price_per_lead: Number(claimed.price_per_lead),
          }).catch(() => {});

          sendPushToCustomer(cust.id, {
            title: 'Betaling ontvangen!',
            body: `Uw batch ${branchName} (${claimed.batch_size} leads) is betaald.`,
            url: '/portal',
            tag: 'batch-paid',
          }).catch(() => {});
        }

        // Mark existing open invoice as paid, or create new one
        if (Number(claimed.price_per_lead) > 0 && Number(claimed.total_price) > 0) {
          markInvoicePaid(claimed.id, paymentId).then(updated => {
            if (updated) return;
            // No open invoice found — create a new one
            return createInvoice({
              customer_id: claimed.customer_id,
              batch_id: claimed.id,
              branch_name: branchName,
              batch_size: claimed.batch_size,
              price_per_lead: Number(claimed.price_per_lead),
              total_price: Number(claimed.total_price),
              mollie_payment_id: paymentId,
              paid_at: new Date().toISOString(),
            });
          }).catch(e => {
            console.error('[mollie-webhook] invoice handling failed:', e);
            sendEmail('info@warmeleads.eu', `[WAARSCHUWING] Factuur aanmaken/bijwerken mislukt`,
              errorEmailHtml('Factuur bijwerken mislukt', `
                <p style="margin:0 0 16px">Batch betaling is gelukt maar de factuur kon niet worden bijgewerkt.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px">
                  <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:120px">Batch ID</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;font-family:monospace">${claimed.id}</td></tr>
                  <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Klant</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${cust?.name || 'Onbekend'}</td></tr>
                  <tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Error</td><td style="padding:12px 20px;font-size:14px;color:#dc2626;font-weight:600">${e?.message || String(e)}</td></tr>
                </table>`),
              { type: 'mollie_error', metadata: { batch_id: claimed.id, error_type: 'invoice_update_failed' } },
            ).catch(() => {});
          });
        }

        // Create batch_orders record so the payment is visible in admin & portal
        const { error: orderInsertErr } = await supabase
          .from('batch_orders')
          .insert({
            customer_id: claimed.customer_id,
            branch: claimed.branch,
            batch_size: claimed.batch_size,
            price_per_lead: claimed.price_per_lead,
            total_price: claimed.total_price,
            leads_per_week: claimed.leads_per_week,
            leads_per_day: claimed.leads_per_day,
            lead_filters: claimed.lead_filters || [],
            source_batch_id: claimed.id,
            batch_id: claimed.id,
            mollie_payment_id: paymentId,
            status: 'paid',
            paid_at: new Date().toISOString(),
            notes: '[Portal batch betaling]',
          });

        if (orderInsertErr) {
          console.error('[mollie-webhook] batch_orders insert failed:', orderInsertErr);
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

        // Celebration event for live dashboard
        insertCelebrationEvent(
          supabase,
          cust?.name || 'Onbekend',
          claimed.branch,
          Number(claimed.total_price || 0),
          claimed.customer_id,
          cust?.account_manager_id || null,
        ).catch(() => {});

        const startsInFuture = claimed.starts_at && new Date(claimed.starts_at) > new Date();
        if (!startsInFuture) {
          const lookback = claimed.lookback_days ?? 3;
          if (lookback > 0) backfillBatch(claimed.id, lookback).catch(() => {});
        }
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

      const { data: orderCust } = await supabase.from('customers').select('id, name, email, contact_person, account_manager_id').eq('id', order.customer_id).single();

      const { data: newBatch, error: batchError } = await supabase
        .from('customer_batches')
        .insert({
          customer_id: order.customer_id,
          branch: order.branch,
          batch_size: order.batch_size,
          price_per_lead: order.price_per_lead,
          total_price: order.total_price,
          leads_per_week: order.leads_per_week,
          leads_per_day: order.leads_per_day,
          lead_filters: order.lead_filters || [],
          notes: order.notes ? `[Portal bestelling] ${order.notes}` : '[Portal bestelling]',
          status: 'active',
          leads_delivered: 0,
          is_paid: true,
          account_manager_id: orderCust?.account_manager_id || null,
        })
        .select()
        .single();

      if (batchError || !newBatch) {
        console.error('[mollie-webhook] batch insert FAILED for order', orderId, batchError);

        sendEmail(
          'info@warmeleads.eu',
          `[URGENT] Batch aanmaken mislukt voor order ${orderId}`,
          errorEmailHtml('Batch aanmaken mislukt', `
            <p style="margin:0 0 16px">De Mollie betaling is gelukt maar de batch kon niet worden aangemaakt in de database.</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px">
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:120px">Order ID</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;font-family:monospace">${orderId}</td></tr>
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Klant ID</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;font-family:monospace">${order.customer_id}</td></tr>
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Branche</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${order.branch}</td></tr>
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Batch size</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${order.batch_size}</td></tr>
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Error</td><td style="padding:12px 20px;font-size:14px;color:#dc2626;font-weight:600">${batchError?.message || 'Unknown'}</td></tr>
            </table>
            <p style="margin:0;font-size:14px;color:#64748b">Maak de batch handmatig aan via de admin.</p>`),
          { type: 'mollie_error', metadata: { order_id: orderId, error_type: 'batch_insert_failed' } },
        ).catch(() => {});

        return NextResponse.json({ ok: true });
      }

      await supabase
        .from('batch_orders')
        .update({ batch_id: newBatch.id })
        .eq('id', orderId);

      if (order.welcome_discount_applied) {
        await supabase
          .from('customers')
          .update({ welcome_offer_used: true })
          .eq('id', order.customer_id);
      }

      const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', order.branch).single();
      const branchName = branchRow?.name || order.branch;

      if (orderCust) {
        sendOrderConfirmationEmail(orderCust, {
          branch: order.branch,
          branch_name: branchName,
          batch_size: order.batch_size,
          total_price: order.total_price,
          price_per_lead: order.price_per_lead,
        }).catch(() => {});

        sendPushToCustomer(orderCust.id, {
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
          errorEmailHtml('Factuur aanmaken mislukt', `
            <p style="margin:0 0 16px">Bestelling is betaald maar de factuur kon niet worden aangemaakt.</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px">
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:120px">Order ID</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;font-family:monospace">${orderId}</td></tr>
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Klant</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${orderCust?.name || 'Onbekend'}</td></tr>
              <tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Error</td><td style="padding:12px 20px;font-size:14px;color:#dc2626;font-weight:600">${e?.message || String(e)}</td></tr>
            </table>`),
          { type: 'mollie_error', metadata: { order_id: orderId, error_type: 'invoice_create_failed' } },
        ).catch(() => {});
      });

      // Admin notification
      sendNewBatchAdminEmail({
        customer_name: orderCust?.name || 'Onbekend',
        branch_name: branchName,
        batch_size: order.batch_size,
        total_price: Number(order.total_price),
        price_per_lead: Number(order.price_per_lead),
        is_paid: true,
        source: 'portal',
      }).catch(() => {});

      // Celebration event for live dashboard
      insertCelebrationEvent(
        supabase,
        orderCust?.name || 'Onbekend',
        order.branch,
        Number(order.total_price || 0),
        order.customer_id,
        newBatch.account_manager_id,
      ).catch(() => {});

      backfillBatch(newBatch.id, 3).catch(() => {});

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
