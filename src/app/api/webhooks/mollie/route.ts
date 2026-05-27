import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getPayment } from '@/lib/mollie';
import { backfillBatch, distributeUnassignedLeads } from '@/lib/distribution';
import { sendOrderConfirmationEmail, sendEmail } from '@/lib/email';
import { sendPushToCustomer } from '@/lib/pushNotification';
import { createInvoice, notifyCustomerInvoicePaid, sendNewBatchAdminEmail } from '@/lib/invoice';
import { insertCelebrationEvent } from '@/lib/celebrationInsert';
import { finalizePaidLeadBatch, finalizePaidBulkLeadBatch } from '@/lib/finalizePaidLeadBatch';
import { isBulkLeadsBatchKind, isMetaCampaignSyncBatchKind, isPipelineBatchKind } from '@/lib/batchKind';
import { reconcileBatchMetaCampaigns } from '@/lib/metaBatchCampaignSync';
import { metaInheritanceNoteSuffix, resolveMetaCampaignFieldsForNewLeadBatch } from '@/lib/metaCampaignInheritance';
import { ensureCustomerHasBranch } from '@/lib/nicheResearch';
import { deliveryModelForNewBatch, normalizeDeliveryModel } from '@/lib/batchDeliveryModel';

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
    const kind = (payment.metadata as { kind?: string })?.kind;

    // Appointment order payment
    if (kind === 'appointment_order') {
      const apptOrderId = rawOrderId;
      if (status === 'paid') {
        const { data: claimedOrder, error: claimErr } = await supabase
          .from('appointment_orders')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', apptOrderId)
          .neq('status', 'paid')
          .select('*')
          .single();

        if (claimErr || !claimedOrder) {
          return NextResponse.json({ ok: true });
        }

        const { data: orderCust } = await supabase
          .from('customers')
          .select('id, name, email, contact_person, account_manager_id, country, vat_id')
          .eq('id', claimedOrder.customer_id)
          .single();

        const { data: newBatch, error: batchError } = await supabase
          .from('appointment_batches')
          .insert({
            customer_id: claimedOrder.customer_id,
            branch: claimedOrder.branch,
            batch_size: claimedOrder.batch_size,
            price_per_appointment: claimedOrder.price_per_appointment,
            total_price: claimedOrder.total_price,
            appointments_per_week: claimedOrder.appointments_per_week,
            appointments_per_day: claimedOrder.appointments_per_day,
            lead_filters: claimedOrder.lead_filters || [],
            notes: claimedOrder.notes ? `[Portal bestelling] ${claimedOrder.notes}` : '[Portal bestelling]',
            status: 'active',
            appointments_delivered: 0,
            is_paid: true,
            account_manager_id: orderCust?.account_manager_id || null,
          })
          .select()
          .single();

        if (batchError || !newBatch) {
          console.error('[mollie-webhook] appointment batch insert FAILED:', batchError);
          sendEmail('info@warmeleads.eu', `[URGENT] Appointment batch aanmaken mislukt voor order ${apptOrderId}`,
            errorEmailHtml('Appointment batch aanmaken mislukt', `
              <p style="margin:0 0 16px">De Mollie betaling is gelukt maar de afspraken-batch kon niet worden aangemaakt.</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px">
                <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:120px">Order ID</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;font-family:monospace">${apptOrderId}</td></tr>
                <tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Error</td><td style="padding:12px 20px;font-size:14px;color:#dc2626;font-weight:600">${batchError?.message || 'Unknown'}</td></tr>
              </table>`),
            { type: 'mollie_error', metadata: { order_id: apptOrderId, error_type: 'appointment_batch_insert_failed' } },
          ).catch(() => {});
          return NextResponse.json({ ok: true });
        }

        await supabase
          .from('appointment_orders')
          .update({ batch_id: newBatch.id })
          .eq('id', apptOrderId);

        if (claimedOrder.welcome_discount_applied) {
          await supabase
            .from('customers')
            .update({ welcome_offer_used: true })
            .eq('id', claimedOrder.customer_id);
        }

        const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', claimedOrder.branch).single();
        const branchName = branchRow?.name || claimedOrder.branch;

        if (orderCust) {
          sendOrderConfirmationEmail(orderCust, {
            branch: claimedOrder.branch,
            branch_name: `${branchName} (afspraken)`,
            batch_size: claimedOrder.batch_size,
            total_price: Number(claimedOrder.total_price),
            price_per_lead: Number(claimedOrder.price_per_appointment),
          }).catch(() => {});

          sendPushToCustomer(orderCust.id, {
            title: 'Afspraken-bestelling bevestigd!',
            body: `Je nieuwe batch ${branchName} (${claimedOrder.batch_size} afspraken) is aangemaakt.`,
            url: '/portal/agenda',
            tag: 'appointment-order-confirmed',
          }).catch(() => {});
        }

        createInvoice({
          customer_id: claimedOrder.customer_id,
          batch_order_id: apptOrderId,
          appointment_batch_id: newBatch.id,
          branch_name: `${branchName} (afspraken)`,
          batch_size: claimedOrder.batch_size,
          price_per_lead: Number(claimedOrder.price_per_appointment),
          total_price: Number(claimedOrder.total_price),
          mollie_payment_id: paymentId,
          paid_at: new Date().toISOString(),
          invoice_product: 'appointments',
        }).catch(e => {
          console.error('[mollie-webhook] appointment invoice creation failed:', e);
        });

        sendNewBatchAdminEmail({
          customer_name: orderCust?.name || 'Onbekend',
          branch_name: `${branchName} (afspraken)`,
          batch_size: claimedOrder.batch_size,
          total_price: Number(claimedOrder.total_price),
          price_per_lead: Number(claimedOrder.price_per_appointment),
          is_paid: true,
          source: 'portal',
          is_appointments: true,
          billing_country: (orderCust?.country as string | null | undefined) ?? 'NL',
          billing_vat_id: orderCust?.vat_id,
        }).catch(() => {});

        insertCelebrationEvent(
          supabase,
          orderCust?.name || 'Onbekend',
          claimedOrder.branch,
          Number(claimedOrder.total_price || 0),
          claimedOrder.customer_id,
          newBatch.account_manager_id,
        ).catch(() => {});
      } else if (status === 'failed') {
        await supabase.from('appointment_orders').update({ status: 'failed' }).eq('id', apptOrderId);
      } else if (status === 'expired') {
        await supabase.from('appointment_orders').update({ status: 'expired' }).eq('id', apptOrderId);
      } else if (status === 'canceled') {
        await supabase.from('appointment_orders').update({ status: 'cancelled' }).eq('id', apptOrderId);
      }

      return NextResponse.json({ ok: true });
    }

    // Factuur betaling (portaal / e-mail Mollie-link); metadata.kind === 'invoice', orderId invoice:<uuid>
    if (kind === 'invoice' || rawOrderId.startsWith('invoice:')) {
      const invoiceId = rawOrderId.startsWith('invoice:')
        ? rawOrderId.slice('invoice:'.length)
        : rawOrderId;

      if (status === 'paid') {
        const nowIso = new Date().toISOString();
        const { data: inv, error: invErr } = await supabase
          .from('invoices')
          .update({ status: 'paid', paid_at: nowIso, mollie_payment_id: paymentId })
          .eq('id', invoiceId)
          .eq('status', 'open')
          .select('*')
          .single();

        if (!invErr && inv) {
          await notifyCustomerInvoicePaid(inv.id);

          if (inv.batch_id) {
            const { data: batchClaim } = await supabase
              .from('customer_batches')
              .update({ is_paid: true, mollie_payment_id: paymentId, status: 'active' })
              .eq('id', inv.batch_id)
              .eq('is_paid', false)
              .select('id, customer_id, branch, batch_size, price_per_lead, total_price, leads_per_week, leads_per_day, lead_filters, starts_at, lookback_days, batch_kind')
              .single();

            if (batchClaim) {
              if (isBulkLeadsBatchKind(batchClaim.batch_kind)) {
                await finalizePaidBulkLeadBatch(supabase, batchClaim, paymentId, { skipInvoiceHandling: true });
              } else {
                await finalizePaidLeadBatch(supabase, batchClaim, paymentId, { skipInvoiceHandling: true });
              }
            }
          } else if ((inv as { appointment_batch_id?: string | null }).appointment_batch_id) {
            const apptBid = (inv as { appointment_batch_id: string }).appointment_batch_id;
            await supabase
              .from('appointment_batches')
              .update({ is_paid: true, mollie_payment_id: paymentId, status: 'active' })
              .eq('id', apptBid)
              .eq('is_paid', false);
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Direct batch payment (from portal pay-batch endpoint)
    if (rawOrderId.startsWith('batch:')) {
      const batchId = rawOrderId.replace('batch:', '');

      if (status === 'paid') {
        const { data: claimed, error: claimErr } = await supabase
          .from('customer_batches')
          .update({ is_paid: true, mollie_payment_id: paymentId, status: 'active' })
          .eq('id', batchId)
          .eq('is_paid', false)
          .select('id, customer_id, branch, batch_size, price_per_lead, total_price, leads_per_week, leads_per_day, lead_filters, starts_at, lookback_days')
          .single();

        if (!claimErr && claimed) {
          try {
            await finalizePaidLeadBatch(supabase, claimed, paymentId, {});
          } catch (e) {
            console.error('[mollie-webhook] finalizePaidLeadBatch failed:', e);
            sendEmail('info@warmeleads.eu', `[WAARSCHUWING] Batch na betaling verwerken mislukt`,
              errorEmailHtml('Batch verwerken mislukt', `
                <p style="margin:0 0 16px">Mollie meldt betaald maar verdere verwerking faalde.</p>
                <p style="margin:0;font-family:monospace;font-size:13px">${String(e)}</p>`),
              { type: 'mollie_error', metadata: { batch_id: claimed.id, error_type: 'finalize_failed' } },
            ).catch(() => {});
          }
        } else {
          const { data: claimedAppt, error: apptClaimErr } = await supabase
            .from('appointment_batches')
            .update({ is_paid: true, mollie_payment_id: paymentId, status: 'active' })
            .eq('id', batchId)
            .eq('is_paid', false)
            .select('id')
            .single();

          if (!apptClaimErr && claimedAppt) {
            // Factuur (indien aanwezig) via invoice-webhook; geen dubbele finalize nodig
          }
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

      const { data: orderCust } = await supabase.from('customers').select('id, name, email, contact_person, account_manager_id, country, vat_id').eq('id', order.customer_id).single();

      const rawKind = (order as { batch_kind?: string }).batch_kind;
      const orderBatchKind =
        rawKind === 'niche_research'
          ? 'niche_research'
          : rawKind === 'bulk_leads'
            ? 'bulk_leads'
            : 'leads';
      const orderNicheTitle =
        typeof (order as { niche_title?: string }).niche_title === 'string'
          ? String((order as { niche_title?: string }).niche_title).trim()
          : '';

      const orderLeadBranchSlug =
        typeof (order as { lead_branch_slug?: string }).lead_branch_slug === 'string'
          ? String((order as { lead_branch_slug: string }).lead_branch_slug).trim()
          : '';

      const researchCompleted =
        orderBatchKind === 'niche_research'
          ? {
              status: 'active' as const,
              leads_delivered: 0,
              completed_at: null as string | null,
            }
          : { status: 'active' as const, leads_delivered: 0, completed_at: null as string | null };

      const orderSourceBatchId =
        typeof (order as { source_batch_id?: string | null }).source_batch_id === 'string'
          ? String((order as { source_batch_id: string }).source_batch_id).trim()
          : null;

      let leadMetaResolved: Awaited<ReturnType<typeof resolveMetaCampaignFieldsForNewLeadBatch>> | null = null;
      if (isMetaCampaignSyncBatchKind(orderBatchKind)) {
        const metaBranch =
          orderBatchKind === 'niche_research' && orderLeadBranchSlug
            ? orderLeadBranchSlug
            : order.branch;
        leadMetaResolved = await resolveMetaCampaignFieldsForNewLeadBatch(supabase, {
          customerId: order.customer_id,
          branch: metaBranch,
          sourceBatchId: orderSourceBatchId,
        });
      }

      const portalNoteBase = order.notes ? `[Portal bestelling] ${order.notes}` : '[Portal bestelling]';
      const metaAudit =
        leadMetaResolved && leadMetaResolved.inheritance_source !== 'none'
          ? metaInheritanceNoteSuffix(leadMetaResolved.inheritance_source)
          : '';

      const batchInsertPayload: Record<string, unknown> = {
        customer_id: order.customer_id,
        branch: order.branch,
        batch_size: order.batch_size,
        price_per_lead: order.price_per_lead,
        total_price: order.total_price,
        leads_per_week: order.leads_per_week,
        leads_per_day: order.leads_per_day,
        lead_filters: order.lead_filters || [],
        notes: metaAudit ? `${portalNoteBase}${metaAudit}` : portalNoteBase,
        status: researchCompleted.status,
        leads_delivered: researchCompleted.leads_delivered,
        completed_at: researchCompleted.completed_at,
        is_paid: true,
        account_manager_id: orderCust?.account_manager_id || null,
        batch_kind: orderBatchKind,
        delivery_model: normalizeDeliveryModel(
          (order as { delivery_model?: string }).delivery_model,
          orderBatchKind,
        ),
        niche_title: orderNicheTitle || null,
        ...(orderBatchKind === 'niche_research' && orderLeadBranchSlug
          ? { lead_branch_slug: orderLeadBranchSlug }
          : {}),
      };

      if (isMetaCampaignSyncBatchKind(orderBatchKind) && leadMetaResolved) {
        batchInsertPayload.meta_campaign_ids = leadMetaResolved.meta_campaign_ids;
        batchInsertPayload.meta_campaign_paused_ids = leadMetaResolved.meta_campaign_paused_ids;
        batchInsertPayload.meta_campaign_sync_enabled = leadMetaResolved.meta_campaign_sync_enabled;
      }

      const { data: newBatch, error: batchError } = await supabase
        .from('customer_batches')
        .insert(batchInsertPayload)
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

      if (orderBatchKind === 'niche_research' && orderLeadBranchSlug) {
        await ensureCustomerHasBranch(supabase, order.customer_id, orderLeadBranchSlug);
        try {
          distributeUnassignedLeads();
        } catch {
          /* non-blocking */
        }
      }

      if (order.welcome_discount_applied) {
        await supabase
          .from('customers')
          .update({ welcome_offer_used: true })
          .eq('id', order.customer_id);
      }

      // Eerste (of elke) betaalde batch: demo-toewijzingen opruimen en vlag gelijk trekken
      await supabase.from('lead_assignments').delete().eq('customer_id', order.customer_id).eq('source', 'demo');
      await supabase.from('customers').update({ demo_mode: false }).eq('id', order.customer_id);

      const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', order.branch).single();
      const branchName = branchRow?.name || order.branch;

      if (orderCust) {
        const pushBody =
          orderBatchKind === 'niche_research' && orderNicheTitle
            ? `Je onderzoeksbatch voor "${orderNicheTitle}" is bevestigd.`
            : orderBatchKind === 'bulk_leads'
              ? `Je bulk-pakket ${branchName} (${order.batch_size} leads) is bevestigd.`
              : `Je nieuwe batch ${branchName} (${order.batch_size} leads) is aangemaakt.`;

        if (orderBatchKind !== 'bulk_leads') {
          sendOrderConfirmationEmail(orderCust, {
            branch: order.branch,
            branch_name: branchName,
            batch_size: order.batch_size,
            total_price: order.total_price,
            price_per_lead: order.price_per_lead,
          }).catch(() => {});
        }

        sendPushToCustomer(orderCust.id, {
          title: 'Bestelling bevestigd!',
          body: pushBody,
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
        invoice_product:
          orderBatchKind === 'niche_research'
            ? 'niche_research'
            : orderBatchKind === 'bulk_leads'
              ? 'bulk_leads'
              : 'leads',
        niche_title: orderNicheTitle || null,
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
        batch_kind: orderBatchKind,
        niche_title: orderNicheTitle || null,
        billing_country: (orderCust?.country as string | null | undefined) ?? 'NL',
        billing_vat_id: orderCust?.vat_id,
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

      if (orderBatchKind === 'leads') {
        backfillBatch(newBatch.id, 3).catch(() => {});
      }

      if (isMetaCampaignSyncBatchKind(orderBatchKind)) {
        reconcileBatchMetaCampaigns(supabase, newBatch.id, 'finalize').catch(err =>
          console.error('[mollie-webhook] meta reconcile portal batch:', err),
        );
      }

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
