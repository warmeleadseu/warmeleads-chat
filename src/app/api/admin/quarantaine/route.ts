import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { distributeLead } from '@/lib/distribution';
import { calculateQualityScore } from '@/lib/leadQuality';
import { fireLeadCapi } from '@/lib/aiCapiHooks';
import { logAudit } from '@/lib/audit';
import { leadVoorTerugzetten, type QuarantaineStatus } from '@/lib/leadQuarantaine';

/**
 * Quarantaine: leads die de scheldwoordfilter tegenhield. Een beheerder geeft
 * ze vrij (de lead komt terug en wordt verdeeld) of wijst ze af (blijft
 * bewaard als spoor, maar gaat nergens heen). Niet voor accountmanagers:
 * het gaat om persoonsgegevens van nog niet verdeelde leads.
 */

const STATUSSEN: QuarantaineStatus[] = ['open', 'vrijgegeven', 'afgewezen'];

async function beheerder(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return { fout: unauthorized() };
  if (admin.role === 'accountmanager') {
    return { fout: NextResponse.json({ error: 'Alleen superadmin/admin beoordeelt de quarantaine' }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(request: NextRequest) {
  const { fout } = await beheerder(request);
  if (fout) return fout;

  const gevraagd = request.nextUrl.searchParams.get('status') as QuarantaineStatus | null;
  const status: QuarantaineStatus = gevraagd && STATUSSEN.includes(gevraagd) ? gevraagd : 'open';

  const supabase = createServerClient();
  const [{ data, error }, { count: open }] = await Promise.all([
    supabase
      .from('leads_quarantaine')
      .select('id, created_at, route, reden, lead, status, beoordeeld_op, beoordeeld_door, vrijgegeven_lead_id')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('leads_quarantaine').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);
  if (error) return NextResponse.json({ error: 'Quarantaine kon niet worden geladen' }, { status: 500 });

  return NextResponse.json({ items: data ?? [], open: open ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const { admin, fout } = await beheerder(request);
  if (fout) return fout;

  const body = (await request.json().catch(() => ({}))) as { id?: unknown; actie?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  const actie = body.actie;
  if (!id || (actie !== 'vrijgeven' && actie !== 'afwijzen')) {
    return NextResponse.json({ error: 'Geef een id en actie "vrijgeven" of "afwijzen" op' }, { status: 400 });
  }

  const supabase = createServerClient();
  const door = admin.name || admin.email || admin.id;
  const nu = new Date().toISOString();

  /* Eerst de rij claimen, alleen als hij nog open staat. Zo kunnen twee
     beheerders dezelfde lead niet allebei vrijgeven. */
  const { data: geclaimd } = await supabase
    .from('leads_quarantaine')
    .update({ status: actie === 'vrijgeven' ? 'vrijgegeven' : 'afgewezen', beoordeeld_op: nu, beoordeeld_door: door })
    .eq('id', id)
    .eq('status', 'open')
    .select('id, route, reden, lead')
    .maybeSingle();
  if (!geclaimd) {
    return NextResponse.json({ error: 'Deze lead is al beoordeeld of bestaat niet meer' }, { status: 409 });
  }

  if (actie === 'afwijzen') {
    await logAudit({
      adminId: admin.id, adminName: door, action: 'quarantaine_afwijzen', entityType: 'leads_quarantaine', entityId: id,
      details: { reden: geclaimd.reden, route: geclaimd.route },
    });
    return NextResponse.json({ ok: true, status: 'afgewezen' });
  }

  const lead = leadVoorTerugzetten(geclaimd.lead as Record<string, unknown>);
  if (lead.quality_score === undefined || lead.quality_score === null) {
    lead.quality_score = calculateQualityScore(lead as Parameters<typeof calculateQualityScore>[0]);
  }

  const { data: nieuw, error } = await supabase
    .from('leads')
    .insert(lead)
    .select('id, branch, lat, lng, bron')
    .single();
  if (error || !nieuw) {
    /* Terug naar open, zodat de beheerder het opnieuw kan proberen. */
    await supabase
      .from('leads_quarantaine')
      .update({ status: 'open', beoordeeld_op: null, beoordeeld_door: null })
      .eq('id', id);
    console.error('[quarantaine] terugzetten mislukt:', error?.message);
    const bestaatAl = error?.code === '23505';
    return NextResponse.json(
      { error: bestaatAl ? 'Deze lead staat al in de leads; vrijgeven is niet nodig' : 'Terugzetten mislukt' },
      { status: bestaatAl ? 409 : 500 },
    );
  }

  await supabase.from('leads_quarantaine').update({ vrijgegeven_lead_id: nieuw.id }).eq('id', id);

  let toegewezen = 0;
  if (nieuw.lat && nieuw.lng) {
    try {
      const r = await distributeLead({ id: nieuw.id, branch: nieuw.branch, lat: nieuw.lat, lng: nieuw.lng, bron: nieuw.bron });
      toegewezen = r.assignments.length;
    } catch (err) {
      /* De verdeel-cron pakt hem binnen een kwartier alsnog op. */
      console.warn('[quarantaine] direct verdelen mislukt:', err instanceof Error ? err.message : err);
    }
  }

  /* Een lead van de webhook of inhaalslag is nooit aan Meta gemeld; die van de
     verdeel-cron wel (die stond al in de leads). */
  if (geclaimd.route !== 'verdeel_cron') fireLeadCapi(nieuw.id);

  await logAudit({
    adminId: admin.id, adminName: door, action: 'quarantaine_vrijgeven', entityType: 'leads_quarantaine', entityId: id,
    details: { lead_id: nieuw.id, reden: geclaimd.reden, route: geclaimd.route, toegewezen },
  });

  return NextResponse.json({ ok: true, status: 'vrijgegeven', lead_id: nieuw.id, toegewezen });
}
