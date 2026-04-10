import { createServerClient } from './supabase';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';
import { syncBatchDelivered } from './batchSync';

const MAX_ASSIGNMENTS = 3;
const TARGET_AVG_ASSIGNMENTS = 2;
const MAX_LEAD_AGE_DAYS = 3;
const COOLDOWN_HOURS = 12;
const FAIRNESS_WINDOW_HOURS = 24;

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

  // Never distribute leads with invalid phone numbers
  if (fullLead.phone_valid === false) return result;

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
    .select('id, customer_id, branch, batch_size, leads_delivered, leads_delivered_external, leads_per_week, leads_per_day, lead_filters, created_at, is_paid, starts_at, customers!inner(id, is_active, portal_active)')
    .eq('branch', lead.branch)
    .eq('status', 'active')
    .eq('customers.is_active', true)
    .neq('is_paid', false)
    .order('created_at', { ascending: true });

  if (!activeBatches || activeBatches.length === 0) return result;

  const batchesWithWeeklyLimit = activeBatches.filter(b => b.leads_per_week && b.leads_per_week > 0);
  const batchesWithDailyLimit = activeBatches.filter(b => b.leads_per_day && b.leads_per_day > 0);
  const weeklyCountByBatch: Record<string, number> = {};
  const dailyCountByBatch: Record<string, number> = {};

  if (batchesWithWeeklyLimit.length > 0 || batchesWithDailyLimit.length > 0) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const allLimitBatchIds = [...new Set([
      ...batchesWithWeeklyLimit.map(b => b.id),
      ...batchesWithDailyLimit.map(b => b.id),
    ])];

    const { data: periodAssignments } = await supabase
      .from('lead_assignments')
      .select('batch_id, assigned_at')
      .in('batch_id', allLimitBatchIds)
      .gte('assigned_at', weekStart.toISOString());

    for (const a of periodAssignments || []) {
      if (a.batch_id) {
        weeklyCountByBatch[a.batch_id] = (weeklyCountByBatch[a.batch_id] || 0) + 1;
        if (new Date(a.assigned_at) >= dayStart) {
          dailyCountByBatch[a.batch_id] = (dailyCountByBatch[a.batch_id] || 0) + 1;
        }
      }
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

  // Load exclusion lists for bidirectional lead-exclusion between customers
  const allRelevantIds = [...new Set([...customerIds, ...assignedIds])];
  const { data: exclusionData } = await supabase
    .from('customers')
    .select('id, exclude_customers')
    .in('id', allRelevantIds);

  const excludeMap: Record<string, string[]> = {};
  for (const c of exclusionData || []) {
    excludeMap[c.id] = Array.isArray(c.exclude_customers) ? c.exclude_customers : [];
  }

  interface Match {
    customer_id: string;
    batch_id: string;
    min_radius: number;
    distance_km: number;
    recent_24h: number;
  }

  const matches: Match[] = [];

  const now = new Date();
  for (const batch of activeBatches) {
    if (batch.leads_delivered >= batch.batch_size) continue;
    if (assignedIds.has(batch.customer_id)) continue;
    if (batch.starts_at && new Date(batch.starts_at) > now) continue;

    // Bidirectional exclusion: skip if this lead is already assigned to an excluded customer
    const candidateExcludes = excludeMap[batch.customer_id] || [];
    let excluded = false;
    for (const assignedCustId of assignedIds) {
      if (candidateExcludes.includes(assignedCustId)) { excluded = true; break; }
      const assignedExcludes = excludeMap[assignedCustId] || [];
      if (assignedExcludes.includes(batch.customer_id)) { excluded = true; break; }
    }
    if (excluded) continue;

    if (batch.leads_per_week && batch.leads_per_week > 0) {
      const thisWeekCount = weeklyCountByBatch[batch.id] || 0;
      if (thisWeekCount >= batch.leads_per_week) continue;
    }

    if (batch.leads_per_day && batch.leads_per_day > 0) {
      const todayCount = dailyCountByBatch[batch.id] || 0;
      if (todayCount >= batch.leads_per_day) continue;
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
          recent_24h: 0,
        });
      }
    }
  }

  // Fetch recent assignment counts per batch for fairness sorting
  if (matches.length > 1) {
    const fairnessCutoff = new Date(Date.now() - FAIRNESS_WINDOW_HOURS * 60 * 60 * 1000);
    const matchBatchIds = matches.map(m => m.batch_id);

    const { data: recentAssignments } = await supabase
      .from('lead_assignments')
      .select('batch_id')
      .in('batch_id', matchBatchIds)
      .gte('assigned_at', fairnessCutoff.toISOString());

    const recentByBatch: Record<string, number> = {};
    for (const a of recentAssignments || []) {
      if (a.batch_id) recentByBatch[a.batch_id] = (recentByBatch[a.batch_id] || 0) + 1;
    }
    for (const m of matches) {
      m.recent_24h = recentByBatch[m.batch_id] || 0;
    }
  }

  matches.sort((a, b) => {
    // 1. Smallest target radius wins (specific area > broad area)
    if (a.min_radius !== b.min_radius) return a.min_radius - b.min_radius;
    // 2. Fewest recent assignments wins (fairness round-robin)
    if (a.recent_24h !== b.recent_24h) return a.recent_24h - b.recent_24h;
    // 3. Shortest distance as tiebreaker
    return a.distance_km - b.distance_km;
  });

  // Max 1 assignment per lead per run
  const toAssign = matches.slice(0, 1);

  for (const m of toAssign) {
    // Fresh count to prevent race condition overdelivery (include external offset)
    const { count: currentCount } = await supabase
      .from('lead_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', m.batch_id);
    const batchForCheck = activeBatches.find(b => b.id === m.batch_id);
    const externalOffset = (batchForCheck as any)?.leads_delivered_external || 0;
    if (batchForCheck && (currentCount || 0) + externalOffset >= batchForCheck.batch_size) continue;

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
 * Targeted backfill for a single newly created batch.
 * Only assigns leads from the last `lookbackDays` to this specific batch.
 * If lookbackDays is 0, no backfill is performed (only future leads via cron).
 */
export async function backfillBatch(batchId: string, lookbackDays: number): Promise<{ assigned: number }> {
  if (lookbackDays <= 0) return { assigned: 0 };

  const supabase = createServerClient();

  const { data: batch } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, leads_delivered_external, leads_per_week, leads_per_day, lead_filters, is_paid, starts_at, customers!inner(id, is_active)')
    .eq('id', batchId)
    .eq('status', 'active')
    .single();

  if (!batch || batch.leads_delivered >= batch.batch_size) return { assigned: 0 };
  if (batch.is_paid === false) return { assigned: 0 };
  if (batch.starts_at && new Date(batch.starts_at) > new Date()) return { assigned: 0 };

  const { data: targets } = await supabase
    .from('customer_targets')
    .select('*')
    .eq('customer_id', batch.customer_id)
    .eq('is_active', true);

  if (!targets || targets.length === 0) return { assigned: 0 };

  // Load exclusion list for this customer (bidirectional)
  const { data: custRow } = await supabase
    .from('customers')
    .select('exclude_customers')
    .eq('id', batch.customer_id)
    .single();
  const myExcludes: string[] = Array.isArray(custRow?.exclude_customers) ? custRow.exclude_customers : [];

  // Find customers that exclude *us* (reverse direction)
  const { data: reverseRows } = await supabase
    .from('customers')
    .select('id')
    .neq('id', batch.customer_id)
    .contains('exclude_customers', [batch.customer_id]);
  const reverseIds = (reverseRows || []).map(r => r.id);

  const allExcluded = new Set([...myExcludes, ...reverseIds]);

  // Build set of lead IDs assigned to any excluded customer
  const excludedLeadIds = new Set<string>();
  if (allExcluded.size > 0) {
    const { data: exAssign } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .in('customer_id', [...allExcluded]);
    for (const a of exAssign || []) excludedLeadIds.add(a.lead_id);
  }

  const refDate = batch.starts_at ? new Date(batch.starts_at) : new Date();
  const cutoff = new Date(refDate);
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('branch', batch.branch)
    .neq('bron', 'excel_import')
    .neq('phone_valid', false)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  if (!leads || leads.length === 0) return { assigned: 0 };

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('lead_id')
    .eq('customer_id', batch.customer_id);

  const alreadyAssigned = new Set((existingAssignments || []).map(a => a.lead_id));

  const filters: LeadFilter[] = Array.isArray(batch.lead_filters) ? batch.lead_filters : [];
  let assigned = 0;

  const backfillExternal = (batch as any).leads_delivered_external || 0;

  for (const lead of leads) {
    // Fresh count each iteration to prevent overdelivery (include external offset)
    const { count: currentCount } = await supabase
      .from('lead_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batch.id);
    if ((currentCount || 0) + backfillExternal >= batch.batch_size) break;

    if (alreadyAssigned.has(lead.id)) continue;
    if (excludedLeadIds.has(lead.id)) continue;
    if (!matchesAllFilters(lead as LeadForDistribution, filters)) continue;

    let inRange = false;
    let bestDist = Infinity;
    for (const t of targets) {
      const dist = haversineKm(lead.lat, lead.lng, t.lat, t.lng);
      if (dist <= t.radius_km) { inRange = true; bestDist = Math.min(bestDist, dist); }
    }
    if (!inRange) continue;

    const { error } = await supabase
      .from('lead_assignments')
      .insert({ lead_id: lead.id, customer_id: batch.customer_id, batch_id: batch.id, distance_km: Math.round(bestDist * 10) / 10 });

    if (!error) {
      assigned++;
      alreadyAssigned.add(lead.id);

      try {
        const { data: custData } = await supabase.from('customers').select('id, name, email, contact_person, email_notifications').eq('id', batch.customer_id).single();
        if (custData) {
          if (custData.email && custData.email_notifications) sendLeadNotification(custData, lead);
          sendNewLeadPush(custData.id, lead).catch(() => {});
        }
      } catch { /* notification failure should not block */ }
    }
  }

  if (assigned > 0) {
    await syncBatchDelivered(supabase, batch.id);
  }

  return { assigned };
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
    .neq('phone_valid', false)
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
