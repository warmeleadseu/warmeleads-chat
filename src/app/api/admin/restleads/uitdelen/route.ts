import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { assignLeadToBatch } from '@/lib/assignLeadToBatch';
import { MAX_UITDELINGEN, RESTLEAD_REDEN } from '@/lib/restleads';
import { planMomenten, dagSleutel } from '@/lib/restleadPlanning';

/**
 * Een restlead alsnog uitdelen aan een of meer klanten.
 *
 * Deze leads liggen per definitie (net) buiten het doelgebied, dus de
 * geocontrole wordt bewust overgeslagen. Branche en het plafond van drie
 * klanten blijven wél gelden: die overtreden breekt de afspraken met de klant,
 * en niet alleen het gebied.
 *
 * Standaard wordt er gespreid: de eerste klant krijgt de lead meteen, de
 * volgende pas na de cooldown van twaalf uur. Anders wordt dezelfde consument
 * binnen een middag door drie bedrijven gebeld, precies wat die cooldown moet
 * voorkomen. Met `meteen: true` gaat alles ineens, wat logisch is bij oude
 * leads uit de lijst "verlopen" die als bulk worden verkocht.
 */

const MIRROR = 'mirror';
const MAX_PER_AANROEP = 10;

/**
 * Wat er per dag al bij deze klant terechtkomt: geleverd plus gepland.
 *
 * Nodig om het dagplafond te respecteren. Alleen naar geleverde toewijzingen
 * kijken is niet genoeg: dan plan je over je eigen wachtrij heen.
 */
async function bezettingPerDag(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<Record<string, number>> {
  const vanaf = new Date();
  vanaf.setHours(0, 0, 0, 0);
  const tot = new Date(vanaf);
  tot.setDate(tot.getDate() + 60);

  const [geleverd, gepland] = await Promise.all([
    supabase
      .from('lead_assignments')
      .select('assigned_at')
      .eq('customer_id', customerId)
      .gte('assigned_at', vanaf.toISOString()),
    supabase
      .from('geplande_leadleveringen')
      .select('gepland_voor')
      .eq('customer_id', customerId)
      .eq('status', 'gepland')
      .gte('gepland_voor', vanaf.toISOString())
      .lte('gepland_voor', tot.toISOString()),
  ]);

  const perDag: Record<string, number> = {};
  for (const r of geleverd.data || []) {
    const s = dagSleutel(new Date(r.assigned_at));
    perDag[s] = (perDag[s] ?? 0) + 1;
  }
  for (const r of gepland.data || []) {
    const s = dagSleutel(new Date(r.gepland_voor));
    perDag[s] = (perDag[s] ?? 0) + 1;
  }
  return perDag;
}

interface Doel {
  customer_id: string;
  batch_id: string;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan restleads uitdelen' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const leadId: string = body.lead_id;
  const doelen: Doel[] = Array.isArray(body.doelen) ? body.doelen : [];
  const meteen: boolean = body.meteen === true;

  if (!leadId || doelen.length === 0) {
    return NextResponse.json({ error: 'lead_id en minimaal een klant zijn verplicht' }, { status: 400 });
  }
  if (doelen.length > MAX_PER_AANROEP) {
    return NextResponse.json({ error: 'Te veel klanten tegelijk' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 });

  const { data: bestaand } = await supabase
    .from('lead_assignments')
    .select('customer_id, source, assigned_at')
    .eq('lead_id', leadId);

  const echte = (bestaand || []).filter(a => a.source !== MIRROR);
  const al = new Set(echte.map(a => a.customer_id));

  /* Al iets in de wachtrij voor deze lead? Dat telt mee voor het plafond,
     anders plan je er drie in terwijl er al twee stonden. */
  const { data: gepland } = await supabase
    .from('geplande_leadleveringen')
    .select('customer_id')
    .eq('lead_id', leadId)
    .eq('status', 'gepland');

  for (const g of gepland || []) al.add(g.customer_id);

  const laatste = echte.length > 0
    ? new Date(Math.max(...echte.map(a => new Date(a.assigned_at).getTime())))
    : null;

  const teDoen: Doel[] = [];
  const uitkomsten: { customer_id: string; klant?: string; ok: boolean; reden?: string; wanneer?: string }[] = [];

  for (const doel of doelen) {
    if (al.has(doel.customer_id)) {
      uitkomsten.push({ customer_id: doel.customer_id, ok: false, reden: 'Klant had deze lead al of staat al gepland' });
      continue;
    }
    if (al.size + teDoen.length >= 3) {
      uitkomsten.push({ customer_id: doel.customer_id, ok: false, reden: 'Plafond van 3 klanten bereikt' });
      continue;
    }
    teDoen.push(doel);
  }

  if (teDoen.length === 0) {
    return NextResponse.json({ gelukt: 0, direct: 0, ingepland: 0, mislukt: uitkomsten.length, uitkomsten });
  }

  /* Het dagplafond van de klant geldt ook bij handwerk: anders krijgt een
     klant met plafond 5 er via dit scherm dertig op één dag. Per klant, want
     de doelen kunnen verschillende klanten zijn. */
  const plafonds = new Map<string, { plafond: number; bezet: Record<string, number> }>();
  if (!meteen) {
    for (const doel of teDoen) {
      if (plafonds.has(doel.customer_id)) continue;
      const { data: b } = await supabase
        .from('customer_batches')
        .select('leads_per_day')
        .eq('id', doel.batch_id)
        .maybeSingle();
      plafonds.set(doel.customer_id, {
        plafond: Number(b?.leads_per_day) || 0,
        bezet: await bezettingPerDag(supabase, doel.customer_id),
      });
    }
  }

  const momenten = meteen
    ? teDoen.map(() => new Date())
    : teDoen.map((doel, i) => {
        const p = plafonds.get(doel.customer_id);
        return planMomenten({
          laatsteToewijzing: laatste,
          aantal: i + 1,
          dagplafond: p?.plafond ?? 0,
          alGepland: p?.bezet ?? {},
        })[i];
      });

  const nu = Date.now();
  let direct = 0;
  let ingepland = 0;

  for (let i = 0; i < teDoen.length; i++) {
    const doel = teDoen[i];
    const moment = momenten[i];

    const { data: klant } = await supabase
      .from('customers')
      .select('id, name, branches, is_active')
      .eq('id', doel.customer_id)
      .maybeSingle();

    if (!klant || klant.is_active === false) {
      uitkomsten.push({ customer_id: doel.customer_id, ok: false, reden: 'Klant bestaat niet of is inactief' });
      continue;
    }

    /* Alles binnen twee minuten gaat meteen; de rest de wachtrij in, die de
       cron elk kwartier afwerkt en die de regels opnieuw controleert op het
       moment van leveren. */
    if (moment.getTime() - nu <= 120_000) {
      const resultaat = await assignLeadToBatch({
        supabase,
        lead,
        customer: { id: klant.id, branches: (klant.branches as string[] | null) ?? null },
        batchId: doel.batch_id,
        source: 'distribution',
        negeerGeo: true,
      });

      if (resultaat.ok) {
        al.add(doel.customer_id);
        direct++;

        /* Ook een directe plaatsing krijgt een rij in de wachtrijtabel, meteen
           als geleverd. Zonder dat spoor is er geen verschil te zien tussen
           een lead die de verdeler zelf plaatste en een lead die jij hier
           bewust hebt afgehandeld, en zou hij in de werklijst blijven staan. */
        await supabase.from('geplande_leadleveringen').upsert({
          lead_id: leadId,
          customer_id: doel.customer_id,
          batch_id: doel.batch_id,
          gepland_voor: new Date().toISOString(),
          status: 'geleverd',
          pogingen: 1,
          negeer_geo: true,
          geleverd_op: new Date().toISOString(),
          assignment_id: resultaat.assignmentId ?? null,
          laatste_reden: null,
          reden: `${RESTLEAD_REDEN} direct uitgedeeld vanuit het overzicht.`,
          aangemaakt_door: admin.id,
        }, { onConflict: 'lead_id,customer_id' });

        uitkomsten.push({ customer_id: doel.customer_id, klant: klant.name, ok: true, wanneer: 'nu' });
      } else {
        uitkomsten.push({ customer_id: doel.customer_id, klant: klant.name, ok: false, reden: resultaat.reason });
      }
      continue;
    }

    const { error } = await supabase.from('geplande_leadleveringen').insert({
      lead_id: leadId,
      customer_id: doel.customer_id,
      batch_id: doel.batch_id,
      gepland_voor: moment.toISOString(),
      status: 'gepland',
      pogingen: 0,
      negeer_geo: true,
      reden: `${RESTLEAD_REDEN} gespreid volgens de cooldown van 12 uur.`,
      aangemaakt_door: admin.id,
    });

    if (error) {
      console.error('[restleads/uitdelen] inplannen mislukt:', error.message);
      uitkomsten.push({ customer_id: doel.customer_id, klant: klant.name, ok: false, reden: 'Inplannen mislukt' });
      continue;
    }

    al.add(doel.customer_id);
    ingepland++;
    uitkomsten.push({
      customer_id: doel.customer_id,
      klant: klant.name,
      ok: true,
      wanneer: moment.toISOString(),
    });
  }

  return NextResponse.json({
    gelukt: direct + ingepland,
    direct,
    ingepland,
    mislukt: uitkomsten.filter(u => !u.ok).length,
    uitgedeeld_nu: al.size,
    verdwijnt_uit_lijst: al.size >= MAX_UITDELINGEN,
    uitkomsten,
  });
}
