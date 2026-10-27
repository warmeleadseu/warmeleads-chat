import type { SupabaseClient } from '@supabase/supabase-js';
import { logAudit } from './audit';
import { getMollieClient } from './mollie';

/**
 * Onbetaalde batches: herinneren, laten verlopen en terugzetten.
 *
 * Aanleiding (27 okt 2026): 86 batches wachtten op betaling, 80 daarvan van
 * klanten die nooit iets betaalden. De herinnering was een handmatige knop die
 * in 120 dagen één keer was gebruikt. En wie een onbetaalde batch verwijderde,
 * liet de factuur open en betaalbaar staan (92 facturen, EUR 97k), zodat een
 * klant kon betalen zonder dat er iets werd geleverd.
 *
 * Een verlopen batch ('expired') en een vervallen factuur ('expired') tellen
 * nergens meer mee als openstaand en zijn niet meer te betalen via het portaal.
 * Er wordt niets verwijderd; terugzetten zet alles weer open.
 */

export { HERINNER_STAPPEN, VERLOOP_DAGEN, dagenOud, volgendeHerinnerStap } from './betaalHerinnering';
export type { HerinnerSoort, HerinnerStap } from './betaalHerinnering';

export type Door = { id: string | null; naam: string | null } | null;

async function annuleerMollie(paymentIds: (string | null | undefined)[]): Promise<void> {
  const ids = [...new Set(paymentIds.filter((x): x is string => !!x && x.startsWith('tr_')))];
  if (ids.length === 0) return;
  let mollie: ReturnType<typeof getMollieClient>;
  try { mollie = getMollieClient(); } catch { return; }
  for (const id of ids) {
    try {
      const p = await mollie.payments.get(id);
      if (p.isCancelable) await mollie.payments.cancel(id);
    } catch { /* niet te annuleren (iDEAL e.d.): de webhook vangt een late betaling op */ }
  }
}

/**
 * Laat een onbetaalde batch verlopen, met de open facturen erbij. Doet niets
 * als de batch inmiddels betaald is of niet meer op betaling wacht.
 */
export async function laatBatchVerlopen(
  supabase: SupabaseClient,
  batchId: string,
  opts: { door: Door; reden: string },
): Promise<{ ok: boolean; facturen: number }> {
  const nu = new Date().toISOString();
  const { data: batch } = await supabase
    .from('customer_batches')
    .update({ status: 'expired', expired_at: nu })
    .eq('id', batchId)
    .eq('status', 'pending_payment')
    .eq('is_paid', false)
    .select('id, customer_id, branch, mollie_payment_id')
    .maybeSingle();
  if (!batch) return { ok: false, facturen: 0 };

  const { data: facturen } = await supabase
    .from('invoices')
    .update({ status: 'expired', expired_at: nu })
    .eq('batch_id', batchId)
    .eq('status', 'open')
    .select('id, mollie_payment_id');

  await annuleerMollie([batch.mollie_payment_id, ...(facturen ?? []).map(f => f.mollie_payment_id)]);

  void logAudit({
    adminId: opts.door?.id ?? null,
    adminName: opts.door?.naam ?? 'Systeem',
    action: 'batch_verlopen',
    entityType: 'customer_batch',
    entityId: batchId,
    details: { customer_id: batch.customer_id, branch: batch.branch, reden: opts.reden, facturen: (facturen ?? []).map(f => f.id) },
  });
  return { ok: true, facturen: (facturen ?? []).length };
}

/** Zet een verlopen batch terug op "wacht op betaling", met de facturen. */
export async function zetBatchTerug(
  supabase: SupabaseClient,
  batchId: string,
  opts: { door: Door; reden: string },
): Promise<{ ok: boolean; facturen: number }> {
  const { data: batch } = await supabase
    .from('customer_batches')
    /* De herinneringsreeks begint opnieuw, gerekend vanaf vandaag. */
    .update({
      status: 'pending_payment', expired_at: null,
      betaalherinneringen: true, betaalherinnering_stap: 0, betaalherinnering_op: null,
      herinnering_vanaf: new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('status', 'expired')
    .select('id, customer_id, branch')
    .maybeSingle();
  if (!batch) return { ok: false, facturen: 0 };

  const { data: facturen } = await supabase
    .from('invoices')
    .update({ status: 'open', expired_at: null })
    .eq('batch_id', batchId)
    .eq('status', 'expired')
    .select('id');

  void logAudit({
    adminId: opts.door?.id ?? null,
    adminName: opts.door?.naam ?? 'Systeem',
    action: 'batch_teruggezet',
    entityType: 'customer_batch',
    entityId: batchId,
    details: { customer_id: batch.customer_id, branch: batch.branch, reden: opts.reden, facturen: (facturen ?? []).map(f => f.id) },
  });
  return { ok: true, facturen: (facturen ?? []).length };
}

/** Laat één open factuur vervallen (bijvoorbeeld een factuur zonder batch). */
export async function laatFactuurVervallen(
  supabase: SupabaseClient,
  invoiceId: string,
  opts: { door: Door; reden: string },
): Promise<boolean> {
  const { data: f } = await supabase
    .from('invoices')
    .update({ status: 'expired', expired_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('status', 'open')
    .select('id, customer_id, invoice_number, mollie_payment_id, batch_id')
    .maybeSingle();
  if (!f) return false;
  await annuleerMollie([f.mollie_payment_id]);
  void logAudit({
    adminId: opts.door?.id ?? null,
    adminName: opts.door?.naam ?? 'Systeem',
    action: 'factuur_vervallen',
    entityType: 'invoice',
    entityId: invoiceId,
    details: { customer_id: f.customer_id, invoice_number: f.invoice_number, batch_id: f.batch_id, reden: opts.reden },
  });
  return true;
}

/**
 * Zet een vervallen factuur weer open. Hoort hij bij een verlopen batch, dan
 * gaat die batch mee terug, anders is de factuur te betalen zonder dat de
 * batch na betaling start.
 */
export async function zetFactuurTerug(
  supabase: SupabaseClient,
  invoiceId: string,
  opts: { door: Door; reden: string },
): Promise<boolean> {
  const { data: f } = await supabase
    .from('invoices')
    .select('id, batch_id, customer_id, invoice_number, status')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!f || f.status !== 'expired') return false;
  if (f.batch_id) {
    const { data: b } = await supabase.from('customer_batches').select('status').eq('id', f.batch_id).maybeSingle();
    if (b?.status === 'expired') {
      const r = await zetBatchTerug(supabase, f.batch_id, opts);
      return r.ok;
    }
  }
  const { data: terug } = await supabase
    .from('invoices')
    .update({ status: 'open', expired_at: null })
    .eq('id', invoiceId)
    .eq('status', 'expired')
    .select('id')
    .maybeSingle();
  if (!terug) return false;
  void logAudit({
    adminId: opts.door?.id ?? null,
    adminName: opts.door?.naam ?? 'Systeem',
    action: 'factuur_teruggezet',
    entityType: 'invoice',
    entityId: invoiceId,
    details: { customer_id: f.customer_id, invoice_number: f.invoice_number, batch_id: f.batch_id, reden: opts.reden },
  });
  return true;
}
