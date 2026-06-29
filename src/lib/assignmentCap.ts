/**
 * Gedeelde regels voor "hoe vaak mag een gedeelde lead worden toegewezen".
 *
 * Eén bron van waarheid voor alle distributieroutes (runtime-pipeline,
 * batch-backfill en niche-onderzoek), zodat de cap overal identiek geldt en
 * een lead nooit aan méér dan het toegestane aantal klanten gaat.
 *
 * De telling gebeurt op **distinct klanten binnen een rollend venster** van
 * `REASSIGNMENT_COOLDOWN_DAYS`. Dezelfde klant in meerdere batches telt als
 * één (en wordt sowieso al voorkomen door de per-route dedup op customer_id).
 */

/** Hard plafond in het product (gedeelde leads): max. aantal klanten per lead. */
export const MAX_CUSTOMER_ASSIGNMENTS = 3;
/** Streefgemiddelde aantal toewijzingen per lead. */
export const TARGET_AVG_ASSIGNMENTS = 2;
/** Venster waarbinnen toewijzingen meetellen voor de cap (en re-distributie). */
export const REASSIGNMENT_COOLDOWN_DAYS = 30;

type LeadWithCustomFields = {
  custom_fields?: Record<string, unknown> | null;
};

/**
 * Effectieve cap voor één lead: standaard {@link MAX_CUSTOMER_ASSIGNMENTS},
 * maar per lead te verlagen via `custom_fields.max_customer_assignments` (1–3).
 * Nooit hoger dan het harde plafond.
 */
export function effectiveMaxAssignments(lead: LeadWithCustomFields): number {
  const cf = lead.custom_fields;
  if (!cf || typeof cf !== 'object') return MAX_CUSTOMER_ASSIGNMENTS;
  const raw = (cf as Record<string, unknown>).max_customer_assignments;
  const n =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return MAX_CUSTOMER_ASSIGNMENTS;
  return Math.min(MAX_CUSTOMER_ASSIGNMENTS, Math.max(1, Math.floor(n)));
}

/**
 * Distinct klant-ids waaraan de lead binnen het cooldown-venster is toegewezen.
 * Toewijzingen zonder (geldige) datum tellen we mee, zodat de cap nooit per
 * ongeluk omzeild kan worden.
 */
export function recentDistinctCustomerIds(
  assignments: { customer_id: string | null; assigned_at: string | null }[],
  now: Date = new Date(),
): Set<string> {
  const cutoffMs = now.getTime() - REASSIGNMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const set = new Set<string>();
  for (const a of assignments) {
    if (!a.customer_id) continue;
    const t = a.assigned_at ? new Date(a.assigned_at).getTime() : NaN;
    if (Number.isNaN(t) || t >= cutoffMs) set.add(a.customer_id);
  }
  return set;
}

/**
 * Of de lead nog aan deze (nieuwe) klant toegewezen mag worden zonder de cap te
 * overschrijden. `candidateCustomerId` wordt uit de telling gehaald (een
 * her-toewijzing aan dezelfde klant wordt elders al voorkomen).
 */
export function canAssignWithinCap(
  lead: LeadWithCustomFields,
  existingAssignments: { customer_id: string | null; assigned_at: string | null }[],
  candidateCustomerId: string,
  now: Date = new Date(),
): boolean {
  const distinct = recentDistinctCustomerIds(existingAssignments, now);
  distinct.delete(candidateCustomerId);
  return distinct.size < effectiveMaxAssignments(lead);
}
