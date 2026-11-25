import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { berekenBatchWinst, telWinstOp, type WinstKosten } from '@/lib/batchWinst';
import { laadFacturenPerBatch, laadKostenPerBatch } from '@/lib/batchWinstLaden';
import { laadExterneOmzet } from '@/lib/omzetPerMaandLaden';
import { afTeStaan, winstdeelVan, type WinstAfspraak } from '@/lib/winstdeling';
import { laadWinstAfspraken, winstdeelVanBatch } from '@/lib/winstdelingLaden';

/**
 * Winst per batch, over de batches die in de gekozen periode zijn aangemaakt.
 * Daarnaast waar het advertentiegeld van die periode heen ging (lekkage), zodat
 * het totaal klopt met de echte uitgaven. Alleen voor superadmins.
 */

const SOORTEN = ['leads', 'bulk_leads', 'niche_research'];
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function standaardVan(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;

  const q = request.nextUrl.searchParams;
  const van = DATUM.test(q.get('van') ?? '') ? q.get('van')! : standaardVan();
  const tot = DATUM.test(q.get('tot') ?? '') ? q.get('tot')! : new Date().toISOString().slice(0, 10);
  if (van > tot) return NextResponse.json({ error: 'De begindatum ligt na de einddatum' }, { status: 400 });

  const supabase = createServerClient();
  const totExclusief = new Date(`${tot}T00:00:00Z`);
  totExclusief.setUTCDate(totExclusief.getUTCDate() + 1);

  type BatchRij = {
    id: string; customer_id: string; branch: string; batch_kind: string; status: string;
    batch_size: number; total_price: number | string | null; price_per_lead: number | string | null;
    is_paid: boolean | null; mollie_payment_id: string | null; leads_delivered_external: number | null;
    extern_bedrag_excl: number | string | null; extern_factuurnummer: string | null;
    created_at: string; completed_at: string | null; customers: { name?: string; intern?: boolean; afspraakpartner?: boolean } | { name?: string; intern?: boolean; afspraakpartner?: boolean }[] | null;
  };
  const batches: BatchRij[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_kind, status, batch_size, total_price, price_per_lead, is_paid, mollie_payment_id, leads_delivered_external, extern_bedrag_excl, extern_factuurnummer, created_at, completed_at, customers(name, intern, afspraakpartner)')
      .in('batch_kind', SOORTEN)
      /* Verlopen offertes zijn nooit omzet geweest. */
      .neq('status', 'expired')
      .gte('created_at', `${van}T00:00:00Z`)
      .lt('created_at', totExclusief.toISOString())
      .order('created_at', { ascending: false })
      .range(p * 1000, p * 1000 + 999);
    if (error) return NextResponse.json({ error: 'Batches konden niet worden geladen' }, { status: 500 });
    /* Interne klanten (masterportaal, afsprakenverzameling) en
       afspraakpartners (Infinite Scale, migratie 194) zijn geen omzet van
       buiten; hun leadkosten staan apart in het lekkage-overzicht. */
    batches.push(...((data ?? []) as BatchRij[]).filter(b => {
      const k = Array.isArray(b.customers) ? b.customers[0] : b.customers;
      return !k?.intern && !k?.afspraakpartner;
    }));
    if (!data || data.length < 1000) break;
  }

  const ids = batches.map(b => b.id);

  const facturenPerBatch = await laadFacturenPerBatch(supabase, ids);
  let kostenPerBatch: Map<string, WinstKosten>;
  let afspraken: WinstAfspraak[];
  try {
    afspraken = await laadWinstAfspraken(supabase);
    kostenPerBatch = await laadKostenPerBatch(supabase, ids);
  } catch {
    return NextResponse.json({ error: 'Kosten konden niet worden berekend' }, { status: 500 });
  }

  const rijen = batches.map(b => {
    const klant = Array.isArray(b.customers) ? b.customers[0] : b.customers;
    return {
      id: b.id,
      customer_id: b.customer_id,
      klant: klant?.name ?? 'Onbekende klant',
      branch: b.branch,
      batch_kind: b.batch_kind,
      status: b.status,
      created_at: b.created_at,
      completed_at: b.completed_at,
      extern_factuurnummer: b.extern_factuurnummer,
      extern_bedrag_excl: b.extern_bedrag_excl === null ? null : Number(b.extern_bedrag_excl),
      batchprijs: Number(b.total_price) || 0,
      ...berekenBatchWinst(b, facturenPerBatch.get(b.id) ?? [], kostenPerBatch.get(b.id) ?? null, winstdeelVanBatch(afspraken, b)),
    };
  });

  const betaald = rijen.filter(r => r.betaalwijze !== 'open');
  const { data: lekkage } = await supabase.rpc('winst_lekkage', { p_van: van, p_tot: tot });

  /* Betaalde facturen die niet aan een batch hangen (bijvoorbeeld een losse
     bulkverkoop). Hun leadkosten staan onder "leads buiten een batch"; zonder
     deze regel ontbrak de bijbehorende omzet. Op betaaldatum in de periode;
     afspraken en interne klanten tellen niet. */
  const { data: losRuw } = await supabase
    .from('invoices')
    .select('id, invoice_number, subtotal, description, paid_at, customer_id, customer_name, customers(intern)')
    .eq('status', 'paid')
    .is('batch_id', null)
    .is('appointment_batch_id', null)
    .is('credit_note_of', null)
    .gte('paid_at', `${van}T00:00:00Z`)
    .lt('paid_at', totExclusief.toISOString())
    .order('paid_at', { ascending: false });
  const los = (losRuw ?? []).filter(f => {
    const k = (Array.isArray(f.customers) ? f.customers[0] : f.customers) as { intern?: boolean } | null;
    return !k?.intern;
  });
  const losIds = los.map(f => f.id as string);
  let losCredit = 0;
  if (losIds.length > 0) {
    const { data: cr } = await supabase.from('invoices').select('subtotal').in('credit_note_of', losIds);
    losCredit = (cr ?? []).reduce((s, c) => s + Math.abs(Number(c.subtotal) || 0), 0);
  }
  /* Externe facturen (Rompslomp, vooral bulk) op hun factuurdatum: zelfde
     regels als de maandomzet. */
  let extern: Awaited<ReturnType<typeof laadExterneOmzet>>['rijen'];
  try {
    extern = (await laadExterneOmzet(supabase, van)).rijen.filter(e => String(e.datum).slice(0, 10) <= tot);
  } catch {
    return NextResponse.json({ error: 'Externe omzet kon niet worden geladen' }, { status: 500 });
  }
  const nlDag = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
  const losRijen = [
    ...los.map(f => {
      const bedrag = Number(f.subtotal) || 0;
      const klantId = f.customer_id as string | null;
      return {
        nummer: f.invoice_number as string | null, customer_id: klantId, klant: f.customer_name as string | null, bedrag,
        omschrijving: f.description as string | null, betaald: f.paid_at as string,
        winstdeling: afTeStaan(bedrag, winstdeelVan(afspraken, klantId, nlDag(f.paid_at as string))),
      };
    }),
    ...extern.map(e => {
      const bedrag = Number(e.bedrag_excl) || 0;
      const dag = String(e.datum).slice(0, 10);
      return {
        nummer: e.factuurnummer ?? null, customer_id: e.customer_id ?? null, klant: e.klant_naam ?? null, bedrag,
        omschrijving: e.omschrijving ?? null, betaald: dag,
        winstdeling: afTeStaan(bedrag, winstdeelVan(afspraken, e.customer_id, dag)),
      };
    }),
  ].sort((a, b) => b.betaald.localeCompare(a.betaald));
  const cent = (n: number) => Math.round(n * 100) / 100;
  const omzetBuitenBatches = {
    bedrag: cent(losRijen.reduce((s, f) => s + f.bedrag, 0) - losCredit),
    winstdeling: cent(losRijen.reduce((s, f) => s + f.winstdeling, 0)),
    facturen: losRijen,
  };

  return NextResponse.json(
    {
      van,
      tot,
      rijen,
      totaal: telWinstOp(betaald),
      totaalOnbetaald: telWinstOp(rijen.filter(r => r.betaalwijze === 'open')),
      lekkage: Array.isArray(lekkage) ? lekkage[0] ?? null : lekkage ?? null,
      omzetBuitenBatches,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
