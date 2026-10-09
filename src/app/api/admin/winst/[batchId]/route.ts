import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

/**
 * Detail van de winst van één batch: per geleverde lead wat hij kostte, uit
 * welke campagne hij kwam en met hoeveel klanten hij gedeeld is. PATCH legt
 * het externe factuurnummer en bedrag vast voor batches die buiten het
 * systeem om zijn gefactureerd. Alleen voor superadmins.
 */

type Ctx = { params: Promise<{ batchId: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: NextRequest, { params }: Ctx) {
  const { error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang) return geenToegang;
  const { batchId } = await params;
  if (!UUID.test(batchId)) return NextResponse.json({ error: 'Ongeldige batch' }, { status: 400 });

  const supabase = createServerClient();
  const { data: toewijzingen, error } = await supabase
    .from('lead_assignments')
    .select('lead_id, assigned_at, source, leads(naam_klant, plaatsnaam, created_at, meta_campaign_id)')
    .eq('batch_id', batchId)
    .not('source', 'in', '(mirror,demo)')
    .order('assigned_at', { ascending: false })
    .limit(3000);
  if (error) return NextResponse.json({ error: 'Leads konden niet worden geladen' }, { status: 500 });

  const leadIds = (toewijzingen ?? []).map(t => t.lead_id as string);
  const kosten = new Map<string, { kosten: number; bron: string; campagne_id: string | null }>();
  const klanten = new Map<string, Set<string>>();
  for (let i = 0; i < leadIds.length; i += 150) {
    const deel = leadIds.slice(i, i + 150);
    const [{ data: k }, { data: a }] = await Promise.all([
      supabase.from('lead_kosten').select('lead_id, kosten, bron, campagne_id').in('lead_id', deel),
      supabase.from('lead_assignments').select('lead_id, customer_id, source').in('lead_id', deel),
    ]);
    for (const r of k ?? []) kosten.set(r.lead_id as string, { kosten: Number(r.kosten), bron: r.bron as string, campagne_id: r.campagne_id as string | null });
    for (const r of a ?? []) {
      if (r.source === 'mirror' || r.source === 'demo') continue;
      const s = klanten.get(r.lead_id as string) ?? new Set<string>();
      s.add(r.customer_id as string);
      klanten.set(r.lead_id as string, s);
    }
  }

  /* Campagnenamen, voor wie wil zien waar een dure lead vandaan kwam. */
  const campagneIds = [...new Set([...kosten.values()].map(k => k.campagne_id).filter(Boolean))] as string[];
  const namen = new Map<string, string>();
  for (let i = 0; i < campagneIds.length; i += 100) {
    const { data } = await supabase
      .from('meta_ad_spend')
      .select('campaign_id, campaign_name')
      .in('campaign_id', campagneIds.slice(i, i + 100))
      .order('date', { ascending: false })
      .limit(1000);
    for (const r of data ?? []) if (!namen.has(r.campaign_id as string) && r.campaign_name) namen.set(r.campaign_id as string, r.campaign_name as string);
  }

  const leads = (toewijzingen ?? []).map(t => {
    const lead = (Array.isArray(t.leads) ? t.leads[0] : t.leads) as { naam_klant?: string; plaatsnaam?: string; created_at?: string } | null;
    const k = kosten.get(t.lead_id as string);
    const n = Math.max(1, klanten.get(t.lead_id as string)?.size ?? 1);
    return {
      lead_id: t.lead_id,
      naam: lead?.naam_klant ?? '',
      plaats: lead?.plaatsnaam ?? '',
      binnengekomen: lead?.created_at ?? null,
      geleverd_op: t.assigned_at,
      campagne: k?.campagne_id ? namen.get(k.campagne_id) ?? k.campagne_id : null,
      kosten_lead: k ? Math.round(k.kosten * 100) / 100 : null,
      kosten_bron: k?.bron ?? 'onbekend',
      klanten: n,
      aandeel: k ? Math.round((k.kosten / n) * 100) / 100 : 0,
    };
  });

  return NextResponse.json({ leads }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { admin, error: geenToegang } = await requireSuperAdmin(request);
  if (geenToegang || !admin) return geenToegang;
  const { batchId } = await params;
  if (!UUID.test(batchId)) return NextResponse.json({ error: 'Ongeldige batch' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { extern_factuurnummer?: unknown; extern_bedrag_excl?: unknown };
  const updates: Record<string, unknown> = {};

  if ('extern_factuurnummer' in body) {
    const nr = typeof body.extern_factuurnummer === 'string' ? body.extern_factuurnummer.trim().slice(0, 100) : '';
    updates.extern_factuurnummer = nr || null;
  }
  if ('extern_bedrag_excl' in body) {
    const ruw = body.extern_bedrag_excl;
    if (ruw === null || ruw === '') updates.extern_bedrag_excl = null;
    else {
      const n = Number(String(ruw).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
        return NextResponse.json({ error: 'Vul een geldig bedrag excl. btw in' }, { status: 400 });
      }
      updates.extern_bedrag_excl = Math.round(n * 100) / 100;
    }
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Niets te wijzigen' }, { status: 400 });

  const supabase = createServerClient();
  const { data: oud } = await supabase
    .from('customer_batches')
    .select('customer_id, extern_factuurnummer, extern_bedrag_excl')
    .eq('id', batchId)
    .maybeSingle();
  if (!oud) return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });

  const { error } = await supabase.from('customer_batches').update(updates).eq('id', batchId);
  if (error) return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });

  void logAudit({
    adminId: admin.id,
    adminName: admin.name ?? null,
    action: 'batch_externe_factuur',
    entityType: 'batch',
    entityId: batchId,
    details: { customer_id: oud.customer_id, voor: { nr: oud.extern_factuurnummer, bedrag: oud.extern_bedrag_excl }, na: updates },
  });

  return NextResponse.json({ ok: true, ...updates });
}
