import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cronAuth';
import { createServerClient } from '@/lib/supabase';
import { accountmanagerOntvanger } from '@/lib/accountmanagerOntvanger';
import { sendDoorloopGepauzeerdEmail, sendDoorloopHerinneringEmail, sendDoorloopSignaalEmail } from '@/lib/email';
import { ensureInvoiceMollieCheckout } from '@/lib/invoiceCheckout';
import { betaalUiterlijk, volgendeDoorloopStap, VANGNET_DAGEN, type DoorloopStapSoort } from '@/lib/doorlopenRegels';
import { startDoorloop, verwerkDoorloopBetaling, zetDoorlopend } from '@/lib/doorlopen';
import { logAudit } from '@/lib/audit';

/**
 * Elk uur: doorlopend op factuur bijhouden.
 *
 * 1. Opvolging van onbetaalde doorloopfacturen: dag 5 een herinnering, dag 7
 *    pauzeert de levering en gaat doorlopen uit, dag 14 belt de
 *    accountmanager. Elke stap wordt eerst vastgelegd en dan uitgevoerd.
 * 2. Vangnet: een volle batch van een doorlopende klant die bij de mijlpaal
 *    niet doorliep (bijvoorbeeld afgerond door de nachtelijke telling, of
 *    na een late aankondiging de dag erna), start alsnog.
 *
 * ?proef=1 laat zien wat er zou gebeuren zonder iets te doen.
 */

export const maxDuration = 300;

type Klant = {
  id: string; name: string; email: string | null; contact_person: string | null; phone: string | null;
  country: string | null; vat_id: string | null; account_manager_id: string | null;
};
type Rij = {
  id: string; customer_id: string; branch: string; batch_size: number; status: string; created_at: string;
  doorloop_stap: number | null; account_manager_id: string | null; customers: Klant | Klant[] | null;
};

export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const proef = request.nextUrl.searchParams.get('proef') === '1';
  const supabase = createServerClient();
  const nu = new Date();

  /* ── 1. Onbetaalde doorloopfacturen ── */
  const [{ data: rijen, error }, { data: branches }] = await Promise.all([
    supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, status, created_at, doorloop_stap, account_manager_id, customers(id, name, email, contact_person, phone, country, vat_id, account_manager_id)')
      .eq('op_factuur', true)
      .not('is_paid', 'is', true)
      .in('status', ['active', 'paused', 'completed'])
      .order('created_at')
      .limit(500),
    supabase.from('branches').select('slug, name'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const brancheNaam = new Map((branches ?? []).map(b => [b.slug as string, b.name as string]));

  /* Herinneringen en pauzes alleen overdag; het vangnet draait elk uur. */
  const uur = Number(new Intl.DateTimeFormat('nl-NL', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Amsterdam' }).format(nu));
  const overdag = uur >= 8 && uur < 20;
  const plan: { batch_id: string; klant: string; stap: number; soort: DoorloopStapSoort }[] = [];
  for (const r of overdag ? ((rijen ?? []) as Rij[]) : []) {
    const s = volgendeDoorloopStap(r, nu);
    const k = Array.isArray(r.customers) ? r.customers[0] : r.customers;
    if (s && k) plan.push({ batch_id: r.id, klant: k.name, stap: s.stap, soort: s.soort });
  }

  /* ── 2. Vangnet: volle batches van doorlopende klanten ── */
  const { data: doorlopers } = await supabase.from('customers').select('id, doorlopend_sinds').eq('doorlopend', true);
  const sinds = new Map((doorlopers ?? []).map(d => [d.id as string, d.doorlopend_sinds as string | null]));
  let kandidaten: { id: string; customer_id: string; completed_at: string | null; doorloop_aangekondigd_op: string | null }[] = [];
  if (sinds.size > 0) {
    const { data } = await supabase
      .from('customer_batches')
      .select('id, customer_id, completed_at, doorloop_aangekondigd_op')
      .in('customer_id', [...sinds.keys()])
      .eq('status', 'completed')
      .eq('batch_kind', 'leads')
      .gte('completed_at', new Date(nu.getTime() - VANGNET_DAGEN * 86_400_000).toISOString())
      .limit(500);
    /* Alleen batches die vol raakten nadat doorlopen aanging, of die al
       zijn aangekondigd: een oude batch loopt nooit onverwacht door. */
    kandidaten = (data ?? []).filter(b => {
      const aan = sinds.get(b.customer_id as string);
      return !!b.doorloop_aangekondigd_op || (!!aan && !!b.completed_at && b.completed_at >= aan);
    }) as typeof kandidaten;
  }

  if (proef) {
    return NextResponse.json({ proef: true, overdag, opvolging: plan, vangnet: kandidaten.map(k => k.id), bekeken: (rijen ?? []).length });
  }

  const perId = new Map(((rijen ?? []) as Rij[]).map(r => [r.id, r]));
  const uitkomst: { batch_id: string; stap: number; soort: string; ok: boolean; fout?: string }[] = [];

  for (const p of plan) {
    const r = perId.get(p.batch_id)!;
    const k = (Array.isArray(r.customers) ? r.customers[0] : r.customers)!;

    /* Eerst kijken of de factuur intussen al betaald (of vervallen) is. */
    const { data: f } = await supabase
      .from('invoices')
      .select('id, invoice_number, description, customer_id, total_incl_btw, mollie_payment_id, status')
      .eq('batch_id', r.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (f?.status === 'paid') {
      await verwerkDoorloopBetaling(supabase, r.id, (f.mollie_payment_id as string | null) || `factuur-${f.id}`);
      continue;
    }
    if (!f || f.status !== 'open') {
      /* Geen open factuur (vervallen of nooit gemaakt): niet blijven mailen. */
      await supabase.from('customer_batches').update({ doorloop_stap: 3, doorloop_stap_op: nu.toISOString() }).eq('id', r.id);
      uitkomst.push({ batch_id: r.id, stap: p.stap, soort: p.soort, ok: false, fout: 'geen open factuur' });
      continue;
    }

    const { data: claim } = await supabase
      .from('customer_batches')
      .update({ doorloop_stap: p.stap, doorloop_stap_op: nu.toISOString() })
      .eq('id', r.id)
      .eq('doorloop_stap', r.doorloop_stap ?? 0)
      .select('id');
    if (!claim || claim.length === 0) continue;

    const branche = brancheNaam.get(r.branch) || r.branch;
    const klantMail = { id: k.id, name: k.name, email: k.email ?? '', contact_person: k.contact_person ?? undefined, country: k.country, vat_id: k.vat_id };
    const amInfo = {
      klant: k.name, contactpersoon: k.contact_person, telefoon: k.phone, klantEmail: k.email, branche,
      grootte: r.batch_size, bedragIncl: Number(f.total_incl_btw), factuurnummer: f.invoice_number as string, batchId: r.id, customerId: k.id,
    };
    try {
      const betaalUrl = await ensureInvoiceMollieCheckout(f as Parameters<typeof ensureInvoiceMollieCheckout>[0])
        .then(x => x.checkoutUrl)
        .catch(() => `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu'}/portal/account?tab=invoices`);

      if (p.soort === 'herinnering') {
        if (k.email) {
          await sendDoorloopHerinneringEmail(klantMail, {
            batchId: r.id, branche, factuurnummer: f.invoice_number as string, totaalIncl: Number(f.total_incl_btw),
            betaalUrl, pauzeOp: betaalUiterlijk(r.created_at),
          });
        }
      } else if (p.soort === 'pauze') {
        const alGeleverd = r.status === 'completed';
        if (r.status === 'active') {
          await supabase.from('customer_batches')
            .update({ status: 'paused', gepauzeerd_reden: 'onbetaald' })
            .eq('id', r.id).eq('status', 'active');
        }
        await zetDoorlopend(supabase, k.id, false, { soort: 'systeem', naam: 'Systeem (factuur niet betaald)' });
        void logAudit({
          adminId: null, adminName: 'Systeem', action: 'doorloop_gepauzeerd', entityType: 'customer_batch', entityId: r.id,
          details: { customer_id: k.id, factuur: f.invoice_number, al_geleverd: alGeleverd },
        });
        if (k.email) {
          await sendDoorloopGepauzeerdEmail(klantMail, {
            batchId: r.id, branche, factuurnummer: f.invoice_number as string, totaalIncl: Number(f.total_incl_btw), betaalUrl, alGeleverd,
          });
        }
        const naar = await accountmanagerOntvanger(supabase, { batchAm: r.account_manager_id, klantAm: k.account_manager_id });
        await sendDoorloopSignaalEmail(naar, { ...amInfo, soort: 'gepauzeerd' });
      } else {
        const naar = await accountmanagerOntvanger(supabase, { batchAm: r.account_manager_id, klantAm: k.account_manager_id });
        await sendDoorloopSignaalEmail(naar, { ...amInfo, soort: 'bellen' });
      }
      uitkomst.push({ batch_id: r.id, stap: p.stap, soort: p.soort, ok: true });
    } catch (e) {
      /* Terugzetten, dan probeert de volgende run het opnieuw. */
      await supabase.from('customer_batches').update({ doorloop_stap: r.doorloop_stap ?? 0 }).eq('id', r.id).eq('doorloop_stap', p.stap);
      uitkomst.push({ batch_id: r.id, stap: p.stap, soort: p.soort, ok: false, fout: String(e).slice(0, 200) });
    }
  }

  const vangnet: { batch_id: string; uitslag: string }[] = [];
  for (const b of kandidaten) {
    const u = await startDoorloop(supabase, b.id, { nu });
    vangnet.push({ batch_id: b.id, uitslag: u.gestart ? `gestart: ${u.batchId}` : u.reden });
  }

  return NextResponse.json({ ok: true, opvolging: uitkomst, vangnet });
}
