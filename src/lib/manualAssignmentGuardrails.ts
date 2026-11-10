import type { SupabaseClient } from '@supabase/supabase-js';
import { matchLeadToTargets } from './matchLeadToTargets';
import type { GeoTargetRow } from './batchTargets';

export type ManualAssignmentGuardrailIssue = {
  code: 'branch_mismatch' | 'geo_mismatch' | 'recent_assignment' | 'batch_full' | 'uitsluiting';
  message: string;
};

export type LeadGuardrailInput = {
  id: string;
  branch?: string | null;
  lat?: number | null;
  lng?: number | null;
  provincie?: string | null;
  land?: string | null;
  postcode?: string | null;
  naam_klant?: string | null;
  plaatsnaam?: string | null;
};

export type CustomerGuardrailInput = {
  id: string;
  branches?: string[] | null;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Branch guard: lead.branch must be in customer.branches when customer has branches configured. */
export function checkBranchGuardrail(
  lead: LeadGuardrailInput,
  customer: CustomerGuardrailInput,
): ManualAssignmentGuardrailIssue | null {
  const customerBranches = customer.branches || [];
  if (customerBranches.length === 0) return null;
  const leadBranch = lead.branch?.trim();
  if (!leadBranch || !customerBranches.includes(leadBranch)) {
    return {
      code: 'branch_mismatch',
      message: `Lead-branche "${leadBranch || '?'}" hoort niet bij klant (${customerBranches.join(', ')})`,
    };
  }
  return null;
}

/** Geo guard: when customer has active targets, lead must match at least one. */
export function checkGeoGuardrail(
  lead: LeadGuardrailInput,
  targets: GeoTargetRow[],
): ManualAssignmentGuardrailIssue | null {
  if (targets.length === 0) return null;
  const result = matchLeadToTargets(lead, targets);
  if (!result.matches) {
    const hasCoords =
      lead.lat != null &&
      lead.lng != null &&
      !Number.isNaN(Number(lead.lat)) &&
      !Number.isNaN(Number(lead.lng));
    const onlyRadius = targets.every(t => (t.target_type || 'radius') === 'radius');
    if (!hasCoords && onlyRadius) {
      return {
        code: 'geo_mismatch',
        message:
          'Lead heeft geen coördinaten; klant heeft alleen een radius-doelgebied (vul adres aan of negeer guardrails)',
      };
    }
    return {
      code: 'geo_mismatch',
      message: `Lead valt buiten de doelgebieden van de klant${lead.plaatsnaam ? ` (${lead.plaatsnaam})` : ''}`,
    };
  }
  return null;
}

export function checkRecentAssignmentGuardrail(
  assignedAt: string | null | undefined,
): ManualAssignmentGuardrailIssue | null {
  if (!assignedAt) return null;
  const ts = new Date(assignedAt).getTime();
  if (Number.isNaN(ts)) return null;
  if (Date.now() - ts < THIRTY_DAYS_MS) {
    return {
      code: 'recent_assignment',
      message: 'Lead is al binnen 30 dagen aan deze klant toegewezen',
    };
  }
  return null;
}

/**
 * Uitsluitingen tussen klanten (customers.exclude_customers), beide kanten op:
 * per lead de naam van een klant die de lead al heeft en met wie de nieuwe
 * klant niet samen op een lead mag. De verdeling en Restleads hielden hier al
 * rekening mee; handmatig toewijzen, bulk toewijzen en verplaatsen niet.
 * Een fout bij het laden blokkeert niets (handwerk mag niet vastlopen op een
 * storing); de verdeling controleert zelf al.
 */
export async function laadUitsluitingConflicten(
  supabase: SupabaseClient,
  klantId: string,
  leadIds: string[],
  /** Klanten die niet meetellen, zoals de klant van wie de lead wordt weggehaald. */
  negeer: string[] = [],
): Promise<Map<string, string>> {
  const uit = new Map<string, string>();
  if (leadIds.length === 0) return uit;
  const bestaand: { lead_id: string; customer_id: string }[] = [];
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('lead_id, customer_id')
      .in('lead_id', leadIds.slice(i, i + 200))
      .neq('customer_id', klantId)
      .neq('source', 'mirror');
    if (error) return uit;
    bestaand.push(...((data ?? []) as { lead_id: string; customer_id: string }[]).filter(b => !negeer.includes(b.customer_id)));
  }
  if (bestaand.length === 0) return uit;
  const klantIds = [...new Set([klantId, ...bestaand.map(b => b.customer_id)])];
  const { data: klanten, error } = await supabase.from('customers').select('id, name, exclude_customers').in('id', klantIds);
  if (error) return uit;
  const info = new Map((klanten ?? []).map(k => [k.id as string, { naam: (k.name as string) ?? 'een andere klant', uit: Array.isArray(k.exclude_customers) ? (k.exclude_customers as string[]) : [] }]));
  const eigen = info.get(klantId)?.uit ?? [];
  for (const b of bestaand) {
    if (uit.has(b.lead_id)) continue;
    const ander = info.get(b.customer_id);
    if (eigen.includes(b.customer_id) || (ander?.uit ?? []).includes(klantId)) uit.set(b.lead_id, ander?.naam ?? 'een andere klant');
  }
  return uit;
}

export function uitsluitingIssue(andereKlant: string | undefined): ManualAssignmentGuardrailIssue | null {
  if (!andereKlant) return null;
  return { code: 'uitsluiting', message: `Lead staat al bij ${andereKlant}; deze klanten sluiten elkaar uit` };
}

export type PreflightResult = {
  allowed: string[];
  blocked: Array<{ lead_id: string; issues: ManualAssignmentGuardrailIssue[] }>;
};

/**
 * Preflight check for manual bulk assign/export. Returns leads that pass all
 * guardrails vs blocked with reasons.
 */
export async function preflightManualAssignments(
  supabase: SupabaseClient,
  customer: CustomerGuardrailInput,
  leads: LeadGuardrailInput[],
  opts: { skipGeoCheck?: boolean } = {},
): Promise<PreflightResult> {
  const { data: targets } = await supabase
    .from('customer_targets')
    .select('target_type, lat, lng, radius_km, provinces, country, is_active, marge_km')
    .eq('customer_id', customer.id)
    .eq('is_active', true);

  const activeTargets = (targets || []) as GeoTargetRow[];
  const leadIds = leads.map(l => l.id);

  const recentByLead = new Map<string, string>();
  if (leadIds.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    const CHUNK = 500;
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK);
      const { data: existing } = await supabase
        .from('lead_assignments')
        .select('lead_id, assigned_at')
        .eq('customer_id', customer.id)
        .in('lead_id', chunk)
        .gte('assigned_at', thirtyDaysAgo);
      for (const row of existing || []) {
        if (row.lead_id && row.assigned_at) recentByLead.set(row.lead_id, row.assigned_at);
      }
    }
  }

  const conflicten = await laadUitsluitingConflicten(supabase, customer.id, leadIds);

  const allowed: string[] = [];
  const blocked: PreflightResult['blocked'] = [];

  for (const lead of leads) {
    const issues: ManualAssignmentGuardrailIssue[] = [];
    const branchIssue = checkBranchGuardrail(lead, customer);
    if (branchIssue) issues.push(branchIssue);
    if (!opts.skipGeoCheck) {
      const geoIssue = checkGeoGuardrail(lead, activeTargets);
      if (geoIssue) issues.push(geoIssue);
    }
    const recentIssue = checkRecentAssignmentGuardrail(recentByLead.get(lead.id));
    if (recentIssue) issues.push(recentIssue);
    const uitIssue = uitsluitingIssue(conflicten.get(lead.id));
    if (uitIssue) issues.push(uitIssue);

    if (issues.length === 0) allowed.push(lead.id);
    else blocked.push({ lead_id: lead.id, issues });
  }

  return { allowed, blocked };
}
