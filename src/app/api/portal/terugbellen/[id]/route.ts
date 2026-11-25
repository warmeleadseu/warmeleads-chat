import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized, logImpersonatedWrite } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, PERMISSIONS, forbidden } from '@/lib/portalPermissions';
import { logLeadActivity } from '@/lib/leadActivities';
import { UITKOMSTEN, leesMoment } from '@/lib/terugbellen';
import { MOMENT_VELDEN, magMomentZien, scopeVan, type MomentRij } from '@/lib/terugbellenServer';

/**
 * Een terugbelmoment uitstellen ({ terug_op }) of afhandelen ({ uitkomst }).
 * Afhandelen zet de status van de lead; de database sluit het moment dan zelf
 * (trigger terugbelmoment_afronden, migratie 202).
 */

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_EDIT)) return forbidden('Je mag leadstatussen niet wijzigen');
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Ongeldig terugbelmoment' }, { status: 400 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('lead_terugbelmomenten').select(MOMENT_VELDEN).eq('id', id).eq('customer_id', session.customer.id).eq('status', 'open').maybeSingle();
  if (error) return NextResponse.json({ error: 'Terugbelmoment kon niet worden geladen' }, { status: 500 });
  const rij = data as unknown as MomentRij | null;
  if (!rij) return NextResponse.json({ error: 'Dit terugbelmoment is al afgehandeld' }, { status: 404 });
  if (!magMomentZien(rij, session, scopeVan(session))) return forbidden('Geen toegang tot deze lead');

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const actor = {
    actorType: session.impersonatedByAdminId ? 'admin' as const : 'portal_user' as const,
    actorId: session.impersonatedByAdminId || session.portalUser?.id || session.customer.id,
    actorName: session.portalUser?.name || session.customer.name,
  };

  if (body.terug_op !== undefined) {
    const moment = leesMoment(body.terug_op);
    if (!moment.ok) return NextResponse.json({ error: moment.fout }, { status: 400 });
    const { error: fout } = await supabase
      .from('lead_terugbelmomenten')
      .update({ terug_op: moment.iso, herinnerd_op: null, keer_verzet: (rij.keer_verzet || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'open');
    if (fout) return NextResponse.json({ error: 'Uitstellen mislukt' }, { status: 500 });
    await logLeadActivity(supabase, { leadId: rij.lead_id, customerId: session.customer.id, ...actor, action: 'terugbellen_gepland', details: { terug_op: moment.iso, verzet: true } });
    await logImpersonatedWrite(session, 'terugbellen', 'lead', rij.lead_id, { terug_op: moment.iso });
    return NextResponse.json({ ok: true, terug_op: moment.iso });
  }

  const uitkomst = typeof body.uitkomst === 'string' ? body.uitkomst : '';
  if (!(UITKOMSTEN as readonly string[]).includes(uitkomst)) return NextResponse.json({ error: 'Kies een uitkomst' }, { status: 400 });
  const { error: fout } = await supabase.from('lead_assignments').update({ status: uitkomst }).eq('id', rij.assignment_id).eq('customer_id', session.customer.id);
  if (fout) return NextResponse.json({ error: 'Status bijwerken mislukt' }, { status: 500 });
  /* De trigger sluit het moment; dit vangt een lead op die niet (meer) op terugbellen stond. */
  await supabase.from('lead_terugbelmomenten').update({ status: 'afgehandeld', uitkomst, afgehandeld_op: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'open');
  await logLeadActivity(supabase, { leadId: rij.lead_id, customerId: session.customer.id, ...actor, action: 'status_change', details: { status: uitkomst, via: 'terugbellen' } });
  await logImpersonatedWrite(session, 'lead_update', 'lead', rij.lead_id, { status: uitkomst });
  return NextResponse.json({ ok: true, lead_id: rij.lead_id, status: uitkomst });
}
