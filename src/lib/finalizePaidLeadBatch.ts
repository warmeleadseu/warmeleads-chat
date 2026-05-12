import type { createServerClient } from '@/lib/supabase';
import { backfillBatch } from '@/lib/distribution';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { sendPushToCustomer } from '@/lib/pushNotification';
import { createInvoice, markInvoicePaid, sendNewBatchAdminEmail } from '@/lib/invoice';
import { insertCelebrationEvent } from '@/lib/celebrationInsert';

type Supabase = ReturnType<typeof createServerClient>;

export type ClaimedBatch = {
  id: string;
  customer_id: string;
  branch: string;
  batch_size: number;
  price_per_lead: number | null;
  total_price: number | null;
  leads_per_week: number | null;
  leads_per_day: number | null;
  lead_filters: unknown;
  starts_at: string | null;
  lookback_days: number | null;
  batch_kind?: string | null;
};

/**
 * Bulk-lead pakket: geen verse-lead distributie, geen batch_orders als portal-bestelling,
 * wél factuur-afhandeling, admin-melding, celebration, demo-uit.
 */
export async function finalizePaidBulkLeadBatch(
  supabase: Supabase,
  claimed: ClaimedBatch,
  paymentId: string,
  options: { skipInvoiceHandling?: boolean } = {},
): Promise<void> {
  const { data: cust } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, account_manager_id, country, vat_id')
    .eq('id', claimed.customer_id)
    .single();

  if (cust?.account_manager_id) {
    await supabase
      .from('customer_batches')
      .update({ account_manager_id: cust.account_manager_id })
      .eq('id', claimed.id)
      .is('account_manager_id', null);
  }

  const { data: branchRow } = await supabase.from('branches').select('name').eq('slug', claimed.branch).single();
  const branchName = branchRow?.name || claimed.branch;

  if (cust) {
    sendPushToCustomer(cust.id, {
      title: 'Betaling ontvangen',
      body: `Je bulk-pakket ${branchName} (${claimed.batch_size} leads) is betaald. De leads worden via het CRM aan je portaal toegevoegd.`,
      url: '/portal/account?tab=invoices',
      tag: 'bulk-batch-paid',
    }).catch(() => {});
  }

  if (
    !options.skipInvoiceHandling &&
    Number(claimed.price_per_lead) > 0 &&
    Number(claimed.total_price) > 0
  ) {
    markInvoicePaid(claimed.id, paymentId)
      .then(updated => {
        if (updated) return;
        return createInvoice({
          customer_id: claimed.customer_id,
          batch_id: claimed.id,
          branch_name: branchName,
          batch_size: claimed.batch_size,
          price_per_lead: Number(claimed.price_per_lead),
          total_price: Number(claimed.total_price),
          mollie_payment_id: paymentId,
          paid_at: new Date().toISOString(),
          invoice_product: 'bulk_leads',
        });
      })
      .catch(e => console.error('[finalizePaidBulkLeadBatch] invoice handling failed:', e));
  }

  sendNewBatchAdminEmail({
    customer_name: cust?.name || 'Onbekend',
    branch_name: `${branchName} (bulk)`,
    batch_size: claimed.batch_size,
    total_price: Number(claimed.total_price || 0),
    price_per_lead: Number(claimed.price_per_lead || 0),
    is_paid: true,
    source: 'portal_pay',
    batch_kind: 'bulk_leads',
    billing_country: cust?.country,
    billing_vat_id: cust?.vat_id,
  }).catch(() => {});

  insertCelebrationEvent(
    supabase,
    cust?.name || 'Onbekend',
    claimed.branch,
    Number(claimed.total_price || 0),
    claimed.customer_id,
    cust?.account_manager_id || null,
  ).catch(() => {});

  await supabase.from('lead_assignments').delete().eq('customer_id', claimed.customer_id).eq('source', 'demo');
  await supabase.from('customers').update({ demo_mode: false }).eq('id', claimed.customer_id);
}

/**
 * After Mollie confirms payment: emails, factuur, batch_orders, admin-mail, celebration, demo uit, backfill.
 * Gebruikt door batch:-webhook en invoice:-webhook (batch gekoppeld aan factuur).
 */
export async function finalizePaidLeadBatch(
  supabase: Supabase,
  claimed: ClaimedBatch,
  paymentId: string,
  options: { skipInvoiceHandling?: boolean } = {},
): Promise<void> {
  const { data: cust } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, account_manager_id, country, vat_id')
    .eq('id', claimed.customer_id)
    .single();

  if (cust?.account_manager_id) {
    await supabase
      .from('customer_batches')
      .update({ account_manager_id: cust.account_manager_id })
      .eq('id', claimed.id)
      .is('account_manager_id', null);
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
      body: `Je batch ${branchName} (${claimed.batch_size} leads) is betaald.`,
      url: '/portal',
      tag: 'batch-paid',
    }).catch(() => {});
  }

  if (
    !options.skipInvoiceHandling &&
    Number(claimed.price_per_lead) > 0 &&
    Number(claimed.total_price) > 0
  ) {
    markInvoicePaid(claimed.id, paymentId)
      .then(updated => {
        if (updated) return;
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
      })
      .catch(e => console.error('[finalizePaidLeadBatch] invoice handling failed:', e));
  }

  const { error: orderInsertErr } = await supabase.from('batch_orders').insert({
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
    console.error('[finalizePaidLeadBatch] batch_orders insert failed:', orderInsertErr);
  }

  sendNewBatchAdminEmail({
    customer_name: cust?.name || 'Onbekend',
    branch_name: branchName,
    batch_size: claimed.batch_size,
    total_price: Number(claimed.total_price || 0),
    price_per_lead: Number(claimed.price_per_lead || 0),
    is_paid: true,
    source: 'portal_pay',
    billing_country: cust?.country,
    billing_vat_id: cust?.vat_id,
  }).catch(() => {});

  insertCelebrationEvent(
    supabase,
    cust?.name || 'Onbekend',
    claimed.branch,
    Number(claimed.total_price || 0),
    claimed.customer_id,
    cust?.account_manager_id || null,
  ).catch(() => {});

  await supabase.from('lead_assignments').delete().eq('customer_id', claimed.customer_id).eq('source', 'demo');
  await supabase.from('customers').update({ demo_mode: false }).eq('id', claimed.customer_id);

  const startsInFuture = claimed.starts_at && new Date(claimed.starts_at) > new Date();
  if (!startsInFuture) {
    const lookback = claimed.lookback_days ?? 3;
    if (lookback > 0) backfillBatch(claimed.id, lookback).catch(() => {});
  }
}
