import type { SupabaseClient } from '@supabase/supabase-js';
import { createBatchPayment } from './mollie';
import { computeInvoiceVat, mollieBtwLabel } from './invoiceVat';
import { loadWelcomeOfferStatus, welcomeDiscountAmount } from './welcomeOffer';
import { deliveryModelForNewBatch } from './batchDeliveryModel';
import type { HerbestelBron } from './herbestelToken';

/**
 * Een batch opnieuw bestellen vanaf een link in de mail, zonder inloggen.
 *
 * Zelfde bestelling als nabestellen in het portaal (`/api/portal/orders` met
 * source_batch_id): dezelfde prijs per lead, hetzelfde dag- en weekmaximum en
 * dezelfde filters als de batch waar de link bij hoort, betaling via Mollie, en
 * na betaling maakt de webhook de batch aan (met de Meta-campagnes van de
 * vorige batch). Alleen de grootte kan de klant aanpassen.
 */

export const HERBESTEL_MIN = 10;
export const HERBESTEL_MAX = 1000;
const STANDAARD_GROOTTES = [20, 30, 50, 75, 100, 200];

/** Oorspronkelijke grootte: compensaties (vervangen leads) tellen niet mee. */
export function oorspronkelijkeGrootte(batch: { batch_size: number; compensations?: unknown }): number {
  const comps = Array.isArray(batch.compensations) ? (batch.compensations as { amount?: number }[]) : [];
  const extra = comps.reduce((s, c) => s + (Number(c?.amount) || 0), 0);
  return Math.max(HERBESTEL_MIN, batch.batch_size - extra);
}

/** Keuzes in de knoppenrij: de vorige grootte plus de gangbare maten. */
export function grootteKeuzes(vorige: number): number[] {
  return [...new Set([vorige, ...STANDAARD_GROOTTES])]
    .filter(n => n >= HERBESTEL_MIN && n <= HERBESTEL_MAX)
    .sort((a, b) => a - b);
}

export function geldigeGrootte(n: unknown): number | null {
  const g = typeof n === 'string' ? Number(n) : n;
  return typeof g === 'number' && Number.isInteger(g) && g >= HERBESTEL_MIN && g <= HERBESTEL_MAX ? g : null;
}

export type HerbestelGegevens = {
  batch: {
    id: string; customer_id: string; branch: string; batch_size: number; price_per_lead: number;
    leads_per_week: number | null; leads_per_day: number | null; lead_filters: unknown[]; status: string;
  };
  klant: { id: string; name: string; email: string; contact_person: string | null; country: string | null; vat_id: string | null };
  brancheNaam: string;
  vorigeGrootte: number;
  /** Er loopt al een nieuwere batch in dezelfde branche (actief, gepauzeerd of wacht op betaling). */
  alNabesteld: boolean;
};

/** Alles wat de herbestelpagina nodig heeft, of een reden waarom het niet kan. */
export async function laadHerbestelling(
  supabase: SupabaseClient,
  batchId: string,
): Promise<{ ok: true; data: HerbestelGegevens } | { ok: false; reden: 'niet_gevonden' | 'niet_mogelijk' }> {
  const { data: b } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, price_per_lead, leads_per_week, leads_per_day, lead_filters, compensations, status, batch_kind, delivery_model, created_at, customers(id, name, email, contact_person, country, vat_id, is_active, demo_mode, intern)')
    .eq('id', batchId)
    .maybeSingle();
  if (!b) return { ok: false, reden: 'niet_gevonden' };
  const k = (Array.isArray(b.customers) ? b.customers[0] : b.customers) as
    | { id: string; name: string; email: string | null; contact_person: string | null; country: string | null; vat_id: string | null; is_active: boolean | null; demo_mode: boolean | null; intern: boolean | null }
    | null;
  /* Alleen gewone leadbatches met een prijs; geen bulk, onderzoek, demo of intern. */
  if (
    !k || !k.email || k.is_active === false || k.demo_mode || k.intern ||
    (b.batch_kind ?? 'leads') !== 'leads' || b.delivery_model === 'manual' || b.delivery_model === 'unlimited' ||
    !(Number(b.price_per_lead) > 0)
  ) {
    return { ok: false, reden: 'niet_mogelijk' };
  }

  const [{ data: branche }, { data: later }] = await Promise.all([
    supabase.from('branches').select('name').eq('slug', b.branch).maybeSingle(),
    supabase
      .from('customer_batches')
      .select('id')
      .eq('customer_id', b.customer_id)
      .eq('branch', b.branch)
      .in('status', ['active', 'paused', 'pending_payment'])
      .gt('created_at', b.created_at)
      .neq('id', b.id)
      .limit(1),
  ]);

  return {
    ok: true,
    data: {
      batch: {
        id: b.id, customer_id: b.customer_id, branch: b.branch, batch_size: b.batch_size,
        price_per_lead: Number(b.price_per_lead), leads_per_week: b.leads_per_week, leads_per_day: b.leads_per_day,
        lead_filters: Array.isArray(b.lead_filters) ? b.lead_filters : [], status: b.status,
      },
      klant: { id: k.id, name: k.name, email: k.email, contact_person: k.contact_person, country: k.country, vat_id: k.vat_id },
      brancheNaam: (branche?.name as string | undefined) || b.branch,
      vorigeGrootte: oorspronkelijkeGrootte(b),
      alNabesteld: (later ?? []).length > 0,
    },
  };
}

/** Bedragen voor een gekozen grootte, inclusief eventuele welkomstkorting en btw. */
export async function berekenHerbestelling(
  supabase: SupabaseClient,
  g: HerbestelGegevens,
  grootte: number,
): Promise<{ subtotaal: number; korting: number; totaalExcl: number; totaalIncl: number; btwLabel: string; welkomst: boolean }> {
  const welkomst = (await loadWelcomeOfferStatus(supabase, g.klant.id)).active;
  const subtotaal = Math.round(g.batch.price_per_lead * grootte * 100) / 100;
  const korting = welkomst ? welcomeDiscountAmount(subtotaal) : 0;
  const totaalExcl = Math.round((subtotaal - korting) * 100) / 100;
  const btw = computeInvoiceVat({ subtotalExclBtw: totaalExcl, country: g.klant.country ?? 'NL', customerVatId: g.klant.vat_id });
  return { subtotaal, korting, totaalExcl, totaalIncl: btw.total_incl_btw, btwLabel: mollieBtwLabel(btw.vat_mode), welkomst: welkomst && korting > 0 };
}

/** Maakt de bestelling en de Mollie-betaling; de webhook doet de rest. */
export async function startHerbestelling(
  supabase: SupabaseClient,
  g: HerbestelGegevens,
  opts: { grootte: number; bron: HerbestelBron | null; terugUrl: (orderId: string) => string },
): Promise<{ orderId: string; checkoutUrl: string }> {
  const bedrag = await berekenHerbestelling(supabase, g, opts.grootte);
  const { data: order, error } = await supabase
    .from('batch_orders')
    .insert({
      customer_id: g.klant.id,
      branch: g.batch.branch,
      batch_size: opts.grootte,
      price_per_lead: g.batch.price_per_lead,
      total_price: bedrag.totaalExcl,
      leads_per_week: g.batch.leads_per_week,
      leads_per_day: g.batch.leads_per_day,
      lead_filters: g.batch.lead_filters,
      notes: `Herbesteld met één klik${opts.bron ? ` (mail ${opts.bron})` : ''}`,
      source_batch_id: g.batch.id,
      status: 'pending',
      welcome_discount_applied: bedrag.welkomst,
      batch_kind: 'leads',
      delivery_model: deliveryModelForNewBatch('leads'),
      niche_title: null,
    })
    .select('id')
    .single();
  if (error || !order) throw new Error('Bestelling aanmaken mislukt');

  const basis = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
  let payment;
  try {
    payment = await createBatchPayment({
      orderId: order.id,
      amount: bedrag.totaalIncl,
      description: `WarmeLeads batch: ${opts.grootte} ${g.brancheNaam} leads${bedrag.welkomst ? ' (incl. 20% welkomstkorting)' : ''} (${bedrag.btwLabel})`,
      redirectUrl: opts.terugUrl(order.id),
      webhookUrl: `${basis}/api/webhooks/mollie`,
      customerEmail: g.klant.email,
      customerName: g.klant.name,
      billingCountry: g.klant.country,
    });
  } catch (e) {
    await supabase.from('batch_orders').delete().eq('id', order.id);
    throw e;
  }
  await supabase.from('batch_orders').update({ mollie_payment_id: payment.id }).eq('id', order.id);
  return { orderId: order.id, checkoutUrl: payment.getCheckoutUrl() ?? '' };
}
