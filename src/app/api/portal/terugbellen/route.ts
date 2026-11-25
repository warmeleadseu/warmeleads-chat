import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized, logImpersonatedWrite } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { agentMayAccessAssignment } from '@/lib/portalAgentLeadScope';
import { logLeadActivity } from '@/lib/leadActivities';
import { MAX_NOTITIE, TERUGBELLEN, leesMoment, schoonApparaat } from '@/lib/terugbellen';
import { laadOpenMomenten, scopeVan, terugbellenAan } from '@/lib/terugbellenServer';

/**
 * Terugbelmomenten in het portaal (src/lib/terugbellen.ts).
 * GET: staat het aan, en welke momenten staan open. POST: plannen of verzetten.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_VIEW)) return NextResponse.json({ aan: false, momenten: [] }, NO_STORE);

  const supabase = createServerClient();
  if (!(await terugbellenAan(supabase, session.customer.id))) return NextResponse.json({ aan: false, momenten: [] }, NO_STORE);
  try {
    const momenten = await laadOpenMomenten(supabase, session, schoonApparaat(request.nextUrl.searchParams.get('apparaat')));
    return NextResponse.json({ aan: true, nu: new Date().toISOString(), momenten }, NO_STORE);
  } catch (err) {
    console.error('[portal/terugbellen]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Terugbelmomenten konden niet worden geladen' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_EDIT)) return forbidden('Je mag leadstatussen niet wijzigen');

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const leadId = typeof body.lead_id === 'string' && UUID.test(body.lead_id) ? body.lead_id : null;
  if (!leadId) return NextResponse.json({ error: 'Lead ontbreekt' }, { status: 400 });
  const moment = leesMoment(body.terug_op);
  if (!moment.ok) return NextResponse.json({ error: moment.fout }, { status: 400 });
  const notitie = typeof body.notitie === 'string' ? body.notitie.trim().slice(0, MAX_NOTITIE) || null : null;

  const supabase = createServerClient();
  const customerId = session.customer.id;
  if (!(await terugbellenAan(supabase, customerId))) return NextResponse.json({ error: 'De terugbelfunctie staat niet aan' }, { status: 403 });

  const { data: toewijzing, error: laadFout } = await supabase
    .from('lead_assignments')
    .select('id, status, portal_user_id, leads(toestemming_ingetrokken_op)')
    .eq('lead_id', leadId)
    .eq('customer_id', customerId)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (laadFout) return NextResponse.json({ error: 'Lead kon niet worden geladen' }, { status: 500 });
  if (!toewijzing) return NextResponse.json({ error: 'Voor deze lead kun je geen terugbelmoment plannen' }, { status: 404 });
  if (!agentMayAccessAssignment(toewijzing, scopeVan(session))) return forbidden('Geen toegang tot deze lead');
  const lead = (Array.isArray(toewijzing.leads) ? toewijzing.leads[0] : toewijzing.leads) as { toestemming_ingetrokken_op: string | null } | null;
  if (lead?.toestemming_ingetrokken_op) return NextResponse.json({ error: 'Deze persoon wil niet meer gebeld worden' }, { status: 409 });

  /* Voor wie: iedereen, een gebruiker (standaard wie het plant), of bij een
     gedeelde login de browser waarin het is gepland. */
  const voorIedereen = body.voor_iedereen === true;
  let portalUserId: string | null = session.portalUser?.id ?? null;
  if (typeof body.portal_user_id === 'string' && body.portal_user_id !== portalUserId) {
    if (!UUID.test(body.portal_user_id) || !hasPermission(session, PERMISSIONS.LEADS_ASSIGN)) return forbidden('Je mag dit niet aan een collega toewijzen');
    const { data: collega } = await supabase
      .from('portal_users').select('id').eq('id', body.portal_user_id).eq('customer_id', customerId).eq('is_active', true).maybeSingle();
    if (!collega) return NextResponse.json({ error: 'Collega niet gevonden' }, { status: 400 });
    portalUserId = collega.id as string;
  }
  const apparaat = portalUserId ? null : schoonApparaat(body.apparaat);
  const gegevens = {
    terug_op: moment.iso, notitie, portal_user_id: voorIedereen ? null : portalUserId, apparaat: voorIedereen ? null : apparaat,
    voor_iedereen: voorIedereen, herinnerd_op: null, updated_at: new Date().toISOString(),
  };

  const { data: open, error: openFout } = await supabase
    .from('lead_terugbelmomenten').select('id, keer_verzet').eq('assignment_id', toewijzing.id).eq('status', 'open').maybeSingle();
  if (openFout) return NextResponse.json({ error: 'Terugbelmoment kon niet worden opgeslagen' }, { status: 500 });

  let id = open?.id as string | undefined;
  if (open) {
    const { error } = await supabase
      .from('lead_terugbelmomenten').update({ ...gegevens, keer_verzet: (Number(open.keer_verzet) || 0) + 1 }).eq('id', open.id).eq('status', 'open');
    if (error) return NextResponse.json({ error: 'Terugbelmoment kon niet worden opgeslagen' }, { status: 500 });
  } else {
    const { data: nieuw, error } = await supabase
      .from('lead_terugbelmomenten')
      .insert({
        ...gegevens, assignment_id: toewijzing.id, lead_id: leadId, customer_id: customerId,
        gepland_door: session.portalUser?.name ?? session.customer.contact_person ?? session.customer.name,
      })
      .select('id')
      .single();
    if (error || !nieuw) return NextResponse.json({ error: 'Terugbelmoment kon niet worden opgeslagen' }, { status: 500 });
    id = nieuw.id as string;
  }

  if (toewijzing.status !== TERUGBELLEN) {
    const { error } = await supabase.from('lead_assignments').update({ status: TERUGBELLEN }).eq('id', toewijzing.id);
    if (error) {
      console.error('[portal/terugbellen] status', error.message);
      /* Geen moment zonder bijbehorende status. */
      if (!open && id) await supabase.from('lead_terugbelmomenten').delete().eq('id', id);
      return NextResponse.json({ error: 'Status bijwerken mislukt' }, { status: 500 });
    }
  }

  await logLeadActivity(supabase, {
    leadId, customerId, actorType: session.impersonatedByAdminId ? 'admin' : 'portal_user',
    actorId: session.impersonatedByAdminId || session.portalUser?.id || customerId,
    actorName: session.portalUser?.name || session.customer.name,
    action: 'terugbellen_gepland', details: { terug_op: moment.iso, verzet: Boolean(open) },
  });
  await logImpersonatedWrite(session, 'terugbellen', 'lead', leadId, { terug_op: moment.iso });
  return NextResponse.json({ ok: true, id, status: TERUGBELLEN, terug_op: moment.iso });
}
