import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import type { InvoiceLineItem } from '@/lib/invoicePdf';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';

interface CreateInvoiceParams {
  customer_id: string;
  batch_order_id?: string;
  batch_id?: string;
  branch_name: string;
  batch_size: number;
  price_per_lead: number;
  total_price: number;
  mollie_payment_id?: string;
  paid_at?: string;
  status?: 'paid' | 'open';
}

async function getNextInvoiceNumber(supabase: ReturnType<typeof createServerClient>): Promise<string> {
  const year = new Date().getFullYear();
  const { data, error } = await supabase.rpc('nextval_invoice');

  if (!error && data != null && Number(data) > 0) {
    return `WL-${year}-${String(data).padStart(4, '0')}`;
  }

  if (error) console.error('[invoice] nextval_invoice RPC failed:', error.message);

  // Fallback: find highest existing number this year and increment
  const { data: latest } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `WL-${year}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latest?.invoice_number) {
    const parts = latest.invoice_number.split('-');
    const lastNum = parseInt(parts[2] || '0', 10);
    return `WL-${year}-${String(lastNum + 1).padStart(4, '0')}`;
  }

  return `WL-${year}-0001`;
}

export async function createInvoice(params: CreateInvoiceParams) {
  const supabase = createServerClient();

  if (params.batch_id) {
    const { data: existingInv } = await supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('batch_id', params.batch_id)
      .neq('status', 'credit_note')
      .limit(1)
      .maybeSingle();
    if (existingInv) {
      console.warn(`[invoice] skipping duplicate: invoice ${existingInv.invoice_number} already exists for batch ${params.batch_id}`);
      return existingInv;
    }
  }

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, address, vat_id, kvk_nummer')
    .eq('id', params.customer_id)
    .single();

  if (custErr || !customer) {
    throw new Error(custErr?.message || `Customer not found (id: ${params.customer_id})`);
  }

  const subtotal = Number(params.total_price);
  const btwPercentage = 21;
  const btwAmount = Math.round(subtotal * (btwPercentage / 100) * 100) / 100;
  const totalInclBtw = subtotal + btwAmount;

  const lineItems: InvoiceLineItem[] = [{
    description: `${params.branch_name} leads`,
    quantity: params.batch_size,
    unit_price: Number(params.price_per_lead),
    total: subtotal,
  }];

  const invoiceNumber = await getNextInvoiceNumber(supabase);
  const now = new Date().toISOString();

  const invoiceStatus = params.status || 'paid';
  const isPaid = invoiceStatus === 'paid';

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      customer_id: params.customer_id,
      batch_order_id: params.batch_order_id || null,
      batch_id: params.batch_id || null,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_address: customer.address || null,
      customer_kvk: customer.kvk_nummer || null,
      customer_vat_id: customer.vat_id || null,
      description: `${params.batch_size} ${params.branch_name} leads`,
      line_items: lineItems,
      subtotal,
      btw_percentage: btwPercentage,
      btw_amount: btwAmount,
      total_incl_btw: totalInclBtw,
      mollie_payment_id: params.mollie_payment_id || null,
      status: invoiceStatus,
      paid_at: isPaid ? (params.paid_at || now) : null,
    })
    .select()
    .single();

  if (error) {
    console.error('[invoice] creation failed:', error);
    throw error;
  }

  if (isPaid) {
    sendInvoiceEmail(customer, invoice).catch(e => console.error('[invoice] email send failed:', e));
  } else {
    sendOpenInvoiceEmail(customer, invoice).catch(e => console.error('[invoice] open invoice email send failed:', e));
  }

  return invoice;
}

export async function markInvoicePaid(batchId: string, molliePaymentId: string) {
  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_incl_btw, description, customer_id, status')
    .eq('batch_id', batchId)
    .in('status', ['open'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const { data: alreadyPaid } = await supabase
      .from('invoices')
      .select('id')
      .eq('batch_id', batchId)
      .eq('status', 'paid')
      .limit(1)
      .maybeSingle();
    if (alreadyPaid) return alreadyPaid;
    return null;
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: now, mollie_payment_id: molliePaymentId })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('[invoice] markInvoicePaid failed:', error);
    return null;
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, contact_person')
    .eq('id', existing.customer_id)
    .single();

  if (customer) {
    sendInvoiceEmail(customer, updated).catch(e => console.error('[invoice] paid email send failed:', e));
  }

  return updated;
}

function sendOpenInvoiceEmail(
  customer: { name: string; email: string; contact_person?: string },
  invoice: { invoice_number: string; total_incl_btw: number; description: string; id: string },
) {
  const portalUrl = `${BASE_URL}/portal/account`;
  const logoUrl = `${BASE_URL}/warmeleads-logo-2026.png`;
  const greeting = customer.contact_person || customer.name;
  const year = new Date().getFullYear();

  const fullHtml = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Factuur ${invoice.invoice_number}</title></head>
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
                <tr><td style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:6px 14px">
                  <span style="color:#c2410c;font-size:12px;font-weight:700;letter-spacing:0.5px">OPENSTAAND</span>
                </td></tr>
              </table>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;line-height:1.4">Hallo ${greeting},</p>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7">Er staat een nieuwe factuur voor je klaar.</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <tr><td style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Factuurgegevens</span>
                </td></tr>
                <tr><td style="padding:0">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px">Factuurnummer</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${invoice.invoice_number}</td></tr>
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Omschrijving</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${invoice.description}</td></tr>
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Status</td><td style="padding:14px 20px;font-size:14px;border-bottom:1px solid #f1f5f9"><span style="color:#c2410c;font-weight:600">Openstaand</span></td></tr>
                    <tr><td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700">Te betalen</td><td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right">&euro;${Number(invoice.total_incl_btw).toFixed(2)}</td></tr>
                  </table>
                </td></tr>
              </table>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7">Je kunt direct betalen via je portaal. Na betaling wordt je batch direct geactiveerd en ontvang je leads.</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px">
                <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
                  <a href="${portalUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Bekijk factuur &amp; betaal &rarr;</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen over deze factuur? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(
    customer.email,
    `Nieuwe factuur ${invoice.invoice_number} - WarmeLeads`,
    fullHtml,
    { type: 'invoice_open', toName: greeting, metadata: { invoice_id: invoice.id, invoice_number: invoice.invoice_number } },
  );
}

function sendInvoiceEmail(
  customer: { name: string; email: string; contact_person?: string },
  invoice: { invoice_number: string; total_incl_btw: number; description: string; id: string },
) {
  const portalUrl = `${BASE_URL}/portal/account`;
  const logoUrl = `${BASE_URL}/warmeleads-logo-2026.png`;
  const greeting = customer.contact_person || customer.name;
  const year = new Date().getFullYear();

  const fullHtml = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Factuur ${invoice.invoice_number}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">

        <!-- Gradient accent bar -->
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>

        <!-- White card -->
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">

          <!-- Logo header -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9">
              <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
            </td></tr>
          </table>

          <!-- Body content -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px">

              <!-- Status badge -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                <tr><td style="background-color:#ecfdf5;border:1px solid #d1fae5;border-radius:20px;padding:6px 14px">
                  <span style="color:#059669;font-size:12px;font-weight:700;letter-spacing:0.5px">&#10003; BETAALD</span>
                </td></tr>
              </table>

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;line-height:1.4">Hallo ${greeting},</p>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7">Bedankt voor je betaling! Hierbij je factuur <strong style="color:#0f172a">${invoice.invoice_number}</strong>.</p>

              <!-- Invoice details card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <tr><td style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Factuurgegevens</span>
                </td></tr>
                <tr><td style="padding:0">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px">Factuurnummer</td>
                      <td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${invoice.invoice_number}</td>
                    </tr>
                    <tr>
                      <td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Omschrijving</td>
                      <td style="padding:14px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${invoice.description}</td>
                    </tr>
                    <tr>
                      <td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Status</td>
                      <td style="padding:14px 20px;font-size:14px;border-bottom:1px solid #f1f5f9"><span style="color:#059669;font-weight:600">Betaald</span></td>
                    </tr>
                    <tr>
                      <td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700">Totaal incl. BTW</td>
                      <td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right">&euro;${Number(invoice.total_incl_btw).toFixed(2)}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <!-- Description -->
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7">Je kunt je factuur downloaden als PDF via je persoonlijke portaal:</p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px">
                <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
                  <a href="${portalUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Factuur downloaden &rarr;</a>
                </td></tr>
              </table>

            </td></tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen over deze factuur? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(
    customer.email,
    `Factuur ${invoice.invoice_number} - WarmeLeads`,
    fullHtml,
    { type: 'invoice_paid', toName: customer.contact_person || customer.name, metadata: { invoice_id: invoice.id, invoice_number: invoice.invoice_number } },
  );
}

export async function sendNewBatchAdminEmail(params: {
  customer_name: string;
  branch_name: string;
  batch_size: number;
  total_price: number;
  price_per_lead: number;
  is_paid: boolean;
  source: 'portal' | 'admin' | 'portal_pay';
}) {
  const subtotal = Number(params.total_price);
  const btwAmount = Math.round(subtotal * 0.21 * 100) / 100;
  const totalInclBtw = subtotal + btwAmount;
  const logoUrl = `${BASE_URL}/warmeleads-logo-2026.png`;
  const year = new Date().getFullYear();

  const sourceLabel =
    params.source === 'portal' ? 'Portal bestelling'
    : params.source === 'portal_pay' ? 'Portal batch betaling'
    : 'Admin aangemaakt';

  const subject = `Nieuwe batch: ${params.customer_name} - ${params.batch_size} ${params.branch_name} leads`;

  const fullHtml = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
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
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">Nieuwe Batch Aangemaakt</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.7">Er is een nieuwe batch aangemaakt:</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <tr><td style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Batchgegevens</span>
                </td></tr>
                <tr><td style="padding:0">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:160px">Klant</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${params.customer_name}</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Branche</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${params.branch_name}</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Batch grootte</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${params.batch_size} leads</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Prijs per lead</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">&euro;${Number(params.price_per_lead).toFixed(2)}</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Subtotaal excl. BTW</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">&euro;${subtotal.toFixed(2)}</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">BTW 21%</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">&euro;${btwAmount.toFixed(2)}</td></tr>
                    <tr><td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:1px solid #f1f5f9">Totaal incl. BTW</td><td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:1px solid #f1f5f9">&euro;${totalInclBtw.toFixed(2)}</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Bron</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${sourceLabel}</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Betaalstatus</td><td style="padding:12px 20px;font-size:14px;font-weight:700;color:${params.is_paid ? '#059669' : '#dc2626'}">${params.is_paid ? 'Betaald' : 'Onbetaald'}</td></tr>
                  </table>
                </td></tr>
              </table>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px">
                <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
                  <a href="${BASE_URL}/admin/batches" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Bekijk in admin &rarr;</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return sendEmail(
    'info@warmeleads.eu',
    subject,
    fullHtml,
    { type: 'new_batch_admin', metadata: { customer_name: params.customer_name, branch: params.branch_name, batch_size: params.batch_size, source: params.source } },
  );
}
