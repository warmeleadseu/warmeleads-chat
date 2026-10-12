import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { berekenBatchWinst, telWinstOp, type WinstKosten } from '@/lib/batchWinst';
import { laadFacturenPerBatch, laadKostenPerBatch } from '@/lib/batchWinstLaden';

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
    created_at: string; completed_at: string | null; customers: { name?: string; intern?: boolean } | { name?: string; intern?: boolean }[] | null;
  };
  const batches: BatchRij[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_kind, status, batch_size, total_price, price_per_lead, is_paid, mollie_payment_id, leads_delivered_external, extern_bedrag_excl, extern_factuurnummer, created_at, completed_at, customers(name, intern)')
      .in('batch_kind', SOORTEN)
      .gte('created_at', `${van}T00:00:00Z`)
      .lt('created_at', totExclusief.toISOString())
      .order('created_at', { ascending: false })
      .range(p * 1000, p * 1000 + 999);
    if (error) return NextResponse.json({ error: 'Batches konden niet worden geladen' }, { status: 500 });
    /* Interne klanten (masterportaal, afsprakenverzameling) zijn geen omzet
       van buiten; hun leadkosten staan apart in het lekkage-overzicht. */
    batches.push(...((data ?? []) as BatchRij[]).filter(b => {
      const k = Array.isArray(b.customers) ? b.customers[0] : b.customers;
      return !k?.intern;
    }));
    if (!data || data.length < 1000) break;
  }

  const ids = batches.map(b => b.id);

  const facturenPerBatch = await laadFacturenPerBatch(supabase, ids);
  let kostenPerBatch: Map<string, WinstKosten>;
  try {
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
      ...berekenBatchWinst(b, facturenPerBatch.get(b.id) ?? [], kostenPerBatch.get(b.id) ?? null),
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
    .select('id, invoice_number, subtotal, description, paid_at, customer_name, customers(intern)')
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
  const omzetBuitenBatches = {
    bedrag: Math.round((los.reduce((s, f) => s + (Number(f.subtotal) || 0), 0) - losCredit) * 100) / 100,
    facturen: los.map(f => ({ nummer: f.invoice_number, klant: f.customer_name, bedrag: Number(f.subtotal) || 0, omschrijving: f.description, betaald: f.paid_at })),
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
