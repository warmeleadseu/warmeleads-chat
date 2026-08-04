/**
 * Agent-zichtbaarheid op lead_assignments in het klantportaal.
 *
 * Standaard (seeUnassigned=true): agent ziet eigen leads + niet-toegewezen pool.
 * Strikt (seeUnassigned=false): agent ziet alleen leads die expliciet aan hen
 * zijn toegewezen — gebruikt o.a. door Bespaarr zodat nieuwe agents niet de
 * hele historische batch-pool zien.
 */

export type PortalAgentLeadScope = {
  portalUserId: string;
  /** true = owner/manager met leads.view_all → geen restrictie */
  viewAll: boolean;
  /** false = geen toegang tot portal_user_id IS NULL */
  seeUnassigned: boolean;
};

/** Bouw scope vanuit sessie + klantinstelling. */
export function buildPortalAgentLeadScope(input: {
  portalUserId: string | null | undefined;
  viewAll: boolean;
  /** customers.agents_see_unassigned_leads; default true */
  agentsSeeUnassignedLeads?: boolean | null;
}): PortalAgentLeadScope | null {
  if (!input.portalUserId || input.viewAll) return null;
  return {
    portalUserId: input.portalUserId,
    viewAll: false,
    seeUnassigned: input.agentsSeeUnassignedLeads !== false,
  };
}

/**
 * Past PostgREST-filter toe op een lead_assignments-query.
 * No-op wanneer scope null/viewAll.
 */
export function applyPortalAgentAssignmentScope<T extends {
  or(filter: string): T;
  eq(col: string, val: unknown): T;
}>(query: T, scope: PortalAgentLeadScope | null | undefined): T {
  if (!scope || scope.viewAll) return query;
  if (scope.seeUnassigned) {
    return query.or(`portal_user_id.eq.${scope.portalUserId},portal_user_id.is.null`);
  }
  return query.eq('portal_user_id', scope.portalUserId);
}

/** Mag deze agent deze assignment zien/bewerken? */
export function agentMayAccessAssignment(
  assignment: { portal_user_id?: string | null },
  scope: PortalAgentLeadScope | null | undefined,
): boolean {
  if (!scope || scope.viewAll) return true;
  const assignedTo = assignment.portal_user_id ?? null;
  if (assignedTo === scope.portalUserId) return true;
  if (scope.seeUnassigned && !assignedTo) return true;
  return false;
}
