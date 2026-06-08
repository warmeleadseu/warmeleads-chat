import type { SupabaseClient } from '@supabase/supabase-js';
import { syncBatchDelivered } from './batchSync';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';
import { isInboundLeadBranchSlug } from './nicheResearch';
import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';

type NicheResearchBatch = {
  id: string;
  customer_id: string;
  batch_size: number;
  leads_delivered: number | null;
  starts_at: string | null;
  customers: { id: string; is_active: boolean; portal_active: boolean };
};

export type NicheResearchAssignment = {
  customer_id: string;
  batch_id: string;
};

type NicheResearchTarget = {
  customer_id: string;
  target_type: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
  provinces: string[] | null;
};

type NicheLeadGeoInput = {
  lat?: number | null;
  lng?: number | null;
  provincie?: string | null;
  land?: string | null;
  postcode?: string | null;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Geo-match voor niche-research-batches: dezelfde regels als pipeline-distributie
 * (zie `distribution.ts`). Een lead matcht een klant als er minimaal één actieve
 * `customer_targets`-rij is waarvan:
 *  - province-target → lead.provincie+land valt binnen één van de provincies, OF
 *  - radius-target  → lead.lat/lng binnen `radius_km` van het target-middelpunt.
 *
 * Klanten zonder targets matchen NIET (anders krijgen ze alles, wat het oude
 * symptoom was: Belgische klant ontving NL-leads).
 */
export function nicheLeadMatchesCustomerTargets(
  lead: NicheLeadGeoInput,
  targets: NicheResearchTarget[],
): boolean {
  if (!targets || targets.length === 0) return false;

  for (const t of targets) {
    const kind = t.target_type || 'radius';
    if (kind === 'province') {
      const provs = Array.isArray(t.provinces) ? t.provinces : [];
      if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) {
        return true;
      }
    } else {
      if (
        typeof t.lat === 'number' &&
        typeof t.lng === 'number' &&
        typeof t.radius_km === 'number' &&
        typeof lead.lat === 'number' &&
        typeof lead.lng === 'number'
      ) {
        const dist = haversineKm(lead.lat, lead.lng, t.lat, t.lng);
        if (dist <= t.radius_km) return true;
      }
    }
  }
  return false;
}

/**
 * Wijs inbound leads toe aan actieve onderzoeksbatches op basis van `lead_branch_slug`.
 *
 * Geo-targeting: leads worden alleen toegewezen aan klanten waarvan de actieve
 * `customer_targets` de lead-locatie dekken (provincie-match of binnen radius).
 * Dit zorgt dat bv. een Belgische onderzoeksklant geen NL-leads krijgt. Klanten
 * zonder targets ontvangen niets via deze flow.
 */
export async function tryAssignLeadToNicheResearchBatch(
  supabase: SupabaseClient,
  lead: {
    id: string;
    branch: string;
    phone_valid?: boolean | null;
    bron?: string | null;
    lat?: number | null;
    lng?: number | null;
    provincie?: string | null;
    land?: string | null;
    postcode?: string | null;
  },
): Promise<NicheResearchAssignment | null> {
  if (!isInboundLeadBranchSlug(lead.branch)) return null;
  if (lead.bron === 'demo' || lead.bron === 'excel_import') return null;
  if (lead.phone_valid === false) return null;

  const { data: existing } = await supabase
    .from('lead_assignments')
    .select('customer_id')
    .eq('lead_id', lead.id);
  const assignedCustomerIds = new Set((existing || []).map((r) => r.customer_id));

  const { data: batches } = await supabase
    .from('customer_batches')
    .select(
      'id, customer_id, batch_size, leads_delivered, starts_at, customers!inner(id, is_active, portal_active)',
    )
    .eq('batch_kind', 'niche_research')
    .eq('lead_branch_slug', lead.branch)
    .eq('status', 'active')
    .neq('is_paid', false)
    .eq('customers.is_active', true)
    .order('created_at', { ascending: true });

  const list = (batches || []) as unknown as NicheResearchBatch[];
  if (list.length === 0) return null;

  // Geo-targets ophalen voor alle kandidaat-klanten in één query
  const candidateCustomerIds = Array.from(new Set(list.map((b) => b.customer_id)));
  const { data: targetsData } = await supabase
    .from('customer_targets')
    .select('customer_id, target_type, lat, lng, radius_km, provinces')
    .in('customer_id', candidateCustomerIds)
    .eq('is_active', true);
  const targetsByCustomer = new Map<string, NicheResearchTarget[]>();
  for (const t of (targetsData || []) as NicheResearchTarget[]) {
    const arr = targetsByCustomer.get(t.customer_id) || [];
    arr.push(t);
    targetsByCustomer.set(t.customer_id, arr);
  }

  const now = new Date();

  for (const batch of list) {
    if (assignedCustomerIds.has(batch.customer_id)) continue;
    if (batch.starts_at && new Date(batch.starts_at) > now) continue;

    const custTargets = targetsByCustomer.get(batch.customer_id) || [];
    if (!nicheLeadMatchesCustomerTargets(lead, custTargets)) continue;

    const { data: inserted, error } = await supabase
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: batch.customer_id,
        batch_id: batch.id,
        distance_km: null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') continue;
      console.error('[nicheResearch] assignment insert failed:', error.message);
      continue;
    }

    const { onLeadAssignedToCustomer } = await import('@/lib/integrations/onLeadAssigned');
    onLeadAssignedToCustomer({
      customerId: batch.customer_id,
      leadId: lead.id,
      assignmentId: inserted.id,
    });

    await syncBatchDelivered(supabase, batch.id);

    try {
      const { data: custData } = await supabase
        .from('customers')
        .select('id, name, email, contact_person, email_notifications')
        .eq('id', batch.customer_id)
        .single();
      if (custData) {
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', lead.id).single();
        if (leadData) {
          if (custData.email && custData.email_notifications) {
            sendLeadNotification(custData, leadData);
          }
          sendNewLeadPush(custData.id, leadData).catch(() => {});
        }
      }
    } catch {
      /* notifications optional */
    }

    return { customer_id: batch.customer_id, batch_id: batch.id };
  }

  return null;
}
