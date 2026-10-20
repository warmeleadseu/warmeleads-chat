import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import {
  berekenHerbestelling, berekenKengetallen, binnen, groepVan, voorNaVensters,
  type BatchRij, type Groep, type LeveringRij,
} from '@/lib/directVergelijking';

/**
 * Vergelijking direct leveren (en Snelraak) tegenover normaal. Superadmin en
 * admin. Twee weergaven: per direct-klant vóór en na, en vier groepen in de
 * gekozen periode. Interne klanten tellen niet mee.
 */

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const TERUG_DAGEN = 200;

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') return NextResponse.json({ error: 'Alleen admin en superadmin' }, { status: 403 });

  const q = request.nextUrl.searchParams;
  const nu = new Date();
  const tot = DATUM.test(q.get('tot') ?? '') ? new Date(`${q.get('tot')}T23:59:59Z`) : nu;
  const van = DATUM.test(q.get('van') ?? '') ? new Date(`${q.get('van')}T00:00:00Z`) : new Date(nu.getTime() - 30 * 86_400_000);
  const branche = q.get('branche') || null;
  if (van > tot) return NextResponse.json({ error: 'De begindatum ligt na de einddatum' }, { status: 400 });

  const supabase = createServerClient();
  const sindsIso = new Date(nu.getTime() - TERUG_DAGEN * 86_400_000).toISOString();

  const { data: klantenRuw } = await supabase.from('customers').select('id, name, intern, direct_leveren, direct_leveren_sinds');
  const klanten = new Map((klantenRuw ?? []).map(k => [k.id as string, k]));
  const intern = new Set((klantenRuw ?? []).filter(k => k.intern).map(k => k.id as string));

  type Ruw = { id: string; lead_id: string; customer_id: string; assigned_at: string; status: string | null; via_direct: boolean | null; leads: { created_at?: string; branch?: string } | { created_at?: string; branch?: string }[] | null };
  const ruw: Ruw[] = [];
  for (let p = 0; p < 40; p++) {
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('id, lead_id, customer_id, assigned_at, status, via_direct, leads(created_at, branch)')
      .not('source', 'in', '(mirror,demo)')
      .gte('assigned_at', sindsIso)
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    if (error) return NextResponse.json({ error: 'Leveringen konden niet worden geladen' }, { status: 500 });
    ruw.push(...((data ?? []) as Ruw[]));
    if (!data || data.length < 1000) break;
  }

  /* Eerste klant per lead (binnen het opgehaalde venster). */
  const eersteOp = new Map<string, number>();
  for (const r of ruw) {
    const t = new Date(r.assigned_at).getTime();
    if (!eersteOp.has(r.lead_id) || t < eersteOp.get(r.lead_id)!) eersteOp.set(r.lead_id, t);
  }

  const snelraak = new Set<string>();
  for (let p = 0; p < 20; p++) {
    const { data } = await supabase.from('integration_sync_log').select('assignment_id').eq('provider', 'partner_snelraak').eq('status', 'success').gte('created_at', sindsIso).range(p * 1000, p * 1000 + 999);
    for (const s of data ?? []) snelraak.add(s.assignment_id as string);
    if (!data || data.length < 1000) break;
  }

  const eersteStatus = new Map<string, string>();
  for (let p = 0; p < 40; p++) {
    const { data } = await supabase.from('lead_status_wijzigingen').select('assignment_id, gewijzigd_op').gte('gewijzigd_op', sindsIso).order('gewijzigd_op').range(p * 1000, p * 1000 + 999);
    for (const s of data ?? []) if (!eersteStatus.has(s.assignment_id as string)) eersteStatus.set(s.assignment_id as string, s.gewijzigd_op as string);
    if (!data || data.length < 1000) break;
  }

  const reclamaties = new Set<string>();
  for (let p = 0; p < 10; p++) {
    const { data } = await supabase.from('lead_reclamations').select('lead_id, customer_id').eq('status', 'approved').gte('created_at', sindsIso).range(p * 1000, p * 1000 + 999);
    for (const r of data ?? []) reclamaties.add(`${r.lead_id}:${r.customer_id}`);
    if (!data || data.length < 1000) break;
  }

  const rijen: LeveringRij[] = ruw
    .filter(r => !intern.has(r.customer_id))
    .map(r => {
      const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads;
      return {
        assignment_id: r.id,
        customer_id: r.customer_id,
        lead_id: r.lead_id,
        branch: lead?.branch ?? null,
        assigned_at: r.assigned_at,
        lead_created_at: lead?.created_at ?? null,
        status: r.status,
        via_direct: r.via_direct === true,
        snelraak: snelraak.has(r.id),
        eerste_status_at: eersteStatus.get(r.id) ?? null,
        reclamatie: reclamaties.has(`${r.lead_id}:${r.customer_id}`),
        eerste_klant: eersteOp.get(r.lead_id) === new Date(r.assigned_at).getTime(),
      };
    });

  /* Weergave 2: vier groepen in de gekozen periode (en branche). */
  const inPeriode = rijen.filter(r => binnen(r.assigned_at, [van, tot]) && (!branche || r.branch === branche));
  const groepen = Object.fromEntries(
    (['direct_snelraak', 'direct', 'snelraak', 'geen'] as Groep[]).map(g => [g, berekenKengetallen(inPeriode.filter(r => groepVan(r) === g), nu)]),
  );

  /* Batches, voor herbestellen. */
  const { data: batchesRuw } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, created_at, completed_at, is_paid')
    .eq('batch_kind', 'leads')
    .eq('is_paid', true);
  const batches = ((batchesRuw ?? []) as BatchRij[]).filter(b => !intern.has(b.customer_id));

  /* Weergave 1: per direct-klant vóór en na. Begin = aanzetdatum op de
     klantkaart, anders de eerste directe levering (batch op direct). */
  const directKlanten = new Map<string, Date>();
  for (const k of klantenRuw ?? []) if (k.direct_leveren_sinds && !intern.has(k.id as string)) directKlanten.set(k.id as string, new Date(k.direct_leveren_sinds as string));
  const eersteDirect = new Map<string, number>();
  for (const r of rijen) {
    if (!r.via_direct || directKlanten.has(r.customer_id)) continue;
    const t = new Date(r.assigned_at).getTime();
    if (!eersteDirect.has(r.customer_id) || t < eersteDirect.get(r.customer_id)!) eersteDirect.set(r.customer_id, t);
  }
  for (const [id, t] of eersteDirect) directKlanten.set(id, new Date(t));

  const perKlant = [...directKlanten.entries()].map(([klantId, sinds]) => {
    const v = voorNaVensters(sinds, nu);
    const eigen = rijen.filter(r => r.customer_id === klantId);
    const eigenBatches = batches.filter(b => b.customer_id === klantId);
    return {
      customer_id: klantId,
      klant: (klanten.get(klantId)?.name as string) ?? 'Onbekend',
      aan: klanten.get(klantId)?.direct_leveren === true,
      sinds: sinds.toISOString(),
      dagen: Math.round((v.na[1].getTime() - v.na[0].getTime()) / 86_400_000),
      voor: berekenKengetallen(eigen.filter(r => binnen(r.assigned_at, v.voor)), nu),
      na: berekenKengetallen(eigen.filter(r => binnen(r.assigned_at, v.na)), nu),
      herbestelVoor: berekenHerbestelling(eigenBatches.filter(b => b.completed_at && binnen(b.completed_at, v.voor)), eigenBatches, nu),
      herbestelNa: berekenHerbestelling(eigenBatches.filter(b => b.completed_at && binnen(b.completed_at, v.na)), eigenBatches, nu),
    };
  }).sort((a, b) => a.klant.localeCompare(b.klant));

  const branches = [...new Set(rijen.map(r => r.branch).filter(Boolean) as string[])].sort();

  return NextResponse.json(
    { van: van.toISOString(), tot: tot.toISOString(), branche, branches, groepen, perKlant },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
