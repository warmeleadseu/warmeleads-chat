import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { assignLeadToBatch } from '@/lib/assignLeadToBatch';
import { MAX_UITDELINGEN } from '@/lib/restleads';

/**
 * Een restlead alsnog uitdelen aan een of meer klanten.
 *
 * Deze leads liggen per definitie (net) buiten het doelgebied, dus de
 * geocontrole wordt bewust overgeslagen. Branche en het plafond van drie
 * klanten blijven wél gelden: die overtreden breekt de afspraken met de klant,
 * en niet alleen het gebied.
 */

const MIRROR = 'mirror';
/** Ruim genoeg voor een handmatige actie, krap genoeg om de looptijd te begrenzen. */
const MAX_PER_AANROEP = 10;

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan restleads uitdelen' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const leadId: string = body.lead_id;
  const doelen: { customer_id: string; batch_id: string }[] = Array.isArray(body.doelen) ? body.doelen : [];

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
    .select('customer_id, source')
    .eq('lead_id', leadId);

  const al = new Set((bestaand || []).filter(a => a.source !== MIRROR).map(a => a.customer_id));

  /* Het plafond geldt op het moment van uitdelen, niet toen het scherm werd
     geladen: tussendoor kan de verdeler er al een gedaan hebben. */
  const uitkomsten: { customer_id: string; klant?: string; ok: boolean; reden?: string }[] = [];

  for (const doel of doelen) {
    if (al.has(doel.customer_id)) {
      uitkomsten.push({ customer_id: doel.customer_id, ok: false, reden: 'Klant had deze lead al' });
      continue;
    }
    if (al.size >= 3) {
      uitkomsten.push({ customer_id: doel.customer_id, ok: false, reden: 'Plafond van 3 klanten bereikt' });
      continue;
    }

    const { data: klant } = await supabase
      .from('customers')
      .select('id, name, branches, is_active')
      .eq('id', doel.customer_id)
      .maybeSingle();

    if (!klant || klant.is_active === false) {
      uitkomsten.push({ customer_id: doel.customer_id, ok: false, reden: 'Klant bestaat niet of is inactief' });
      continue;
    }

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
      uitkomsten.push({ customer_id: doel.customer_id, klant: klant.name, ok: true });
    } else {
      uitkomsten.push({ customer_id: doel.customer_id, klant: klant.name, ok: false, reden: resultaat.reason });
    }
  }

  const gelukt = uitkomsten.filter(u => u.ok).length;
  return NextResponse.json({
    gelukt,
    mislukt: uitkomsten.length - gelukt,
    uitgedeeld_nu: al.size,
    verdwijnt_uit_lijst: al.size >= MAX_UITDELINGEN,
    uitkomsten,
  });
}
