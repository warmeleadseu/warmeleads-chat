import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { berekenBatchWinst, telWinstOp, type WinstFactuur, type WinstKosten } from '@/lib/batchWinst';

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
    created_at: string; completed_at: string | null; customers: { name?: string } | { name?: string }[] | null;
  };
  const batches: BatchRij[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_kind, status, batch_size, total_price, price_per_lead, is_paid, mollie_payment_id, leads_delivered_external, extern_bedrag_excl, extern_factuurnummer, created_at, completed_at, customers(name)')
      .in('batch_kind', SOORTEN)
      .gte('created_at', `${van}T00:00:00Z`)
      .lt('created_at', totExclusief.toISOString())
      .order('created_at', { ascending: false })
      .range(p * 1000, p * 1000 + 999);
    if (error) return NextResponse.json({ error: 'Batches konden niet worden geladen' }, { status: 500 });
    batches.push(...((data ?? []) as BatchRij[]));
    if (!data || data.length < 1000) break;
  }

  const ids = batches.map(b => b.id);

  /* Facturen per batch, met creditnota's (die verwijzen naar de factuur). */
  const facturenPerBatch = new Map<string, WinstFactuur[]>();
  const factuurNaarBatch = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from('invoices')
      .select('id, batch_id, subtotal, credit_note_of')
      .in('batch_id', ids.slice(i, i + 150));
    for (const f of data ?? []) {
      if (!f.batch_id) continue;
      if (!f.credit_note_of) factuurNaarBatch.set(f.id as string, f.batch_id as string);
      const lijst = facturenPerBatch.get(f.batch_id as string) ?? [];
      lijst.push({ subtotal: f.subtotal as number, credit: Boolean(f.credit_note_of) });
      facturenPerBatch.set(f.batch_id as string, lijst);
    }
  }
  /* Creditnota's zonder eigen batch_id, via de factuur waar ze bij horen. */
  const factuurIds = [...factuurNaarBatch.keys()];
  for (let i = 0; i < factuurIds.length; i += 150) {
    const { data } = await supabase
      .from('invoices')
      .select('subtotal, credit_note_of, batch_id')
      .in('credit_note_of', factuurIds.slice(i, i + 150))
      .is('batch_id', null);
    for (const c of data ?? []) {
      const batchId = factuurNaarBatch.get(c.credit_note_of as string);
      if (!batchId) continue;
      const lijst = facturenPerBatch.get(batchId) ?? [];
      lijst.push({ subtotal: c.subtotal as number, credit: true });
      facturenPerBatch.set(batchId, lijst);
    }
  }

  const kostenPerBatch = new Map<string, WinstKosten>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.rpc('batch_winst_kosten', { p_batch_ids: ids.slice(i, i + 200) });
    if (error) return NextResponse.json({ error: 'Kosten konden niet worden berekend' }, { status: 500 });
    for (const k of (data ?? []) as (WinstKosten & { batch_id: string })[]) kostenPerBatch.set(k.batch_id, k);
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

  return NextResponse.json(
    {
      van,
      tot,
      rijen,
      totaal: telWinstOp(betaald),
      totaalOnbetaald: telWinstOp(rijen.filter(r => r.betaalwijze === 'open')),
      lekkage: Array.isArray(lekkage) ? lekkage[0] ?? null : lekkage ?? null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
