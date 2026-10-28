import type { SupabaseClient } from '@supabase/supabase-js';
import { createBatchPayment, getMollieClient } from './mollie';
import { computeInvoiceVat, mollieBtwLabel } from './invoiceVat';
import { assignLeadToBatch } from './assignLeadToBatch';
import { exclusiviteitVan, laadCampagneRegels } from './campagneExclusiviteit';
import { MIRROR_ASSIGNMENT_SOURCE, MASTER_PORTAL_MIRROR_BY_BRANCH } from './masterPortalMirror';
import { createInvoice, sendNewBatchAdminEmail } from './invoice';
import { sendEmail, layout, cta, EMAIL_BASE_URL } from './email';
import { sendPushToCustomer } from './pushNotification';
import { logAudit } from './audit';
import {
  LOSSE_LEADS_BRANCHES, LOSSE_LEAD_PRIJS, MAX_LEEFTIJD_DAGEN, MAX_PER_AANKOOP, RESERVERING_MINUTEN,
  exclusiefVoorKoper, isVerkoopbaar, leeftijdTekst, terugbetaling, zichtbareAntwoorden, type Bezet,
} from './losseLeadsRegels';

/**
 * Losse leads in het portaal (server): het aanbod, een aankoop starten en een
 * betaalde aankoop verwerken. Regels en teksten staan in losseLeadsRegels.ts.
 */

export type AanbodLead = {
  id: string;
  branch: string;
  plaats: string | null;
  provincie: string | null;
  land: string | null;
  binnen: string;
  leeftijd: string;
  antwoorden: { label: string; waarde: string }[];
};

type LeadRij = {
  id: string; branch: string | null; created_at: string; bron: string | null; phone_valid: boolean | null;
  plaatsnaam: string | null; provincie: string | null; land: string | null; custom_fields: unknown;
  meta_campaign_id: string | null; assigned_customer_ids: string[] | null;
};

const SPIEGELS = new Set(Object.values(MASTER_PORTAL_MIRROR_BY_BRANCH));

/** Wat er nu bezet is voor deze koper: uitgedeeld, gepland, gereserveerd of exclusief elders. */
async function laadBezet(supabase: SupabaseClient, leads: LeadRij[], koperId: string, nu: Date): Promise<Bezet> {
  const ids = leads.map(l => l.id);
  const uitgedeeld = new Set<string>();
  for (const l of leads) {
    if ((l.assigned_customer_ids ?? []).some(c => !SPIEGELS.has(c))) uitgedeeld.add(l.id);
  }
  const gepland = new Set<string>();
  const gereserveerd = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const deel = ids.slice(i, i + 200);
    const [{ data: wacht }, { data: toew }] = await Promise.all([
      supabase.from('geplande_leadleveringen').select('lead_id').eq('status', 'gepland').in('lead_id', deel),
      /* assigned_customer_ids loopt via een trigger; de toewijzingen zelf zijn leidend. */
      supabase.from('lead_assignments').select('lead_id, source').in('lead_id', deel),
    ]);
    for (const r of wacht ?? []) gepland.add(r.lead_id as string);
    for (const r of toew ?? []) if (r.source !== MIRROR_ASSIGNMENT_SOURCE) uitgedeeld.add(r.lead_id as string);
  }
  const { data: open } = await supabase
    .from('losse_lead_aankopen')
    .select('customer_id, lead_ids')
    .eq('status', 'open')
    .gt('gereserveerd_tot', nu.toISOString());
  for (const a of open ?? []) {
    if (a.customer_id === koperId) continue;
    for (const id of (a.lead_ids as string[]) ?? []) gereserveerd.add(id);
  }
  const regels = await laadCampagneRegels(supabase);
  const exclusiefElders = new Set<string>();
  for (const l of leads) {
    const ex = exclusiviteitVan(l, regels, nu);
    if (ex && !ex.klantIds.has(koperId)) exclusiefElders.add(l.id);
  }
  return { uitgedeeld, gepland, gereserveerd, exclusiefElders };
}

async function laadKandidaten(supabase: SupabaseClient, nu: Date, alleenIds?: string[]): Promise<LeadRij[]> {
  const sinds = new Date(nu.getTime() - MAX_LEEFTIJD_DAGEN * 86_400_000).toISOString();
  const uit: LeadRij[] = [];
  for (let p = 0; p < 10; p++) {
    let q = supabase
      .from('leads')
      .select('id, branch, created_at, bron, phone_valid, plaatsnaam, provincie, land, custom_fields, meta_campaign_id, assigned_customer_ids')
      .in('branch', [...LOSSE_LEADS_BRANCHES])
      .gte('created_at', sinds);
    if (alleenIds) q = q.in('id', alleenIds);
    const { data, error } = await q.order('created_at', { ascending: false }).range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(`Leads laden mislukt: ${error.message}`);
    uit.push(...((data ?? []) as LeadRij[]));
    if (!data || data.length < 1000) break;
  }
  return uit;
}

/** Het aanbod voor deze koper, nieuwste eerst, zonder persoonsgegevens. */
export async function laadAanbod(supabase: SupabaseClient, koperId: string, nu: Date = new Date()): Promise<AanbodLead[]> {
  const kandidaten = await laadKandidaten(supabase, nu);
  const bezet = await laadBezet(supabase, kandidaten, koperId, nu);
  return kandidaten
    .filter(l => isVerkoopbaar(l, bezet, nu))
    .map(l => ({
      id: l.id,
      branch: l.branch as string,
      plaats: l.plaatsnaam,
      provincie: l.provincie,
      land: l.land,
      binnen: l.created_at,
      leeftijd: leeftijdTekst(l.created_at, nu),
      antwoorden: zichtbareAntwoorden(l.custom_fields),
    }));
}

export class AankoopFout extends Error {}

type Koper = { id: string; name: string; email: string; country: string | null; vat_id: string | null };

/** Reserveert de leads en maakt de Mollie-betaling. */
export async function startAankoop(
  supabase: SupabaseClient,
  opts: { koper: Koper; portalUserId: string | null; leadIds: string[] },
): Promise<{ aankoopId: string; checkoutUrl: string }> {
  const ids = [...new Set(opts.leadIds.filter(x => typeof x === 'string'))];
  if (ids.length === 0) throw new AankoopFout('Kies minstens één lead.');
  if (ids.length > MAX_PER_AANKOOP) throw new AankoopFout(`Je kunt maximaal ${MAX_PER_AANKOOP} leads tegelijk kopen.`);

  const nu = new Date();
  const kandidaten = await laadKandidaten(supabase, nu, ids);
  const bezet = await laadBezet(supabase, kandidaten, opts.koper.id, nu);
  const vrij = kandidaten.filter(l => isVerkoopbaar(l, bezet, nu));
  if (vrij.length !== ids.length) {
    throw new AankoopFout('Een of meer gekozen leads zijn intussen niet meer beschikbaar. Ververs de lijst en kies opnieuw.');
  }
  const branches = new Set(vrij.map(l => l.branch));
  if (branches.size !== 1) throw new AankoopFout('Koop per keer leads uit één branche.');
  const branch = [...branches][0] as string;

  const totaalExcl = Math.round(LOSSE_LEAD_PRIJS * ids.length * 100) / 100;
  const btw = computeInvoiceVat({ subtotalExclBtw: totaalExcl, country: opts.koper.country ?? 'NL', customerVatId: opts.koper.vat_id });

  const { data: aankoop, error } = await supabase
    .from('losse_lead_aankopen')
    .insert({
      customer_id: opts.koper.id,
      portal_user_id: opts.portalUserId,
      branch,
      lead_ids: ids,
      prijs_per_lead: LOSSE_LEAD_PRIJS,
      totaal_excl: totaalExcl,
      totaal_incl: btw.total_incl_btw,
      gereserveerd_tot: new Date(nu.getTime() + RESERVERING_MINUTEN * 60_000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !aankoop) throw new Error(`Aankoop vastleggen mislukt: ${error?.message}`);

  const { data: br } = await supabase.from('branches').select('name').eq('slug', branch).maybeSingle();
  const basis = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
  try {
    const payment = await createBatchPayment({
      orderId: `losse:${aankoop.id}`,
      kind: 'losse_leads',
      amount: btw.total_incl_btw,
      description: `WarmeLeads: ${ids.length} losse ${(br?.name as string | undefined) || branch}-leads (${mollieBtwLabel(btw.vat_mode)})`,
      redirectUrl: `${basis}/portal/extra-leads?aankoop=${aankoop.id}`,
      webhookUrl: `${basis}/api/webhooks/mollie`,
      customerEmail: opts.koper.email,
      customerName: opts.koper.name,
      billingCountry: opts.koper.country,
    });
    await supabase.from('losse_lead_aankopen').update({ mollie_payment_id: payment.id }).eq('id', aankoop.id);
    return { aankoopId: aankoop.id, checkoutUrl: payment.getCheckoutUrl() ?? '' };
  } catch (e) {
    await supabase.from('losse_lead_aankopen').delete().eq('id', aankoop.id);
    throw e;
  }
}

/** Betaling mislukt, verlopen of geannuleerd: de reservering vervalt meteen. */
export async function markeerAankoopMislukt(supabase: SupabaseClient, aankoopId: string): Promise<void> {
  await supabase.from('losse_lead_aankopen').update({ status: 'mislukt' }).eq('id', aankoopId).eq('status', 'open');
}

const INFO = 'info@warmeleads.eu';

/**
 * Betaald: levert wat nog vrij is als afgeronde bulkbatch met factuur, en
 * betaalt de rest terug. Idempotent: een tweede webhook doet niets.
 */
export async function verwerkBetaaldeAankoop(supabase: SupabaseClient, aankoopId: string, paymentId: string): Promise<void> {
  const nu = new Date();
  const { data: a } = await supabase
    .from('losse_lead_aankopen')
    .update({ status: 'betaald', betaald_op: nu.toISOString(), mollie_payment_id: paymentId })
    .eq('id', aankoopId)
    /* Ook na het verlopen van de reservering (of een eerder "mislukt"): er
       is betaald, dus leveren wat kan en de rest terugbetalen. */
    .in('status', ['open', 'mislukt'])
    .select('*')
    .maybeSingle();
  if (!a) return;

  const leadIds = (a.lead_ids as string[]) ?? [];
  const { data: klant } = await supabase
    .from('customers')
    .select('id, name, email, contact_person, account_manager_id, demo_mode')
    .eq('id', a.customer_id)
    .single();

  /* Leidend is wat er nú is toegewezen of gepland, niet wat bij het afrekenen gold. */
  const [{ data: toew }, { data: wacht }, { data: leads }] = await Promise.all([
    supabase.from('lead_assignments').select('lead_id, source').in('lead_id', leadIds),
    supabase.from('geplande_leadleveringen').select('lead_id').eq('status', 'gepland').in('lead_id', leadIds),
    supabase.from('leads').select('id, branch, lat, lng, provincie, land, postcode, plaatsnaam, custom_fields').in('id', leadIds),
  ]);
  const bezet = new Set<string>([
    ...(toew ?? []).filter(t => t.source !== MIRROR_ASSIGNMENT_SOURCE).map(t => t.lead_id as string),
    ...(wacht ?? []).map(w => w.lead_id as string),
  ]);
  const perId = new Map((leads ?? []).map(l => [l.id as string, l]));
  const vrij = leadIds.filter(id => perId.has(id) && !bezet.has(id));

  const { data: br } = await supabase.from('branches').select('name').eq('slug', a.branch).maybeSingle();
  const brancheNaam = (br?.name as string | undefined) || a.branch;
  const prijs = Number(a.prijs_per_lead);

  const geleverd: string[] = [];
  let batchId: string | null = null;
  if (vrij.length > 0) {
    const { data: batch, error } = await supabase
      .from('customer_batches')
      .insert({
        customer_id: a.customer_id,
        branch: a.branch,
        batch_size: vrij.length,
        price_per_lead: prijs,
        total_price: Math.round(prijs * vrij.length * 100) / 100,
        status: 'completed',
        completed_at: nu.toISOString(),
        is_paid: true,
        mollie_payment_id: paymentId,
        batch_kind: 'bulk_leads',
        delivery_model: 'manual',
        leads_delivered: 0,
        notes: 'Losse leads via het portaal (buiten regio, nooit eerder geleverd)',
        account_manager_id: klant?.account_manager_id ?? null,
      })
      .select('id')
      .single();
    if (error || !batch) {
      /* Zonder batch niets leveren; Mollie probeert de webhook opnieuw. */
      await supabase.from('losse_lead_aankopen').update({ status: 'open' }).eq('id', aankoopId);
      throw new Error(`Batch voor losse leads aanmaken mislukt: ${error?.message}`);
    }
    batchId = batch.id;
    for (const id of vrij) {
      const l = perId.get(id)!;
      const r = await assignLeadToBatch({
        supabase,
        lead: { id, branch: l.branch as string, lat: l.lat as number | null, lng: l.lng as number | null, provincie: l.provincie as string | null, land: l.land as string | null, postcode: l.postcode as string | null, plaatsnaam: l.plaatsnaam as string | null },
        customer: { id: a.customer_id },
        batchId: batch.id,
        source: 'bulk_assign',
        skipGuardrails: true,
        notities: 'Losse lead gekocht in het portaal',
      });
      if (r.ok) geleverd.push(id);
    }
    /* De koper blijft de enige: geen tweede of derde klant via de verdeling. */
    for (const id of geleverd) {
      const { error: capErr } = await supabase
        .from('leads')
        .update({ custom_fields: exclusiefVoorKoper(perId.get(id)!.custom_fields) })
        .eq('id', id);
      if (capErr) console.error('[losse-leads] exclusief zetten mislukt', { leadId: id, err: capErr.message });
    }
  }

  const nietGeleverd = leadIds.filter(id => !geleverd.includes(id));
  const terug = terugbetaling(Number(a.totaal_incl), leadIds.length, nietGeleverd.length);
  if (terug > 0) {
    try {
      await getMollieClient().paymentRefunds.create({
        paymentId,
        amount: { currency: 'EUR', value: terug.toFixed(2) },
        description: `${nietGeleverd.length} losse lead(s) waren niet meer beschikbaar`,
      });
    } catch (e) {
      sendEmail(INFO, '[ACTIE] Terugbetaling losse leads mislukt', layout('Terugbetaling mislukt', `
        <p style="margin:0 0 16px">${klant?.name ?? 'Een klant'} betaalde voor ${leadIds.length} losse leads, maar ${nietGeleverd.length} waren intussen niet meer beschikbaar. De automatische terugbetaling van &euro;${terug.toFixed(2)} lukte niet. Betaal dit met de hand terug in Mollie.</p>
        <p style="margin:0;font-family:monospace;font-size:13px">Mollie: ${paymentId} · aankoop ${aankoopId} · ${String(e).slice(0, 200)}</p>`),
        { type: 'mollie_error', metadata: { aankoop_id: aankoopId, payment_id: paymentId, error_type: 'refund_failed' } },
      ).catch(() => {});
    }
  }

  /* Batch op de werkelijke levering zetten (als niet alles lukte). */
  if (batchId && geleverd.length !== vrij.length) {
    if (geleverd.length === 0) {
      await supabase.from('customer_batches').delete().eq('id', batchId);
      batchId = null;
    } else {
      await supabase.from('customer_batches')
        .update({ batch_size: geleverd.length, total_price: Math.round(prijs * geleverd.length * 100) / 100 })
        .eq('id', batchId);
    }
  }

  await supabase.from('losse_lead_aankopen').update({
    batch_id: batchId,
    geleverd_ids: geleverd,
    terugbetaald_ids: nietGeleverd,
    terugbetaald_bedrag: terug,
  }).eq('id', aankoopId);

  if (batchId && geleverd.length > 0) {
    await createInvoice({
      customer_id: a.customer_id,
      batch_id: batchId,
      branch_name: brancheNaam,
      batch_size: geleverd.length,
      price_per_lead: prijs,
      total_price: Math.round(prijs * geleverd.length * 100) / 100,
      mollie_payment_id: paymentId,
      paid_at: nu.toISOString(),
      invoice_product: 'losse_leads',
    }).catch(e => console.error('[losse-leads] factuur mislukt:', e));

    /* Wie koopt is klant: demoleads opruimen, net als bij een eerste batch. */
    if (klant?.demo_mode) {
      await supabase.from('lead_assignments').delete().eq('customer_id', a.customer_id).eq('source', 'demo');
      await supabase.from('customers').update({ demo_mode: false }).eq('id', a.customer_id);
    }

    sendPushToCustomer(a.customer_id, {
      title: 'Je losse leads staan klaar',
      body: `${geleverd.length} ${brancheNaam}-lead${geleverd.length === 1 ? '' : 's'} staan nu in je portaal.`,
      url: '/portal',
      tag: 'losse-leads',
    }).catch(() => {});

    sendNewBatchAdminEmail({
      customer_name: klant?.name || 'Onbekend',
      branch_name: `${brancheNaam} (losse leads)`,
      batch_size: geleverd.length,
      total_price: Math.round(prijs * geleverd.length * 100) / 100,
      price_per_lead: prijs,
      is_paid: true,
      source: 'portal',
      batch_kind: 'bulk_leads',
    }).catch(() => {});
  }

  if (klant?.email) {
    const titel = geleverd.length > 0 ? `Je ${geleverd.length} losse leads staan in je portaal` : 'Je losse leads waren niet meer beschikbaar';
    const tekst = geleverd.length > 0
      ? `<p style="margin:0 0 8px">Bedankt voor je aankoop. ${geleverd.length} ${brancheNaam}-lead${geleverd.length === 1 ? '' : 's'} staan nu met alle contactgegevens in je portaal.</p>
         ${nietGeleverd.length > 0 ? `<p style="margin:0 0 8px">${nietGeleverd.length} lead${nietGeleverd.length === 1 ? ' was' : 's waren'} intussen niet meer beschikbaar. Daarvoor krijg je &euro;${terug.toFixed(2)} terug via Mollie.</p>` : ''}`
      : `<p style="margin:0 0 8px">Helaas waren de gekozen leads intussen niet meer beschikbaar. Je krijgt het volledige bedrag van &euro;${terug.toFixed(2)} terug via Mollie.</p>`;
    sendEmail(klant.email, titel, layout(titel, `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo ${klant.contact_person || klant.name},</p>
      ${tekst}
      ${cta(geleverd.length > 0 ? 'Naar je leads &rarr;' : 'Bekijk andere extra leads &rarr;', `${EMAIL_BASE_URL}${geleverd.length > 0 ? '/portal' : '/portal/extra-leads'}`)}`),
      { type: 'losse_leads_geleverd', toName: klant.contact_person || klant.name, metadata: { customer_id: a.customer_id, aankoop_id: aankoopId, geleverd: geleverd.length, terug } },
    ).catch(() => {});
  }

  void logAudit({
    adminName: 'Portaal',
    action: 'losse_leads_gekocht',
    entityType: 'losse_lead_aankoop',
    entityId: aankoopId,
    details: { customer_id: a.customer_id, branch: a.branch, gekocht: leadIds.length, geleverd: geleverd.length, terugbetaald: terug, batch_id: batchId },
  });
}
