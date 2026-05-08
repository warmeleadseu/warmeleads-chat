import { createServerClient } from './supabase';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';
import { syncBatchDelivered } from './batchSync';
import { isPipelineBatchKind } from './batchKind';

const MAX_ASSIGNMENTS = 3;
const TARGET_AVG_ASSIGNMENTS = 2;
const MAX_LEAD_AGE_DAYS = 3;
const COOLDOWN_HOURS = 12;
const FAIRNESS_WINDOW_HOURS = 24;
const REASSIGNMENT_COOLDOWN_DAYS = 30;

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
  bron?: string | null;
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
  const hasCoords = !!(lead.lat && lead.lng);
  const hasProv = !!(lead as any).provincie;
  if (!hasCoords && !hasProv) return result;

  // Never distribute demo leads to real customers (early check before DB fetch)
  if (lead.bron === 'demo') return result;

  const supabase = createServerClient();

  let fullLead = lead;
  if (!lead.custom_fields) {
    const { data: leadRow } = await supabase.from('leads').select('*').eq('id', lead.id).single();
    if (leadRow) fullLead = { ...leadRow, lat: lead.lat, lng: lead.lng };
  }

  // Double-check after DB fetch in case bron wasn't passed by caller
  if (fullLead.bron === 'demo') return result;

  if (fullLead.phone_valid === false) return result;

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('customer_id, assigned_at')
    .eq('lead_id', lead.id);

  const reassignmentCutoff = new Date(Date.now() - REASSIGNMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const recentAssignments = (existingAssignments || []).filter(a => new Date(a.assigned_at) >= reassignmentCutoff);
  const recentAssignedIds = new Set(recentAssignments.map(a => a.customer_id));
  if (recentAssignedIds.size >= MAX_ASSIGNMENTS) return result;

  // 12-hour cooldown: skip if assigned to anyone in the last COOLDOWN_HOURS
  if (existingAssignments && existingAssignments.length > 0) {
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
    const cooldownHit = existingAssignments.find(a =>
      new Date(a.assigned_at) > cooldownCutoff
    );
    if (cooldownHit) return result;
  }

  const { data: activeBatches } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, leads_delivered_external, leads_per_week, leads_per_day, lead_filters, created_at, is_paid, starts_at, customers!inner(id, is_active, portal_active)')
    .eq('branch', lead.branch)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
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
  const allRelevantIds = [...new Set([...customerIds, ...recentAssignedIds])];
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
    if (recentAssignedIds.has(batch.customer_id)) continue;
    if (batch.starts_at && new Date(batch.starts_at) > now) continue;

    // Bidirectional exclusion: skip if this lead is already assigned to an excluded customer
    const candidateExcludes = excludeMap[batch.customer_id] || [];
    let excluded = false;
    for (const assignedCustId of recentAssignedIds) {
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
    const leadProv = (fullLead as any).provincie as string | undefined;

    for (const t of custTargets) {
      if ((t.target_type || 'radius') === 'province') {
        const provs: string[] = Array.isArray(t.provinces) ? t.provinces : [];
        if (leadProv && provs.includes(leadProv)) {
          if (!bestMatch || 999 < bestMatch.radius) {
            bestMatch = { radius: 999, distance: 0 };
          }
        }
      } else if (hasCoords) {
        const dist = haversineKm(lead.lat, lead.lng, t.lat, t.lng);
        if (dist <= t.radius_km) {
          if (!bestMatch || t.radius_km < bestMatch.radius) {
            bestMatch = { radius: t.radius_km, distance: dist };
          }
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

    // Auto-assign to portal user based on assignment rules
    assignToPortalUser(supabase, m.customer_id, fullLead).catch(() => {});

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
    .select('id, customer_id, branch, batch_size, leads_delivered, leads_delivered_external, leads_per_week, leads_per_day, lead_filters, is_paid, starts_at, batch_kind, customers!inner(id, is_active)')
    .eq('id', batchId)
    .eq('status', 'active')
    .single();

  if (!batch || !isPipelineBatchKind((batch as { batch_kind?: string }).batch_kind)) {
    return { assigned: 0 };
  }
  if (batch.leads_delivered >= batch.batch_size) return { assigned: 0 };
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

  const hasProvinceTargets = targets.some(t => (t.target_type || 'radius') === 'province');

  let leadsQuery = supabase
    .from('leads')
    .select('*')
    .eq('branch', batch.branch)
    .neq('bron', 'excel_import')
    .neq('bron', 'demo')
    .neq('phone_valid', false)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  if (!hasProvinceTargets) {
    leadsQuery = leadsQuery.not('lat', 'is', null).not('lng', 'is', null);
  }

  const { data: leads } = await leadsQuery;

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
      if ((t.target_type || 'radius') === 'province') {
        const provs: string[] = Array.isArray(t.provinces) ? t.provinces : [];
        if (lead.provincie && provs.includes(lead.provincie)) {
          inRange = true;
          bestDist = Math.min(bestDist, 0);
        }
      } else if (lead.lat && lead.lng) {
        const dist = haversineKm(lead.lat, lead.lng, t.lat, t.lng);
        if (dist <= t.radius_km) { inRange = true; bestDist = Math.min(bestDist, dist); }
      }
    }
    if (!inRange) continue;

    const { error } = await supabase
      .from('lead_assignments')
      .insert({ lead_id: lead.id, customer_id: batch.customer_id, batch_id: batch.id, distance_km: Math.round(bestDist * 10) / 10 });

    if (!error) {
      assigned++;
      alreadyAssigned.add(lead.id);

      // Auto-assign to portal user if rules match
      assignToPortalUser(supabase, batch.customer_id, lead).catch(() => {});

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
    .neq('bron', 'demo')
    .neq('phone_valid', false)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false });

  if (!leads || leads.length === 0) return { distributed: 0, assignments: 0, avgAssignments: 0 };

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('lead_id, assigned_at');

  const reassignWindowCutoff = new Date(Date.now() - REASSIGNMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const recentAssignmentCounts: Record<string, number> = {};
  const allAssignmentCounts: Record<string, number> = {};
  const lastAssignedAt: Record<string, Date> = {};
  (existingAssignments || []).forEach(a => {
    allAssignmentCounts[a.lead_id] = (allAssignmentCounts[a.lead_id] || 0) + 1;
    const d = new Date(a.assigned_at);
    if (d >= reassignWindowCutoff) {
      recentAssignmentCounts[a.lead_id] = (recentAssignmentCounts[a.lead_id] || 0) + 1;
    }
    if (!lastAssignedAt[a.lead_id] || d > lastAssignedAt[a.lead_id]) {
      lastAssignedAt[a.lead_id] = d;
    }
  });

  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);

  // Pass 1: leads with 0 recent assignments (new or eligible for re-assignment)
  const newLeads = leads.filter(l => (recentAssignmentCounts[l.id] || 0) === 0);

  let totalDistributed = 0;
  let totalAssignments = 0;

  if (newLeads.length > 0) {
    const r = await distributeLeads(newLeads as LeadForDistribution[]);
    totalDistributed += r.distributed;
    totalAssignments += r.assignments;
  }

  // Recalculate average after pass 1
  let leadsWithAssignments = 0;
  let sumAssignments = 0;
  const updatedCounts = { ...recentAssignmentCounts };
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
  leadsWithAssignments += newLeads.filter(l => !recentAssignmentCounts[l.id] && totalAssignments > 0).length;

  const currentAvg = leadsWithAssignments > 0 ? sumAssignments / leadsWithAssignments : 0;

  // Pass 2: re-assign leads to boost average toward TARGET_AVG
  if (currentAvg < TARGET_AVG_ASSIGNMENTS) {
    const reAssignCandidates = leads.filter(l => {
      const count = recentAssignmentCounts[l.id] || 0;
      if (count === 0 || count >= MAX_ASSIGNMENTS) return false;
      const last = lastAssignedAt[l.id];
      if (last && last > cooldownCutoff) return false;
      return true;
    });

    reAssignCandidates.sort((a, b) => (recentAssignmentCounts[a.id] || 0) - (recentAssignmentCounts[b.id] || 0));

    if (reAssignCandidates.length > 0) {
      const r = await distributeLeads(reAssignCandidates as LeadForDistribution[]);
      totalDistributed += r.distributed;
      totalAssignments += r.assignments;
    }
  }

  // Final average calculation
  const finalTotalAssignments = (existingAssignments || []).length + totalAssignments;
  const finalUniqueLeads = new Set([
    ...Object.keys(recentAssignmentCounts),
    ...leads.filter(l => !recentAssignmentCounts[l.id]).map(l => l.id),
  ].filter(id => (recentAssignmentCounts[id] || 0) > 0 || totalAssignments > 0));

  const avgAssignments = finalUniqueLeads.size > 0
    ? Math.round((finalTotalAssignments / finalUniqueLeads.size) * 100) / 100
    : 0;

  return { distributed: totalDistributed, assignments: totalAssignments, avgAssignments };
}

/**
 * Auto-assign a lead to a portal user within a customer account based on assignment rules.
 * Uses weighted round-robin among eligible agents.
 */
async function assignToPortalUser(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  lead: LeadForDistribution,
): Promise<void> {
  const { data: agents } = await supabase
    .from('portal_users')
    .select('id, assignment_rules, role')
    .eq('customer_id', customerId)
    .eq('is_active', true);

  if (!agents || agents.length === 0) return;

  interface AgentRules {
    mode?: string;
    branches?: string[];
    regions?: { type: string; values: string[] };
    max_leads_per_day?: number;
    max_leads_per_week?: number;
    round_robin_weight?: number;
  }

  const candidates = agents.filter(a => {
    const rules: AgentRules = a.assignment_rules || {};
    if (!rules.mode || rules.mode === 'manual') return false;
    if (rules.mode === 'all') return true;

    // Branch filter
    if (rules.branches && rules.branches.length > 0) {
      if (!rules.branches.includes(lead.branch)) return false;
    }

    // Region filter
    if (rules.regions && rules.regions.values && rules.regions.values.length > 0) {
      const leadProv = (lead as Record<string, unknown>).provincie as string | undefined;
      if (rules.regions.type === 'provinces') {
        if (!leadProv || !rules.regions.values.includes(leadProv)) return false;
      }
    }

    return true;
  });

  if (candidates.length === 0) return;

  // Check daily/weekly limits and count existing leads for round-robin
  const candidateIds = candidates.map(c => c.id);
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  const { data: recentAssignments } = await supabase
    .from('lead_assignments')
    .select('portal_user_id, assigned_at')
    .eq('customer_id', customerId)
    .in('portal_user_id', candidateIds)
    .gte('assigned_at', weekStart.toISOString());

  const dailyCounts: Record<string, number> = {};
  const weeklyCounts: Record<string, number> = {};
  const totalCounts: Record<string, number> = {};

  (recentAssignments || []).forEach(a => {
    if (!a.portal_user_id) return;
    weeklyCounts[a.portal_user_id] = (weeklyCounts[a.portal_user_id] || 0) + 1;
    totalCounts[a.portal_user_id] = (totalCounts[a.portal_user_id] || 0) + 1;
    if (new Date(a.assigned_at) >= dayStart) {
      dailyCounts[a.portal_user_id] = (dailyCounts[a.portal_user_id] || 0) + 1;
    }
  });

  const eligible = candidates.filter(c => {
    const rules: AgentRules = c.assignment_rules || {};
    if (rules.max_leads_per_day && (dailyCounts[c.id] || 0) >= rules.max_leads_per_day) return false;
    if (rules.max_leads_per_week && (weeklyCounts[c.id] || 0) >= rules.max_leads_per_week) return false;
    return true;
  });

  if (eligible.length === 0) return;

  // Weighted round-robin: sort by (total_count / weight), lowest wins
  eligible.sort((a, b) => {
    const rulesA: AgentRules = a.assignment_rules || {};
    const rulesB: AgentRules = b.assignment_rules || {};
    const wA = rulesA.round_robin_weight || 1;
    const wB = rulesB.round_robin_weight || 1;
    const scoreA = (totalCounts[a.id] || 0) / wA;
    const scoreB = (totalCounts[b.id] || 0) / wB;
    return scoreA - scoreB;
  });

  const winner = eligible[0];

  // Update the most recent assignment for this lead+customer to set the portal_user_id
  await supabase
    .from('lead_assignments')
    .update({ portal_user_id: winner.id })
    .eq('lead_id', lead.id)
    .eq('customer_id', customerId)
    .order('assigned_at', { ascending: false })
    .limit(1);
}
