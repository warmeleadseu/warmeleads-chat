import { createServerClient } from './supabase';
import { sendLeadNotification } from './email';

const MAX_ASSIGNMENTS = 3;
const MAX_LEAD_AGE_DAYS = 3;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface LeadForDistribution {
  id: string;
  branch: string;
  lat: number;
  lng: number;
  custom_fields?: Record<string, string>;
  quality_score?: number | null;
  phone_valid?: boolean | null;
  budget?: string | null;
  zonnepanelen?: string | null;
  dynamisch_contract?: string | null;
  stroomverbruik?: string | null;
  [key: string]: unknown;
}

interface LeadFilter {
  field: string;
  operator: string;
  value: string;
  values?: string[];
}

function getLeadFieldValue(lead: LeadForDistribution, fieldKey: string): string | null {
  if (fieldKey === 'quality_score') return lead.quality_score != null ? String(lead.quality_score) : null;
  if (fieldKey === 'phone_valid') return lead.phone_valid != null ? String(lead.phone_valid) : null;

  const directVal = lead[fieldKey];
  if (directVal != null && directVal !== '') return String(directVal);

  if (lead.custom_fields && lead.custom_fields[fieldKey] != null && lead.custom_fields[fieldKey] !== '') {
    return String(lead.custom_fields[fieldKey]);
  }

  return null;
}

function matchesFilter(lead: LeadForDistribution, filter: LeadFilter): boolean {
  const raw = getLeadFieldValue(lead, filter.field);
  if (raw === null) return false;

  // Multi-select: lead value must be one of the selected values (case-insensitive)
  if (filter.operator === 'in' && filter.values && filter.values.length > 0) {
    const lower = raw.toLowerCase();
    return filter.values.some(v => v.toLowerCase() === lower);
  }

  // Legacy single-value operators
  const numA = parseFloat(raw.replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  const numB = parseFloat((filter.value || '').replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  const bothNumeric = !isNaN(numA) && !isNaN(numB);

  switch (filter.operator) {
    case 'eq': return raw.toLowerCase() === (filter.value || '').toLowerCase();
    case 'neq': return raw.toLowerCase() !== (filter.value || '').toLowerCase();
    case 'gt': return bothNumeric ? numA > numB : raw > (filter.value || '');
    case 'gte': return bothNumeric ? numA >= numB : raw >= (filter.value || '');
    case 'lt': return bothNumeric ? numA < numB : raw < (filter.value || '');
    case 'lte': return bothNumeric ? numA <= numB : raw <= (filter.value || '');
    case 'contains': return raw.toLowerCase().includes((filter.value || '').toLowerCase());
    case 'not_contains': return !raw.toLowerCase().includes((filter.value || '').toLowerCase());
    default: return true;
  }
}

function matchesAllFilters(lead: LeadForDistribution, filters: LeadFilter[]): boolean {
  if (!filters || filters.length === 0) return true;
  return filters.every(f => matchesFilter(lead, f));
}

interface DistributionResult {
  lead_id: string;
  assignments: { customer_id: string; batch_id: string; distance_km: number }[];
}

/**
 * Distribute a single lead to matching customers based on geo-targets and active batches.
 */
export async function distributeLead(lead: LeadForDistribution): Promise<DistributionResult> {
  const result: DistributionResult = { lead_id: lead.id, assignments: [] };
  if (!lead.lat || !lead.lng) return result;

  const supabase = createServerClient();

  // Load full lead data for filter matching (if not already enriched)
  let fullLead = lead;
  if (!lead.custom_fields) {
    const { data: leadRow } = await supabase.from('leads').select('*').eq('id', lead.id).single();
    if (leadRow) fullLead = { ...leadRow, lat: lead.lat, lng: lead.lng };
  }

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('customer_id')
    .eq('lead_id', lead.id);

  const assignedIds = new Set((existingAssignments || []).map(a => a.customer_id));
  if (assignedIds.size >= MAX_ASSIGNMENTS) return result;

  const { data: activeBatches } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, leads_per_week, lead_filters, customers!inner(id, is_active, portal_active)')
    .eq('branch', lead.branch)
    .eq('status', 'active')
    .eq('customers.is_active', true);

  if (!activeBatches || activeBatches.length === 0) return result;

  // Check weekly limits: count assignments per batch this week
  const batchesWithWeeklyLimit = activeBatches.filter(b => b.leads_per_week && b.leads_per_week > 0);
  const weeklyCountByBatch: Record<string, number> = {};

  if (batchesWithWeeklyLimit.length > 0) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const batchIds = batchesWithWeeklyLimit.map(b => b.id);
    const { data: weekAssignments } = await supabase
      .from('lead_assignments')
      .select('batch_id')
      .in('batch_id', batchIds)
      .gte('assigned_at', weekStart.toISOString());

    for (const a of weekAssignments || []) {
      if (a.batch_id) weeklyCountByBatch[a.batch_id] = (weeklyCountByBatch[a.batch_id] || 0) + 1;
    }
  }

  const customerIds = [...new Set(activeBatches.map(b => b.customer_id))];

  const { data: targets } = await supabase
    .from('customer_targets')
    .select('*')
    .in('customer_id', customerIds)
    .eq('is_active', true);

  if (!targets || targets.length === 0) return result;

  const targetsByCustomer: Record<string, typeof targets> = {};
  for (const t of targets) {
    if (!targetsByCustomer[t.customer_id]) targetsByCustomer[t.customer_id] = [];
    targetsByCustomer[t.customer_id].push(t);
  }

  interface Match {
    customer_id: string;
    batch_id: string;
    min_radius: number;
    distance_km: number;
    fill_pct: number;
  }

  const matches: Match[] = [];

  for (const batch of activeBatches) {
    if (batch.leads_delivered >= batch.batch_size) continue;
    if (assignedIds.has(batch.customer_id)) continue;

    // Skip if weekly limit reached
    if (batch.leads_per_week && batch.leads_per_week > 0) {
      const thisWeekCount = weeklyCountByBatch[batch.id] || 0;
      if (thisWeekCount >= batch.leads_per_week) continue;
    }

    const custTargets = targetsByCustomer[batch.customer_id];
    if (!custTargets) continue;

    let bestMatch: { radius: number; distance: number } | null = null;

    for (const t of custTargets) {
      const dist = haversineKm(lead.lat, lead.lng, t.lat, t.lng);
      if (dist <= t.radius_km) {
        if (!bestMatch || t.radius_km < bestMatch.radius) {
          bestMatch = { radius: t.radius_km, distance: dist };
        }
      }
    }

    if (bestMatch) {
      const filters: LeadFilter[] = Array.isArray(batch.lead_filters) ? batch.lead_filters : [];
      if (!matchesAllFilters(fullLead, filters)) continue;

      const existing = matches.find(m => m.customer_id === batch.customer_id);
      if (!existing) {
        matches.push({
          customer_id: batch.customer_id,
          batch_id: batch.id,
          min_radius: bestMatch.radius,
          distance_km: Math.round(bestMatch.distance * 10) / 10,
          fill_pct: batch.leads_delivered / batch.batch_size,
        });
      }
    }
  }

  matches.sort((a, b) => {
    if (a.min_radius !== b.min_radius) return a.min_radius - b.min_radius;
    if (a.fill_pct !== b.fill_pct) return a.fill_pct - b.fill_pct;
    return a.distance_km - b.distance_km;
  });

  const slotsAvailable = MAX_ASSIGNMENTS - assignedIds.size;
  const toAssign = matches.slice(0, slotsAvailable);

  for (const m of toAssign) {
    const { error } = await supabase
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: m.customer_id,
        batch_id: m.batch_id,
        distance_km: m.distance_km,
      });

    if (error) continue;

    const { data: updatedBatch } = await supabase
      .from('customer_batches')
      .update({ leads_delivered: (await supabase.from('customer_batches').select('leads_delivered').eq('id', m.batch_id).single()).data?.leads_delivered + 1 || 1 })
      .eq('id', m.batch_id)
      .select('leads_delivered, batch_size')
      .single();

    if (updatedBatch && updatedBatch.leads_delivered >= updatedBatch.batch_size) {
      await supabase
        .from('customer_batches')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', m.batch_id);
    }

    result.assignments.push({
      customer_id: m.customer_id,
      batch_id: m.batch_id,
      distance_km: m.distance_km,
    });

    try {
      const { data: custData } = await supabase.from('customers').select('id, name, email, contact_person, email_notifications').eq('id', m.customer_id).single();
      if (custData?.email && custData.email_notifications) {
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', lead.id).single();
        if (leadData) sendLeadNotification(custData, leadData);
      }
    } catch { /* email failure should not block distribution */ }
  }

  return result;
}

/**
 * Distribute multiple leads.
 */
export async function distributeLeads(leads: LeadForDistribution[]): Promise<{ distributed: number; assignments: number }> {
  let distributed = 0;
  let assignments = 0;

  for (const lead of leads) {
    const result = await distributeLead(lead);
    if (result.assignments.length > 0) {
      distributed++;
      assignments += result.assignments.length;
    }
  }

  return { distributed, assignments };
}

/**
 * Find and distribute leads ≤ MAX_LEAD_AGE_DAYS old that have coordinates
 * but are not yet fully assigned (< MAX_ASSIGNMENTS).
 */
export async function distributeUnassignedLeads(): Promise<{ distributed: number; assignments: number }> {
  const supabase = createServerClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_LEAD_AGE_DAYS);

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  if (!leads || leads.length === 0) return { distributed: 0, assignments: 0 };

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('lead_id');

  const assignedLeadCounts: Record<string, number> = {};
  (existingAssignments || []).forEach(a => {
    assignedLeadCounts[a.lead_id] = (assignedLeadCounts[a.lead_id] || 0) + 1;
  });

  const candidates = leads.filter(l =>
    (assignedLeadCounts[l.id] || 0) < MAX_ASSIGNMENTS
  );

  return distributeLeads(candidates as LeadForDistribution[]);
}
