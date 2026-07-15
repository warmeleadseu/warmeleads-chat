import type { SupabaseClient } from '@supabase/supabase-js';
import { syncBatchDelivered } from './batchSync';
import { onLeadAssignedToCustomer } from './integrations/onLeadAssigned';
import { matchLeadToTargets } from './matchLeadToTargets';
import {
  checkBranchGuardrail,
  checkRecentAssignmentGuardrail,
  type LeadGuardrailInput,
  type CustomerGuardrailInput,
} from './manualAssignmentGuardrails';
import type { GeoTargetRow } from './batchTargets';

export type AssignmentSource = 'distribution' | 'bulk_export' | 'bulk_assign' | 'demo';

export type AssignLeadToBatchInput = {
  supabase: SupabaseClient;
  lead: LeadGuardrailInput;
  customer: CustomerGuardrailInput;
  batchId?: string | null;
  source: AssignmentSource;
  /** Skip branch/geo guardrails (distribution cron only). */
  skipGuardrails?: boolean;
  distance_km?: number | null;
};

export type AssignLeadToBatchResult =
  | { ok: true; assignmentId: string; distance_km: number | null }
  | { ok: false; reason: string; code: string };

/**
 * Unified orchestration for inserting a lead_assignment row.
 * Used by distribution, bulk-export, and bulk-assign paths.
 */
export async function assignLeadToBatch(
  input: AssignLeadToBatchInput,
): Promise<AssignLeadToBatchResult> {
  const { supabase, lead, customer, batchId, source, skipGuardrails } = input;

  if (!skipGuardrails) {
    const branchIssue = checkBranchGuardrail(lead, customer);
    if (branchIssue) return { ok: false, reason: branchIssue.message, code: branchIssue.code };

    const { data: targets } = await supabase
      .from('customer_targets')
      .select('target_type, lat, lng, radius_km, provinces, country, is_active')
      .eq('customer_id', customer.id)
      .eq('is_active', true);

    const activeTargets = (targets || []) as GeoTargetRow[];
    if (activeTargets.length > 0) {
      const geo = matchLeadToTargets(lead, activeTargets);
      if (!geo.matches) {
        return {
          ok: false,
          reason: 'Lead valt buiten de doelgebieden van de klant',
          code: 'geo_mismatch',
        };
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('lead_assignments')
      .select('assigned_at')
      .eq('customer_id', customer.id)
      .eq('lead_id', lead.id)
      .gte('assigned_at', thirtyDaysAgo)
      .limit(1)
      .maybeSingle();

    const recentIssue = checkRecentAssignmentGuardrail(recent?.assigned_at);
    if (recentIssue) return { ok: false, reason: recentIssue.message, code: recentIssue.code };
  }

  let distance_km = input.distance_km ?? null;
  if (distance_km == null && !skipGuardrails) {
    const { data: targets } = await supabase
      .from('customer_targets')
      .select('target_type, lat, lng, radius_km, provinces, country, is_active')
      .eq('customer_id', customer.id)
      .eq('is_active', true);
    const geo = matchLeadToTargets(lead, (targets || []) as GeoTargetRow[]);
    distance_km = geo.distance_km;
  }

  const { data: inserted, error } = await supabase
    .from('lead_assignments')
    .insert({
      lead_id: lead.id,
      customer_id: customer.id,
      batch_id: batchId || null,
      source,
      distance_km,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return { ok: false, reason: error?.message || 'Insert mislukt', code: 'insert_failed' };
  }

  onLeadAssignedToCustomer({
    customerId: customer.id,
    leadId: lead.id,
    assignmentId: inserted.id,
  });

  if (batchId) {
    try {
      await syncBatchDelivered(supabase, batchId);
    } catch (syncErr) {
      console.error('[assignLeadToBatch] syncBatchDelivered failed', { batchId, syncErr });
    }
  }

  return { ok: true, assignmentId: inserted.id, distance_km };
}
