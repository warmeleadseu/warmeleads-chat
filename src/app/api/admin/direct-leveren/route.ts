import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { addCivilDays, amsterdamWallTimeToUtc, amsterdamYmd } from '@/lib/appointmentSlots';
import {
  STATUSLOG_SINDS, berekenHerbestelling, berekenKengetallen, binnen, groepVan, voorNaVensters,
  type BatchRij, type Groep, type LeveringRij,
} from '@/lib/directVergelijking';

/**
 * Vergelijking direct leveren (en Snelraak) tegenover normaal. Superadmin en
 * admin. Twee weergaven: per direct-klant vóór en na, en vier groepen in de
 * gekozen periode. Alleen leveringen van de automatische verdeling tellen
 * (geen bulkexports of handmatige toewijzingen); interne klanten niet.
 */

export const maxDuration = 60;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const DAG = 86_400_000;
/** Standaard zoveel dagen terug ophalen; meer als een direct-klant al langer aan staat. */
const TERUG_DAGEN = 200;
const MAX_TERUG_DAGEN = 400;
const VENSTER_MAX_DAGEN = 90;
const PAGINA = 1000;

class LaadFout extends Error {}

/** Alle rijen van een query, pagina voor pagina; een fout breekt af. */
async function alles<T>(wat: string, maak: (van: number, tot: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, maxPaginas = 200): Promise<T[]> {
  const uit: T[] = [];
  for (let p = 0; p < maxPaginas; p++) {
    const { data, error } = await maak(p * PAGINA, p * PAGINA + PAGINA - 1);
    if (error) throw new LaadFout(`${wat}: ${error.message}`);
    const rijen = (data ?? []) as T[];
    uit.push(...rijen);
    if (rijen.length < PAGINA) return uit;
  }
  throw new LaadFout(`${wat}: meer dan ${maxPaginas * PAGINA} rijen`);
}

type Klant = { id: string; name: string | null; intern: boolean | null; direct_leveren: boolean | null; direct_leveren_sinds: string | null };
type Ruw = {
  id: string; lead_id: string; customer_id: string; assigned_at: string; status: string | null; via_direct: boolean | null; source: string | null;
  leads: { created_at?: string; branch?: string } | { created_at?: string; branch?: string }[] | null;
};
type Batch = BatchRij & { status: string | null; direct_leveren: string | null };

async function laad(supabase: SupabaseClient, sindsIso: string) {
  const [ruw, snelraak, statussen, reclamaties, batches] = await Promise.all([
    alles<Ruw>('leveringen', (a, b) => supabase
      .from('lead_assignments')
      .select('id, lead_id, customer_id, assigned_at, status, via_direct, source, leads(created_at, branch)')
      .not('source', 'in', '(mirror,demo)')
      .gte('assigned_at', sindsIso)
      .order('id')
      .range(a, b)),
    alles<{ assignment_id: string }>('Snelraak', (a, b) => supabase
      .from('integration_sync_log')
      .select('assignment_id')
      .eq('provider', 'partner_snelraak')
      .eq('status', 'success')
      .gte('created_at', sindsIso)
      .order('id')
      .range(a, b)),
    /* De eerste wijziging is die vanaf "nieuw"; dat houdt de hoeveelheid
       rijen op ongeveer één per levering. */
    alles<{ assignment_id: string; gewijzigd_op: string }>('statusgeschiedenis', (a, b) => supabase
      .from('lead_status_wijzigingen')
      .select('assignment_id, gewijzigd_op')
      .eq('van', 'nieuw')
      .gte('gewijzigd_op', STATUSLOG_SINDS)
      .order('id')
      .range(a, b)),
    alles<{ lead_id: string; customer_id: string }>('reclamaties', (a, b) => supabase
      .from('lead_reclamations')
      .select('lead_id, customer_id')
      .eq('status', 'approved')
      .gte('created_at', sindsIso)
      .order('id')
      .range(a, b)),
    alles<Batch>('batches', (a, b) => supabase
      .from('customer_batches')
      .select('id, customer_id, branch, created_at, completed_at, is_paid, status, direct_leveren')
      .eq('batch_kind', 'leads')
      .eq('is_paid', true)
      .order('id')
      .range(a, b)),
  ]);
  return { ruw, snelraak, statussen, reclamaties, batches };
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') return NextResponse.json({ error: 'Alleen admin en superadmin' }, { status: 403 });

  /* Periode in Amsterdamse dagen: van 00:00 tot en met 23:59 lokale tijd. */
  const q = request.nextUrl.searchParams;
  const nu = new Date();
  const vandaag = amsterdamYmd(nu);
  const vanDag = DATUM.test(q.get('van') ?? '') ? q.get('van')! : addCivilDays(vandaag, -30);
  const totDag = DATUM.test(q.get('tot') ?? '') ? q.get('tot')! : vandaag;
  if (vanDag > totDag) return NextResponse.json({ error: 'De begindatum ligt na de einddatum' }, { status: 400 });
  const van = amsterdamWallTimeToUtc(vanDag, '00:00');
  const tot = amsterdamWallTimeToUtc(addCivilDays(totDag, 1), '00:00');
  const branche = q.get('branche') || null;

  const supabase = createServerClient();
  const { data: klantenRuw, error: klantFout } = await supabase.from('customers').select('id, name, intern, direct_leveren, direct_leveren_sinds');
  if (klantFout) return NextResponse.json({ error: 'Klanten konden niet worden geladen' }, { status: 500 });
  const klantLijst = (klantenRuw ?? []) as Klant[];
  const klanten = new Map(klantLijst.map(k => [k.id, k]));
  const intern = new Set(klantLijst.filter(k => k.intern).map(k => k.id));

  /* Genoeg terug ophalen voor het vóór-venster van de langst lopende direct-klant. */
  const vroegsteSinds = Math.min(...klantLijst.filter(k => k.direct_leveren_sinds).map(k => new Date(k.direct_leveren_sinds as string).getTime()), Infinity);
  const ophaalStart = new Date(Math.max(
    nu.getTime() - MAX_TERUG_DAGEN * DAG,
    Math.min(nu.getTime() - TERUG_DAGEN * DAG, vroegsteSinds - VENSTER_MAX_DAGEN * DAG, van.getTime()),
  ));

  let data: Awaited<ReturnType<typeof laad>>;
  try {
    data = await laad(supabase, ophaalStart.toISOString());
  } catch (err) {
    console.error('[admin/direct-leveren]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Gegevens konden niet volledig worden geladen; probeer het opnieuw' }, { status: 500 });
  }

  const snelraak = new Set(data.snelraak.map(s => s.assignment_id));
  const eersteStatus = new Map<string, string>();
  for (const s of data.statussen) {
    const huidig = eersteStatus.get(s.assignment_id);
    if (!huidig || s.gewijzigd_op < huidig) eersteStatus.set(s.assignment_id, s.gewijzigd_op);
  }
  const reclamaties = new Set(data.reclamaties.map(r => `${r.lead_id}:${r.customer_id}`));

  /* Eerste (externe) klant per lead, over alle soorten toewijzingen. */
  const extern = data.ruw.filter(r => !intern.has(r.customer_id));
  const eersteOp = new Map<string, number>();
  for (const r of extern) {
    const t = new Date(r.assigned_at).getTime();
    if (!eersteOp.has(r.lead_id) || t < eersteOp.get(r.lead_id)!) eersteOp.set(r.lead_id, t);
  }

  const rijen: LeveringRij[] = extern
    .filter(r => r.source === 'distribution')
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

  const batches = data.batches.filter(b => !intern.has(b.customer_id));

  /* Weergave 1: per direct-klant vóór en na. Begin = het vroegste van de
     aanzetdatum op de klantkaart en de eerste directe levering (een batch op
     direct, of een eerdere periode). Het vóór-venster laat directe leveringen
     weg; het na-venster loopt tot nu als direct nog aan staat, anders tot de
     laatste directe levering. */
  const directPerKlant = new Map<string, { eerste: number; laatste: number }>();
  for (const r of rijen) {
    if (!r.via_direct) continue;
    const t = new Date(r.assigned_at).getTime();
    const d = directPerKlant.get(r.customer_id);
    if (!d) directPerKlant.set(r.customer_id, { eerste: t, laatste: t });
    else { d.eerste = Math.min(d.eerste, t); d.laatste = Math.max(d.laatste, t); }
  }
  const klantIds = new Set<string>([
    ...klantLijst.filter(k => k.direct_leveren && k.direct_leveren_sinds && !intern.has(k.id)).map(k => k.id),
    ...directPerKlant.keys(),
  ]);

  const perKlant = [...klantIds].map(klantId => {
    const k = klanten.get(klantId);
    const d = directPerKlant.get(klantId);
    const kaartSinds = k?.direct_leveren && k.direct_leveren_sinds ? new Date(k.direct_leveren_sinds).getTime() : Infinity;
    const sinds = new Date(Math.min(kaartSinds, d?.eerste ?? Infinity));
    const batchAan = batches.some(b => b.customer_id === klantId && b.direct_leveren === 'aan' && (b.status === 'active' || b.status === 'paused'));
    const aan = k?.direct_leveren === true || batchAan;
    const einde = aan ? nu : new Date((d?.laatste ?? sinds.getTime()) + 1);
    const v = voorNaVensters(sinds, einde, VENSTER_MAX_DAGEN, ophaalStart);
    const eigen = rijen.filter(r => r.customer_id === klantId);
    const eigenBatches = batches.filter(b => b.customer_id === klantId);
    return {
      customer_id: klantId,
      klant: k?.name ?? 'Onbekend',
      aan,
      bron: k?.direct_leveren ? 'klantkaart' : batchAan ? 'batch' : 'uit',
      sinds: sinds.toISOString(),
      dagen: Math.round((v.na[1].getTime() - v.na[0].getTime()) / DAG),
      voor: berekenKengetallen(eigen.filter(r => !r.via_direct && binnen(r.assigned_at, v.voor)), nu),
      na: berekenKengetallen(eigen.filter(r => binnen(r.assigned_at, v.na)), nu),
      herbestelVoor: berekenHerbestelling(eigenBatches.filter(b => b.completed_at && binnen(b.completed_at, v.voor)), eigenBatches, nu),
      herbestelNa: berekenHerbestelling(eigenBatches.filter(b => b.completed_at && binnen(b.completed_at, v.na)), eigenBatches, nu),
    };
  }).sort((a, b) => a.klant.localeCompare(b.klant, 'nl'));

  const branches = [...new Set(rijen.map(r => r.branch).filter(Boolean) as string[])].sort();

  return NextResponse.json(
    { van: van.toISOString(), tot: tot.toISOString(), branche, branches, groepen, perKlant },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
