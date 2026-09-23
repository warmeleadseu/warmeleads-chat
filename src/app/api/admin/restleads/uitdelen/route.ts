import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { assignLeadToBatch } from '@/lib/assignLeadToBatch';
import { MAX_UITDELINGEN } from '@/lib/restleads';
import { planMomenten } from '@/lib/restleadPlanning';

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

  const momenten = meteen
    ? teDoen.map(() => new Date())
    : planMomenten({ laatsteToewijzing: laatste, aantal: teDoen.length });

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
      reden: 'Restleads: gespreid volgens de cooldown van 12 uur.',
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
