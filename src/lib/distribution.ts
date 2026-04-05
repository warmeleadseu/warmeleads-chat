import { createServerClient } from './supabase';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';
import { syncBatchDelivered } from './batchSync';

const MAX_ASSIGNMENTS = 3;
const TARGET_AVG_ASSIGNMENTS = 2;
const MAX_LEAD_AGE_DAYS = 3;
const COOLDOWN_HOURS = 12;

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

  if (filter.operator === 'in' && filter.values && filter.values.length > 0) {
    const lower = raw.toLowerCase();
    return filter.values.some(v => v.toLowerCase() === lower);
  }

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
 * Distribute a single lead to ONE matching customer (max 1 per run).
 * Respects 12h cooldown: if this lead was assigned to anyone in the last 12 hours, skip.
 */
export async function distributeLead(lead: LeadForDistribution): Promise<DistributionResult> {
  const result: DistributionResult = { lead_id: lead.id, assignments: [] };
  if (!lead.lat || !lead.lng) return result;

  const supabase = createServerClient();

  let fullLead = lead;
  if (!lead.custom_fields) {
    const { data: leadRow } = await supabase.from('leads').select('*').eq('id', lead.id).single();
    if (leadRow) fullLead = { ...leadRow, lat: lead.lat, lng: lead.lng };
  }

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('customer_id, assigned_at')
    .eq('lead_id', lead.id);

  const assignedIds = new Set((existingAssignments || []).map(a => a.customer_id));
  if (assignedIds.size >= MAX_ASSIGNMENTS) return result;

  // 12-hour cooldown: skip if assigned to anyone in the last COOLDOWN_HOURS
  if (existingAssignments && existingAssignments.length > 0) {
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
    const recentAssignment = existingAssignments.find(a =>
      new Date(a.assigned_at) > cooldownCutoff
    );
    if (recentAssignment) return result;
  }

  const { data: activeBatches } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, leads_per_week, lead_filters, created_at, customers!inner(id, is_active, portal_active)')
    .eq('branch', lead.branch)
    .eq('status', 'active')
    .eq('customers.is_active', true)
    .order('created_at', { ascending: true });

  if (!activeBatches || activeBatches.length === 0) return result;

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
    // Prefer batches closer to completion (higher fill%) to finish them first
    if (a.fill_pct !== b.fill_pct) return b.fill_pct - a.fill_pct;
    return a.distance_km - b.distance_km;
  });

  // Max 1 assignment per lead per run
  const toAssign = matches.slice(0, 1);

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

    await syncBatchDelivered(supabase, m.batch_id);

    result.assignments.push({
      customer_id: m.customer_id,
      batch_id: m.batch_id,
      distance_km: m.distance_km,
    });

    try {
      const { data: custData } = await supabase.from('customers').select('id, name, email, contact_person, email_notifications').eq('id', m.customer_id).single();
      if (custData) {
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', lead.id).single();
        if (leadData) {
          if (custData.email && custData.email_notifications) {
            sendLeadNotification(custData, leadData);
          }
          sendNewLeadPush(custData.id, leadData).catch(() => {});
        }
      }
    } catch { /* notification failure should not block distribution */ }
  }

  return result;
}

/**
 * Distribute multiple leads (max 1 assignment per lead per run).
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
 * Smart distribution with average-tracking:
 * 1. First pass: assign leads that have 0 assignments (new leads get priority)
 * 2. Second pass: if average assignments per lead < TARGET_AVG, re-assign eligible leads
 *    that already have 1+ assignment but are past their 12h cooldown
 *
 * This ensures new leads always get served first, and re-assignments happen
 * only when needed to maintain the target average of ~2 assignments per lead.
 */
export async function distributeUnassignedLeads(): Promise<{ distributed: number; assignments: number; avgAssignments: number }> {
  const supabase = createServerClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_LEAD_AGE_DAYS);

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .neq('bron', 'excel_import')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  if (!leads || leads.length === 0) return { distributed: 0, assignments: 0, avgAssignments: 0 };

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('lead_id, assigned_at');

  const assignmentCounts: Record<string, number> = {};
  const lastAssignedAt: Record<string, Date> = {};
  (existingAssignments || []).forEach(a => {
    assignmentCounts[a.lead_id] = (assignmentCounts[a.lead_id] || 0) + 1;
    const d = new Date(a.assigned_at);
    if (!lastAssignedAt[a.lead_id] || d > lastAssignedAt[a.lead_id]) {
      lastAssignedAt[a.lead_id] = d;
    }
  });

  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

  // Pass 1: leads with 0 assignments (new leads, always distribute)
  const newLeads = leads.filter(l => (assignmentCounts[l.id] || 0) === 0);

  let totalDistributed = 0;
  let totalAssignments = 0;

  if (newLeads.length > 0) {
    const r = await distributeLeads(newLeads as LeadForDistribution[]);
    totalDistributed += r.distributed;
    totalAssignments += r.assignments;
  }

  // Recalculate average after pass 1
  const totalExistingAssignments = Object.values(assignmentCounts).reduce((s, c) => s + c, 0) + totalAssignments;
  const totalLeadsWithAssignments = new Set([
    ...Object.keys(assignmentCounts),
    ...newLeads.filter(l => assignmentCounts[l.id] !== undefined || totalAssignments > 0).map(l => l.id),
  ]);

  // Count unique leads that have at least 1 assignment
  let leadsWithAssignments = 0;
  let sumAssignments = 0;
  const updatedCounts = { ...assignmentCounts };
  // Account for assignments just made in pass 1
  for (const l of newLeads) {
    if (!updatedCounts[l.id]) updatedCounts[l.id] = 0;
  }

  for (const [, count] of Object.entries(updatedCounts)) {
    if (count > 0) {
      leadsWithAssignments++;
      sumAssignments += count;
    }
  }
  sumAssignments += totalAssignments;
  leadsWithAssignments += newLeads.filter(l => !assignmentCounts[l.id] && totalAssignments > 0).length;

  const currentAvg = leadsWithAssignments > 0 ? sumAssignments / leadsWithAssignments : 0;

  // Pass 2: re-assign leads to boost average toward TARGET_AVG
  // Only if current average is below target
  if (currentAvg < TARGET_AVG_ASSIGNMENTS) {
    const reAssignCandidates = leads.filter(l => {
      const count = assignmentCounts[l.id] || 0;
      if (count === 0 || count >= MAX_ASSIGNMENTS) return false;
      const last = lastAssignedAt[l.id];
      if (last && last > cooldownCutoff) return false;
      return true;
    });

    // Sort: leads with fewer assignments first (prioritize getting everyone to 2)
    reAssignCandidates.sort((a, b) => (assignmentCounts[a.id] || 0) - (assignmentCounts[b.id] || 0));

    if (reAssignCandidates.length > 0) {
      const r = await distributeLeads(reAssignCandidates as LeadForDistribution[]);
      totalDistributed += r.distributed;
      totalAssignments += r.assignments;
    }
  }

  // Final average calculation
  const finalTotalAssignments = (existingAssignments || []).length + totalAssignments;
  const finalUniqueLeads = new Set([
    ...Object.keys(assignmentCounts),
    ...leads.filter(l => !assignmentCounts[l.id]).map(l => l.id),
  ].filter(id => (assignmentCounts[id] || 0) > 0 || totalAssignments > 0));

  const avgAssignments = finalUniqueLeads.size > 0
    ? Math.round((finalTotalAssignments / finalUniqueLeads.size) * 100) / 100
    : 0;

  return { distributed: totalDistributed, assignments: totalAssignments, avgAssignments };
}
