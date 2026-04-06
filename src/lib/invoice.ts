import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import type { InvoiceLineItem } from '@/lib/invoicePdf';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';

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
}

async function getCompanyDetails(supabase: ReturnType<typeof createServerClient>) {
  const keys = [
    'company_name', 'company_address', 'company_postcode', 'company_city',
    'company_kvk', 'company_btw', 'company_iban', 'company_email',
  ];
  const { data } = await supabase.from('app_settings').select('key, value').in('key', keys);
  const map: Record<string, string> = {};
  (data || []).forEach(r => { map[r.key] = r.value || ''; });
  return {
    company_name: map.company_name || 'WarmeLeads',
    company_address: map.company_address || '',
    company_postcode: map.company_postcode || '',
    company_city: map.company_city || '',
    company_kvk: map.company_kvk || '',
    company_btw: map.company_btw || '',
    company_iban: map.company_iban || '',
    company_email: map.company_email || 'info@warmeleads.eu',
  };
}

async function getNextInvoiceNumber(supabase: ReturnType<typeof createServerClient>): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase.rpc('nextval_invoice');

  if (data) {
    return `WL-${year}-${String(data).padStart(4, '0')}`;
  }

  // Fallback: count existing invoices this year
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01T00:00:00Z`);

  return `WL-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
}

export async function createInvoice(params: CreateInvoiceParams) {
  const supabase = createServerClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, address, vat_id')
    .eq('id', params.customer_id)
    .single();

  if (!customer) throw new Error('Customer not found');

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
      customer_vat_id: customer.vat_id || null,
      description: `${params.batch_size} ${params.branch_name} leads`,
      line_items: lineItems,
      subtotal,
      btw_percentage: btwPercentage,
      btw_amount: btwAmount,
      total_incl_btw: totalInclBtw,
      mollie_payment_id: params.mollie_payment_id || null,
      status: 'paid',
      paid_at: params.paid_at || now,
    })
    .select()
    .single();

  if (error) {
    console.error('[invoice] creation failed:', error);
    throw error;
  }

  // Send invoice email to customer
  sendInvoiceEmail(customer, invoice).catch(() => {});

  return invoice;
}

function sendInvoiceEmail(
  customer: { name: string; email: string; contact_person?: string },
  invoice: { invoice_number: string; total_incl_btw: number; description: string; id: string },
) {
  const downloadUrl = `${BASE_URL}/portal/account`;

  const content = `
    <p>Hallo ${customer.contact_person || customer.name},</p>
    <p>Hierbij ontvangt u factuur <strong>${invoice.invoice_number}</strong> voor:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Omschrijving</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${invoice.description}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#F97316;font-size:15px;font-weight:700;border-top:2px solid rgba(249,115,22,.2)">Totaal incl. BTW</td>
        <td style="padding:10px 12px;color:#F97316;font-size:15px;font-weight:700;text-align:right;border-top:2px solid rgba(249,115,22,.2)">&euro;${Number(invoice.total_incl_btw).toFixed(2)}</td>
      </tr>
    </table>
    <p>U kunt uw factuur downloaden als PDF via uw portaal:</p>
    <p style="margin-top:12px">
      <a href="${downloadUrl}" style="display:inline-block;background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Factuur downloaden &rarr;</a>
    </p>`;

  return sendEmail(
    customer.email,
    `Factuur ${invoice.invoice_number} - WarmeLeads`,
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A1A2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:24px 32px;text-align:center">
    <span style="font-size:24px;font-weight:700;color:#F97316;letter-spacing:-.5px">WarmeLeads</span>
  </td></tr>
  <tr><td style="background:#16213E;border-radius:12px;padding:32px;border:1px solid rgba(249,115,22,.15)">
    <h1 style="margin:0 0 20px;font-size:20px;color:#fff;font-weight:600">Factuur ${invoice.invoice_number}</h1>
    <div style="color:#CBD5E1;font-size:15px;line-height:1.6">${content}</div>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;color:#64748B;font-size:12px">
    &copy; ${new Date().getFullYear()} WarmeLeads &middot; warmeleads.eu
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
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

  const sourceLabel =
    params.source === 'portal' ? 'Portal bestelling'
    : params.source === 'portal_pay' ? 'Portal batch betaling'
    : 'Admin aangemaakt';

  const content = `
    <p>Er is een nieuwe batch aangemaakt:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Klant</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${params.customer_name}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Branche</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${params.branch_name}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Batch grootte</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${params.batch_size} leads</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Prijs per lead</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">&euro;${Number(params.price_per_lead).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Subtotaal excl. BTW</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">&euro;${subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">BTW 21%</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">&euro;${btwAmount.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;color:#F97316;font-size:15px;font-weight:700;border-top:2px solid rgba(249,115,22,.2)">Totaal incl. BTW</td>
        <td style="padding:10px 12px;color:#F97316;font-size:15px;font-weight:700;text-align:right;border-top:2px solid rgba(249,115,22,.2)">&euro;${totalInclBtw.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Bron</td>
        <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${sourceLabel}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#94A3B8;font-size:14px">Betaalstatus</td>
        <td style="padding:8px 12px;color:${params.is_paid ? '#10B981' : '#EF4444'};font-size:14px;font-weight:600">${params.is_paid ? 'Betaald' : 'Onbetaald'}</td>
      </tr>
    </table>
    <p style="margin-top:12px">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu'}/admin/batches" style="display:inline-block;background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk in admin &rarr;</a>
    </p>`;

  return sendEmail(
    'info@warmeleads.eu',
    `Nieuwe batch: ${params.customer_name} - ${params.batch_size} ${params.branch_name} leads`,
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A1A2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:24px 32px;text-align:center">
    <span style="font-size:24px;font-weight:700;color:#F97316;letter-spacing:-.5px">WarmeLeads</span>
  </td></tr>
  <tr><td style="background:#16213E;border-radius:12px;padding:32px;border:1px solid rgba(249,115,22,.15)">
    <h1 style="margin:0 0 20px;font-size:20px;color:#fff;font-weight:600">Nieuwe Batch Aangemaakt</h1>
    <div style="color:#CBD5E1;font-size:15px;line-height:1.6">${content}</div>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;color:#64748B;font-size:12px">
    &copy; ${new Date().getFullYear()} WarmeLeads &middot; warmeleads.eu
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  );
}
