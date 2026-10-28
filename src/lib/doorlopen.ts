import type { SupabaseClient } from '@supabase/supabase-js';
import { logAudit } from './audit';
import { accountmanagerOntvanger } from './accountmanagerOntvanger';
import { kopieerBatchGebied } from './batchTargetInsert';
import { zonderBotsingen } from './campagneExclusiviteit';
import { doorloopStopUrl } from './doorloopToken';
import {
  BETAALTERMIJN_DAGEN, batchKanDoorlopen, betaalUiterlijk, doorloopGrootte, magStarten, magZelfAanzetten,
  ZELF_AANZETTEN_UITLEG, type ZelfAanzettenReden,
} from './doorlopenRegels';
import {
  sendDoorloopAankondigingEmail, sendDoorloopGestartEmail, sendDoorloopSignaalEmail, sendDoorlopendAanEmail, sendEmail, layout,
} from './email';
import { oorspronkelijkeGrootte } from './herbestelling';
import { createInvoice } from './invoice';
import { ensureInvoiceMollieCheckout } from './invoiceCheckout';
import { computeInvoiceVat } from './invoiceVat';
import { resolveMetaCampaignFieldsForNewLeadBatch } from './metaCampaignInheritance';
import { reconcileBatchMetaCampaigns } from './metaBatchCampaignSync';
import { sendPushToCustomer } from './pushNotification';

/**
 * Doorlopend op factuur (server). Regels en bedragen staan in
 * doorlopenRegels.ts; dit bestand doet het werk in de database en de mails.
 *
 * Alles hier begint bij een klant met `doorlopend = true`, een keuze van de
 * klant of de accountmanager. Voor alle andere klanten doet niets hier iets.
 */

const INFO = 'info@warmeleads.eu';
const PORTAAL_FACTUREN = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu'}/portal/account?tab=invoices`;

export type DoorloopDoor = { soort: 'beheer' | 'klant' | 'systeem'; id?: string | null; naam?: string | null };

type Klant = {
  id: string; name: string; email: string; contact_person: string | null; phone: string | null;
  country: string | null; vat_id: string | null; account_manager_id: string | null;
  intern: boolean | null; demo_mode: boolean | null; is_active: boolean | null;
  doorlopend: boolean; doorlopend_sinds: string | null; doorlopend_door: 'beheer' | 'klant' | null;
};
const KLANT_VELDEN = 'id, name, email, contact_person, phone, country, vat_id, account_manager_id, intern, demo_mode, is_active, doorlopend, doorlopend_sinds, doorlopend_door';

async function laadKlant(supabase: SupabaseClient, id: string): Promise<Klant | null> {
  const { data } = await supabase.from('customers').select(KLANT_VELDEN).eq('id', id).maybeSingle();
  return (data as Klant | null) ?? null;
}

const mailKlant = (k: Klant) => ({ id: k.id, name: k.name, email: k.email, contact_person: k.contact_person ?? undefined, country: k.country, vat_id: k.vat_id });

async function brancheNaam(supabase: SupabaseClient, slug: string): Promise<string> {
  const { data } = await supabase.from('branches').select('name').eq('slug', slug).maybeSingle();
  return (data?.name as string | undefined) || slug;
}

/* ─── Status en aan/uit ───────────────────────────────────────── */

export type DoorloopStatus = {
  aan: boolean;
  sinds: string | null;
  door: 'beheer' | 'klant' | null;
  /** Mag de klant het zelf aanzetten (beheer mag altijd)? */
  zelf: ZelfAanzettenReden;
  uitleg: string | null;
  /** Onbetaalde doorloopfactuur, als die er is. */
  openFactuur: { nummer: string; bedrag: number; uiterlijk: string | null } | null;
};

export async function doorloopStatus(supabase: SupabaseClient, customerId: string): Promise<DoorloopStatus | null> {
  const k = await laadKlant(supabase, customerId);
  if (!k) return null;
  const nu = new Date().toISOString();
  const [{ count: betaald }, { count: achterstallig }, { data: open }] = await Promise.all([
    supabase.from('customer_batches').select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('batch_kind', 'leads').eq('is_paid', true),
    supabase.from('invoices').select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId).eq('status', 'open').lt('due_date', nu),
    supabase.from('customer_batches').select('id').eq('customer_id', customerId).eq('op_factuur', true)
      .not('is_paid', 'is', true).neq('status', 'expired').order('created_at', { ascending: false }).limit(1),
  ]);
  let openFactuur: DoorloopStatus['openFactuur'] = null;
  const openBatch = (open ?? [])[0] as { id: string } | undefined;
  if (openBatch) {
    const { data: f } = await supabase.from('invoices').select('invoice_number, total_incl_btw, due_date')
      .eq('batch_id', openBatch.id).eq('status', 'open').maybeSingle();
    if (f) openFactuur = { nummer: f.invoice_number as string, bedrag: Number(f.total_incl_btw), uiterlijk: (f.due_date as string | null) ?? null };
  }
  const zelf = magZelfAanzetten({ betaaldeBatches: betaald ?? 0, achterstalligeFacturen: achterstallig ?? 0, intern: k.intern, demo: k.demo_mode });
  return {
    aan: k.doorlopend, sinds: k.doorlopend_sinds, door: k.doorlopend_door,
    zelf, uitleg: zelf === 'ok' ? null : ZELF_AANZETTEN_UITLEG[zelf], openFactuur,
  };
}

/**
 * Zet doorlopend aan of uit. Een klant mag het zelf aanzetten volgens
 * `magZelfAanzetten`; beheer altijd, behalve voor interne en demoklanten.
 * Uitzetten mag iedereen, altijd.
 */
export async function zetDoorlopend(
  supabase: SupabaseClient,
  customerId: string,
  aan: boolean,
  door: DoorloopDoor,
): Promise<{ ok: true; gewijzigd: boolean } | { ok: false; fout: string }> {
  const k = await laadKlant(supabase, customerId);
  if (!k) return { ok: false, fout: 'Klant niet gevonden' };
  if (k.doorlopend === aan) return { ok: true, gewijzigd: false };

  if (aan) {
    if (k.intern || k.demo_mode) return { ok: false, fout: ZELF_AANZETTEN_UITLEG.niet_beschikbaar };
    if (door.soort === 'klant') {
      const s = await doorloopStatus(supabase, customerId);
      if (!s || s.zelf !== 'ok') return { ok: false, fout: s?.uitleg ?? 'Aanzetten lukt nu niet' };
    }
  }

  const { data: bijgewerkt, error } = await supabase
    .from('customers')
    .update(aan
      ? { doorlopend: true, doorlopend_sinds: new Date().toISOString(), doorlopend_door: door.soort === 'klant' ? 'klant' : 'beheer' }
      : { doorlopend: false })
    .eq('id', customerId)
    .eq('doorlopend', !aan)
    .select('id');
  if (error) return { ok: false, fout: error.message };
  if (!bijgewerkt || bijgewerkt.length === 0) return { ok: true, gewijzigd: false };

  void logAudit({
    adminId: door.soort === 'beheer' ? door.id ?? null : null,
    adminName: door.naam ?? (door.soort === 'klant' ? `Klant (${k.name})` : 'Systeem'),
    action: aan ? 'doorlopend_aan' : 'doorlopend_uit',
    entityType: 'customer',
    entityId: customerId,
    details: { door: door.soort },
  });

  if (aan) {
    const stopUrl = doorloopStopUrl(customerId);
    await sendDoorlopendAanEmail(mailKlant(k), { door: door.soort === 'klant' ? 'klant' : 'beheer', stopUrl }).catch(() => {});
    if (door.soort === 'klant') {
      const naar = await accountmanagerOntvanger(supabase, { klantAm: k.account_manager_id });
      void sendDoorloopSignaalEmail(naar, {
        soort: 'aangezet_door_klant', klant: k.name, contactpersoon: k.contact_person, telefoon: k.phone, klantEmail: k.email,
        branche: '-', batchId: null, customerId,
      }).catch(() => {});
    }
    /* Een lopende batch die al voorbij 90% is, krijgt nu de aankondiging. */
    const { data: lopend } = await supabase
      .from('customer_batches')
      .select('id, batch_size, leads_delivered')
      .eq('customer_id', customerId).eq('status', 'active').eq('batch_kind', 'leads').is('doorloop_aangekondigd_op', null);
    for (const b of lopend ?? []) {
      if (Number(b.batch_size) > 0 && Number(b.leads_delivered) / Number(b.batch_size) >= 0.9) {
        await kondigDoorloopAan(supabase, b.id as string).catch(e => console.error('[doorlopen] aankondigen mislukt', e));
      }
    }
  }
  return { ok: true, gewijzigd: true };
}

/* ─── Aankondigen en starten ──────────────────────────────────── */

type BronBatch = {
  id: string; customer_id: string; branch: string; batch_size: number; price_per_lead: number | string | null;
  leads_per_week: number | null; leads_per_day: number | null; lead_filters: unknown; lookback_days: number | null;
  dagdosering: unknown; direct_leveren: string | null; distribution_priority: boolean | null;
  status: string; batch_kind: string | null; delivery_model: string | null; account_manager_id: string | null;
  compensations: unknown; created_at: string; completed_at: string | null; doorloop_aangekondigd_op: string | null;
  leads_delivered: number | null;
};
const BRON_VELDEN = 'id, customer_id, branch, batch_size, price_per_lead, leads_per_week, leads_per_day, lead_filters, lookback_days, dagdosering, direct_leveren, distribution_priority, status, batch_kind, delivery_model, account_manager_id, compensations, created_at, completed_at, doorloop_aangekondigd_op, leads_delivered';

/** Heeft de klant na deze batch al een andere in dezelfde branche (ook afgerond)? */
async function heeftNieuwereBatch(supabase: SupabaseClient, b: BronBatch): Promise<boolean> {
  const { data } = await supabase
    .from('customer_batches')
    .select('id')
    .eq('customer_id', b.customer_id)
    .eq('branch', b.branch)
    .neq('status', 'expired')
    .gt('created_at', b.created_at)
    .neq('id', b.id)
    .limit(1);
  return (data ?? []).length > 0;
}

function bedragen(k: Klant, prijs: number, grootte: number) {
  const totaalExcl = Math.round(prijs * grootte * 100) / 100;
  const vat = computeInvoiceVat({ subtotalExclBtw: totaalExcl, country: k.country, customerVatId: k.vat_id });
  return { totaalExcl, totaalIncl: vat.total_incl_btw };
}

/** Komt deze batch van deze klant nu in aanmerking? Geeft de reden als dat niet zo is. */
async function geschikt(supabase: SupabaseClient, b: BronBatch, k: Klant): Promise<string | null> {
  if (!k.doorlopend) return 'doorlopend staat uit';
  if (k.intern || k.demo_mode || k.is_active === false) return 'klant komt niet in aanmerking';
  if (!batchKanDoorlopen(b)) return 'batchsoort loopt niet door';
  if (await heeftNieuwereBatch(supabase, b)) return 'er is al een vervolg';
  return null;
}

/**
 * Aankondiging (normaal bij 90%): eenmalig, met de stopknop. `laat` als de
 * batch al vol was toen het werd aangezet; dan start hij pas een dag later.
 */
export async function kondigDoorloopAan(supabase: SupabaseClient, batchId: string): Promise<boolean> {
  const { data } = await supabase.from('customer_batches').select(BRON_VELDEN).eq('id', batchId).maybeSingle();
  const b = data as BronBatch | null;
  if (!b || b.doorloop_aangekondigd_op) return false;
  const k = await laadKlant(supabase, b.customer_id);
  if (!k || (await geschikt(supabase, b, k))) return false;
  const prijs = Number(b.price_per_lead);
  const g = doorloopGrootte(prijs, oorspronkelijkeGrootte(b));
  if (!g) return false;

  const { data: claim } = await supabase
    .from('customer_batches')
    .update({ doorloop_aangekondigd_op: new Date().toISOString() })
    .eq('id', batchId)
    .is('doorloop_aangekondigd_op', null)
    .select('id');
  if (!claim || claim.length === 0) return false;

  const laat = b.status === 'completed';
  await sendDoorloopAankondigingEmail(mailKlant(k), {
    batchId, branche: await brancheNaam(supabase, b.branch), grootte: g.grootte, prijsPerLead: prijs,
    ...bedragen(k, prijs, g.grootte), verkleind: g.verkleind, stopUrl: doorloopStopUrl(k.id), laat,
  }).catch(() => {});
  return true;
}

export type DoorloopUitslag =
  | { gestart: true; batchId: string }
  | { gestart: false; reden: 'niet_geschikt' | 'aangekondigd' | 'wacht' | 'wacht_op_betaling' | 'te_duur' | 'al_vervolg' | 'fout'; detail?: string };

/**
 * Start de doorloop voor een volle batch. Veilig om vaker aan te roepen
 * (mijlpaal en cron): de unieke index op `doorgelopen_van` laat er één toe.
 * `signaleer`: de accountmanager horen als het niet kan (alleen vanuit de
 * mijlpaal, anders mailt de cron elk uur).
 */
export async function startDoorloop(
  supabase: SupabaseClient,
  batchId: string,
  opts: { signaleer?: boolean; nu?: Date } = {},
): Promise<DoorloopUitslag> {
  const nu = opts.nu ?? new Date();
  const { data } = await supabase.from('customer_batches').select(BRON_VELDEN).eq('id', batchId).maybeSingle();
  const b = data as BronBatch | null;
  if (!b || b.status !== 'completed') return { gestart: false, reden: 'niet_geschikt' };
  const k = await laadKlant(supabase, b.customer_id);
  if (!k) return { gestart: false, reden: 'niet_geschikt' };
  const waarom = await geschikt(supabase, b, k);
  if (waarom) return { gestart: false, reden: waarom === 'er is al een vervolg' ? 'al_vervolg' : 'niet_geschikt', detail: waarom };

  const branche = await brancheNaam(supabase, b.branch);
  const am = () => accountmanagerOntvanger(supabase, { batchAm: b.account_manager_id, klantAm: k.account_manager_id });
  const amInfo = { klant: k.name, contactpersoon: k.contact_person, telefoon: k.phone, klantEmail: k.email, branche, customerId: k.id };

  const prijs = Number(b.price_per_lead);
  const g = doorloopGrootte(prijs, oorspronkelijkeGrootte(b));
  if (!g) {
    if (opts.signaleer) void am().then(n => sendDoorloopSignaalEmail(n, { ...amInfo, soort: 'niet_gestart', reden: 'de prijs per lead is te hoog voor het maximum per doorloop', batchId: b.id })).catch(() => {});
    return { gestart: false, reden: 'te_duur' };
  }

  if (!b.doorloop_aangekondigd_op) {
    await kondigDoorloopAan(supabase, b.id);
    return { gestart: false, reden: 'aangekondigd' };
  }
  if (!magStarten(b, nu)) return { gestart: false, reden: 'wacht' };

  /* Nooit twee onbetaalde doorloopfacturen tegelijk. */
  const { data: onbetaald } = await supabase
    .from('customer_batches')
    .select('id')
    .eq('customer_id', k.id).eq('op_factuur', true).not('is_paid', 'is', true).neq('status', 'expired')
    .limit(1);
  if ((onbetaald ?? []).length > 0) {
    if (opts.signaleer) void am().then(n => sendDoorloopSignaalEmail(n, { ...amInfo, soort: 'wacht_op_betaling', batchId: b.id })).catch(() => {});
    return { gestart: false, reden: 'wacht_op_betaling' };
  }

  const meta = await resolveMetaCampaignFieldsForNewLeadBatch(supabase, { customerId: k.id, branch: b.branch, sourceBatchId: b.id }).catch(() => null);
  const totaalExcl = Math.round(prijs * g.grootte * 100) / 100;
  const nieuw: Record<string, unknown> = {
    customer_id: k.id,
    branch: b.branch,
    batch_size: g.grootte,
    price_per_lead: prijs,
    total_price: totaalExcl,
    leads_per_week: b.leads_per_week,
    leads_per_day: b.leads_per_day,
    lead_filters: b.lead_filters ?? [],
    lookback_days: b.lookback_days,
    dagdosering: b.dagdosering ?? null,
    direct_leveren: b.direct_leveren,
    distribution_priority: b.distribution_priority ?? false,
    status: 'active',
    leads_delivered: 0,
    is_paid: false,
    op_factuur: true,
    doorgelopen_van: b.id,
    account_manager_id: b.account_manager_id ?? k.account_manager_id,
    batch_kind: 'leads',
    delivery_model: b.delivery_model,
    notes: `Doorlopend op factuur (vervolg op batch ${b.id.slice(0, 8)})${g.verkleind ? ', verkleind tot het maximum per doorloop' : ''}`,
  };
  if (meta) {
    nieuw.meta_campaign_ids = meta.meta_campaign_ids;
    nieuw.meta_campaign_paused_ids = meta.meta_campaign_paused_ids;
    nieuw.meta_campaign_sync_enabled = meta.meta_campaign_sync_enabled;
    nieuw.meta_campagne_exclusief = await zonderBotsingen(supabase, meta.meta_campagne_exclusief, k.id).catch(() => ({}));
    nieuw.meta_campagne_uitgesloten = meta.meta_campagne_uitgesloten;
  }

  const { data: nb, error } = await supabase.from('customer_batches').insert(nieuw).select('id, created_at').single();
  if (error || !nb) {
    if ((error as { code?: string } | null)?.code === '23505') return { gestart: false, reden: 'al_vervolg' };
    console.error('[doorlopen] batch aanmaken mislukt', { batchId: b.id, err: error?.message });
    if (opts.signaleer) void am().then(n => sendDoorloopSignaalEmail(n, { ...amInfo, soort: 'niet_gestart', reden: 'de nieuwe batch kon niet worden aangemaakt', batchId: b.id })).catch(() => {});
    return { gestart: false, reden: 'fout', detail: error?.message };
  }
  const nieuwId = nb.id as string;

  try {
    await kopieerBatchGebied(supabase, b.id, nieuwId);
  } catch (e) {
    console.error('[doorlopen] doelgebied overnemen mislukt', e);
    void sendEmail(INFO, '[ACTIE] Doelgebied niet overgenomen bij doorlopen', layout('Doelgebied controleren', `
      <p style="margin:0">Batch <strong>${nieuwId}</strong> van ${k.name} is doorgelopen van ${b.id}, maar het eigen doelgebied kon niet worden overgenomen. Hij gebruikt nu het gebied van de klantkaart.</p>`),
      { type: 'doorloop_fout', metadata: { batch_id: nieuwId, error_type: 'batch_targets_copy_failed' } }).catch(() => {});
  }

  /* Factuur met 7 dagen termijn, en onze eigen mail met de betaallink. */
  let factuurnummer: string | null = null;
  let betaalUrl = PORTAAL_FACTUREN;
  let totaalIncl = bedragen(k, prijs, g.grootte).totaalIncl;
  try {
    const f = await createInvoice({
      customer_id: k.id,
      batch_id: nieuwId,
      branch_name: branche,
      batch_size: g.grootte,
      price_per_lead: prijs,
      total_price: totaalExcl,
      status: 'open',
      send_payment_email: false,
      termijn_dagen: BETAALTERMIJN_DAGEN,
    });
    if (f) {
      factuurnummer = f.invoice_number as string;
      totaalIncl = Number(f.total_incl_btw);
      try {
        betaalUrl = (await ensureInvoiceMollieCheckout(f)).checkoutUrl || betaalUrl;
      } catch (e) {
        console.error('[doorlopen] betaallink mislukt, portaal als terugval', e);
      }
    }
  } catch (e) {
    console.error('[doorlopen] factuur mislukt', e);
  }
  if (!factuurnummer) {
    void sendEmail(INFO, `[ACTIE] Doorloopbatch zonder factuur: ${k.name}`, layout('Factuur maken', `
      <p style="margin:0">Batch <strong>${nieuwId}</strong> (${g.grootte} ${branche}-leads, &euro;${totaalExcl.toFixed(2)} excl. btw) is doorgelopen en levert, maar de factuur kon niet worden aangemaakt. Maak hem met de hand aan via de batch.</p>`),
      { type: 'doorloop_fout', metadata: { batch_id: nieuwId, error_type: 'invoice_create_failed' } }).catch(() => {});
  }

  const stopUrl = doorloopStopUrl(k.id);
  if (factuurnummer) {
    await sendDoorloopGestartEmail(mailKlant(k), {
      batchId: nieuwId, branche, grootte: g.grootte, prijsPerLead: prijs, totaalExcl, totaalIncl,
      verkleind: g.verkleind, stopUrl, factuurnummer, betaalUrl, uiterlijk: betaalUiterlijk(nb.created_at as string),
    }).catch(() => {});
  }
  void sendPushToCustomer(k.id, {
    title: 'Je batch loopt door',
    body: `Je nieuwe batch van ${g.grootte} ${branche}-leads loopt al.`,
    url: '/portal',
    tag: 'doorlopen',
  }).catch(() => {});
  void am().then(n => sendDoorloopSignaalEmail(n, { ...amInfo, soort: 'gestart', grootte: g.grootte, bedragIncl: totaalIncl, factuurnummer, batchId: nieuwId })).catch(() => {});
  void logAudit({
    adminId: null,
    adminName: 'Systeem',
    action: 'batch_doorgelopen',
    entityType: 'customer_batch',
    entityId: nieuwId,
    details: { customer_id: k.id, van_batch: b.id, grootte: g.grootte, verkleind: g.verkleind, totaal_excl: totaalExcl, factuur: factuurnummer },
  });
  reconcileBatchMetaCampaigns(supabase, nieuwId, 'finalize').catch(e => console.error('[doorlopen] meta reconcile', e));

  return { gestart: true, batchId: nieuwId };
}

/* ─── Betaling ────────────────────────────────────────────────── */

/**
 * Factuur van een doorloopbatch betaald (Mollie of met de hand). De batch
 * levert al, dus alleen op betaald zetten en een pauze wegens niet betalen
 * opheffen. Geeft false voor gewone batches: die volgen het bestaande pad.
 */
export async function verwerkDoorloopBetaling(
  supabase: SupabaseClient,
  batchId: string,
  betaalRef: string,
  door?: { id?: string | null; naam?: string | null },
): Promise<boolean> {
  const { data: b } = await supabase
    .from('customer_batches')
    .select('id, customer_id, op_factuur, is_paid, status, gepauzeerd_reden, batch_size, leads_delivered')
    .eq('id', batchId)
    .maybeSingle();
  if (!b || b.op_factuur !== true) return false;
  if (b.is_paid === true) return true;

  const hervat = b.status === 'paused' && b.gepauzeerd_reden === 'onbetaald';
  const vol = Number(b.leads_delivered) >= Number(b.batch_size);
  const update: Record<string, unknown> = { is_paid: true, mollie_payment_id: betaalRef };
  if (hervat) {
    update.gepauzeerd_reden = null;
    update.status = vol ? 'completed' : 'active';
    if (vol) update.completed_at = new Date().toISOString();
  }
  await supabase.from('customer_batches').update(update).eq('id', batchId).eq('is_paid', false);

  void logAudit({
    adminId: door?.id ?? null,
    adminName: door?.naam ?? 'Systeem',
    action: 'doorloop_betaald',
    entityType: 'customer_batch',
    entityId: batchId,
    details: { customer_id: b.customer_id, hervat, betaal_ref: betaalRef },
  });
  if (hervat && !vol) {
    reconcileBatchMetaCampaigns(supabase, batchId, 'finalize').catch(() => {});
  }
  return true;
}
