import type { SupabaseClient } from '@supabase/supabase-js';
import { agentMayAccessAssignment, buildPortalAgentLeadScope, type PortalAgentLeadScope } from './portalAgentLeadScope';
import { hasPermission, PERMISSIONS, type PortalSession } from './portalPermissions';
import { isEigen, type Terugbelmoment } from './terugbellen';

/**
 * Staat de terugbelfunctie aan voor deze klant? Zolang migratie 202 niet is
 * toegepast bestaat de kolom niet; dan staat hij uit.
 */
export async function terugbellenAan(supabase: SupabaseClient, customerId: string): Promise<boolean> {
  const { data, error } = await supabase.from('customers').select('terugbellen').eq('id', customerId).maybeSingle();
  if (error) return false;
  return (data as { terugbellen?: boolean } | null)?.terugbellen === true;
}

export function scopeVan(session: PortalSession): PortalAgentLeadScope | null {
  return buildPortalAgentLeadScope({
    portalUserId: session.portalUser?.id,
    viewAll: !session.portalUser || hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL),
    agentsSeeUnassignedLeads: session.customer.agents_see_unassigned_leads,
  });
}

type Een<T> = T | T[] | null;
const een = <T,>(v: Een<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export const MOMENT_VELDEN =
  'id, lead_id, assignment_id, terug_op, notitie, portal_user_id, apparaat, voor_iedereen, gepland_door, keer_verzet, lead_assignments!inner(portal_user_id, status), leads!inner(naam_klant, telefoonnummer, plaatsnaam, branch, toestemming_ingetrokken_op)';

export type MomentRij = {
  id: string; lead_id: string; assignment_id: string; terug_op: string; notitie: string | null;
  portal_user_id: string | null; apparaat: string | null; voor_iedereen: boolean; gepland_door: string | null; keer_verzet: number;
  lead_assignments: Een<{ portal_user_id: string | null; status: string | null }>;
  leads: Een<{ naam_klant: string | null; telefoonnummer: string | null; plaatsnaam: string | null; branch: string; toestemming_ingetrokken_op: string | null }>;
};

/** Mag deze sessie het moment zien? Eigen momenten altijd, verder volgens de leadrechten. */
export function magMomentZien(r: MomentRij, session: PortalSession, scope: PortalAgentLeadScope | null): boolean {
  if (session.portalUser && r.portal_user_id === session.portalUser.id) return true;
  return agentMayAccessAssignment({ portal_user_id: een(r.lead_assignments)?.portal_user_id ?? null }, scope);
}

/** Alle open momenten die deze sessie mag zien, eerstvolgende eerst. */
export async function laadOpenMomenten(supabase: SupabaseClient, session: PortalSession, apparaat: string | null): Promise<Terugbelmoment[]> {
  const scope = scopeVan(session);
  const uit: Terugbelmoment[] = [];
  for (let p = 0; p < 5; p++) {
    const { data, error } = await supabase
      .from('lead_terugbelmomenten')
      .select(MOMENT_VELDEN)
      .eq('customer_id', session.customer.id)
      .eq('status', 'open')
      .order('terug_op')
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(`terugbelmomenten: ${error.message}`);
    for (const r of (data ?? []) as unknown as MomentRij[]) {
      const lead = een(r.leads);
      /* Wie zijn toestemming introk, mag niet meer gebeld worden. */
      if (!lead || lead.toestemming_ingetrokken_op || !magMomentZien(r, session, scope)) continue;
      uit.push({
        id: r.id, lead_id: r.lead_id, terug_op: r.terug_op, notitie: r.notitie, portal_user_id: r.portal_user_id,
        voor_iedereen: r.voor_iedereen, gepland_door: r.gepland_door,
        eigen: isEigen(r, { portalUserId: session.portalUser?.id ?? null, apparaat }),
        naam: lead.naam_klant || 'Onbekend', telefoon: lead.telefoonnummer, plaats: lead.plaatsnaam, branch: lead.branch,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return uit;
}
