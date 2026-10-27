import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { EMAIL_BASE_URL, sendBetaalBelactieEmail, sendOfferteVerlopenEmail, sendUnpaidBatchReminderEmail } from '@/lib/email';
import { ensureInvoiceMollieCheckout } from '@/lib/invoiceCheckout';
import { VERLOOP_DAGEN, dagenOud, volgendeHerinnerStap, type HerinnerStap } from '@/lib/betaalHerinnering';
import { laatBatchVerlopen } from '@/lib/offerteVerloop';

/**
 * Dagelijks (09:00): automatische opvolging van onbetaalde batches.
 * Dag 2, 5 en 10 een herinnering met betaallink, dag 14 een belactie voor de
 * accountmanager, dag 21 verloopt het aanbod (met een mail om alsnog te
 * bestellen). Per batch uit te zetten; niet voor demo- of interne klanten.
 *
 * Elke stap wordt eerst vastgelegd (alleen als de stap nog niet was gedaan)
 * en pas daarna uitgevoerd, zodat een tweede run niets dubbel stuurt. Mislukt
 * een mail, dan gaat de stap terug en probeert de volgende run het opnieuw.
 *
 * ?proef=1 laat zien wat er zou gebeuren zonder iets te versturen.
 */

export const maxDuration = 300;

type Klant = {
  id: string; name: string; email: string | null; contact_person: string | null; phone: string | null;
  country: string | null; vat_id: string | null; demo_mode: boolean | null; intern: boolean | null;
  is_active: boolean | null; account_manager_id: string | null;
};
type Rij = {
  id: string; customer_id: string; branch: string; batch_size: number; price_per_lead: number | null;
  total_price: number | null; created_at: string; herinnering_vanaf: string | null;
  betaalherinnering_stap: number | null; account_manager_id: string | null;
  customers: Klant | Klant[] | null;
};

const INFO = 'info@warmeleads.eu';

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const proef = request.nextUrl.searchParams.get('proef') === '1';
  const supabase = createServerClient();
  const nu = new Date();

  const [{ data: rijen, error }, { data: branches }] = await Promise.all([
    supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, price_per_lead, total_price, created_at, herinnering_vanaf, betaalherinnering_stap, account_manager_id, customers(id, name, email, contact_person, phone, country, vat_id, demo_mode, intern, is_active, account_manager_id)')
      .eq('status', 'pending_payment')
      .eq('is_paid', false)
      .eq('betaalherinneringen', true)
      .order('created_at')
      .limit(1000),
    supabase.from('branches').select('slug, name'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const brancheNaam = new Map((branches ?? []).map(b => [b.slug as string, b.name as string]));

  const plan: { batch_id: string; klant: string; stap: HerinnerStap; dagen: number }[] = [];
  const overgeslagen: { batch_id: string; reden: string }[] = [];
  for (const r of (rijen ?? []) as Rij[]) {
    const k = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    if (!k) { overgeslagen.push({ batch_id: r.id, reden: 'geen klant' }); continue; }
    if (k.demo_mode || k.intern) { overgeslagen.push({ batch_id: r.id, reden: 'demo of intern' }); continue; }
    if (k.is_active === false) { overgeslagen.push({ batch_id: r.id, reden: 'klant inactief' }); continue; }
    if (!k.email) { overgeslagen.push({ batch_id: r.id, reden: 'geen e-mailadres' }); continue; }
    if (!(Number(r.total_price) > 0)) { overgeslagen.push({ batch_id: r.id, reden: 'geen bedrag' }); continue; }
    const stap = volgendeHerinnerStap(r, nu);
    if (stap) plan.push({ batch_id: r.id, klant: k.name, stap, dagen: dagenOud(r.herinnering_vanaf || r.created_at, nu) });
  }

  if (proef) return NextResponse.json({ proef: true, plan, overgeslagen, bekeken: (rijen ?? []).length });

  const perId = new Map(((rijen ?? []) as Rij[]).map(r => [r.id, r]));
  const uitkomst: { batch_id: string; stap: number; soort: string; ok: boolean; fout?: string }[] = [];

  for (const p of plan) {
    const r = perId.get(p.batch_id)!;
    const k = (Array.isArray(r.customers) ? r.customers[0] : r.customers)!;
    const oud = r.betaalherinnering_stap ?? 0;

    /* Vastleggen vóór uitvoeren: alleen wie de stap nog niet had, en alleen
       als de batch nog steeds op betaling wacht. */
    const { data: geclaimd } = await supabase
      .from('customer_batches')
      .update({ betaalherinnering_stap: p.stap.stap, betaalherinnering_op: nu.toISOString() })
      .eq('id', r.id)
      .eq('status', 'pending_payment')
      .eq('is_paid', false)
      .eq('betaalherinnering_stap', oud)
      .select('id')
      .maybeSingle();
    if (!geclaimd) continue;

    const terug = async () => {
      await supabase.from('customer_batches')
        .update({ betaalherinnering_stap: oud })
        .eq('id', r.id)
        .eq('betaalherinnering_stap', p.stap.stap);
    };

    const klant = { id: k.id, name: k.name, email: k.email!, contact_person: k.contact_person ?? undefined, country: k.country, vat_id: k.vat_id };
    const batchInfo = {
      id: r.id, branch: r.branch, branch_name: brancheNaam.get(r.branch) || r.branch,
      batch_size: r.batch_size, price_per_lead: r.price_per_lead, total_price: r.total_price,
    };
    const basis = new Date(r.herinnering_vanaf || r.created_at).getTime();
    const verlooptOp = new Date(basis + VERLOOP_DAGEN * 86_400_000);

    try {
      if (p.stap.soort === 'mail') {
        let directCheckoutUrl: string | undefined;
        const { data: factuur } = await supabase
          .from('invoices')
          .select('id, invoice_number, description, customer_id, total_incl_btw, mollie_payment_id')
          .eq('batch_id', r.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (factuur) {
          try {
            ({ checkoutUrl: directCheckoutUrl } = await ensureInvoiceMollieCheckout({
              id: factuur.id, invoice_number: factuur.invoice_number, description: factuur.description,
              customer_id: factuur.customer_id, total_incl_btw: Number(factuur.total_incl_btw), mollie_payment_id: factuur.mollie_payment_id,
            }));
          } catch { /* herinnering zonder directe link; de portaalknop staat er altijd in */ }
        }
        const ok = await sendUnpaidBatchReminderEmail(klant, batchInfo, {
          directCheckoutUrl,
          geldigTot: new Date(verlooptOp.getTime() - 86_400_000),
          laatste: p.stap.stap === 3,
          stap: p.stap.stap,
        });
        if (!ok) { await terug(); uitkomst.push({ batch_id: r.id, stap: p.stap.stap, soort: 'mail', ok: false, fout: 'mail mislukt' }); continue; }
        uitkomst.push({ batch_id: r.id, stap: p.stap.stap, soort: 'mail', ok: true });
      } else if (p.stap.soort === 'bellen') {
        const amId = r.account_manager_id || k.account_manager_id;
        let naar: { email: string; name?: string | null } = { email: INFO, name: 'WarmeLeads' };
        if (amId) {
          const { data: am } = await supabase.from('admin_users').select('email, name, is_active').eq('id', amId).maybeSingle();
          if (am?.email && am.is_active !== false) naar = { email: am.email as string, name: am.name as string | null };
        }
        const ok = await sendBetaalBelactieEmail(naar, {
          klant: k.name, contactpersoon: k.contact_person, telefoon: k.phone, klantEmail: k.email,
          branche: batchInfo.branch_name, aantal: r.batch_size, bedragExcl: Number(r.total_price) || 0,
          dagen: p.dagen, verlooptOp, batchId: r.id, customerId: k.id,
        });
        if (!ok) { await terug(); uitkomst.push({ batch_id: r.id, stap: p.stap.stap, soort: 'bellen', ok: false, fout: 'mail mislukt' }); continue; }
        uitkomst.push({ batch_id: r.id, stap: p.stap.stap, soort: 'bellen', ok: true });
      } else {
        const v = await laatBatchVerlopen(supabase, r.id, { door: null, reden: `automatisch na ${VERLOOP_DAGEN} dagen` });
        if (!v.ok) { await terug(); uitkomst.push({ batch_id: r.id, stap: p.stap.stap, soort: 'verlopen', ok: false, fout: 'verlopen mislukt' }); continue; }
        /* De mail is een service; mislukt hij, dan blijft de batch toch verlopen. */
        await sendOfferteVerlopenEmail(klant, batchInfo, `${EMAIL_BASE_URL}/portal/bestellen?batch=${r.id}`).catch(() => false);
        uitkomst.push({ batch_id: r.id, stap: p.stap.stap, soort: 'verlopen', ok: true });
      }
    } catch (e) {
      await terug();
      uitkomst.push({ batch_id: r.id, stap: p.stap.stap, soort: p.stap.soort, ok: false, fout: String(e).slice(0, 200) });
    }
  }

  return NextResponse.json({ ok: true, bekeken: (rijen ?? []).length, uitgevoerd: uitkomst, overgeslagen: overgeslagen.length });
}
