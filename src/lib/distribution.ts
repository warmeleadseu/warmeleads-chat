import { createServerClient } from './supabase';
import { sendLeadNotification } from './email';
import { sendNewLeadPush } from './pushNotification';
import { syncBatchDelivered } from './batchSync';
import { isPipelineBatchKind } from './batchKind';
import { getLeadLimitPeriodAnchors } from './batchAssignmentCaps';
import { leadMatchesAnyProvinceTarget } from './provinceTargetMatch';

/** Hard plafond in het product (gedeelde leads). */
const MAX_ASSIGNMENTS = 3;
const TARGET_AVG_ASSIGNMENTS = 2;
const MAX_LEAD_AGE_DAYS = 3;
const COOLDOWN_HOURS = 12;
const FAIRNESS_WINDOW_HOURS = 24;
const REASSIGNMENT_COOLDOWN_DAYS = 30;

const ASSIGNMENT_PAGE_SIZE = 1000;

/** Max leads per cron-run: voorkomt full-table scans en Nano overload. */
const DISTRIBUTE_CRON_LEAD_LIMIT = 400;

/** PostgREST veilige chunk voor .in('lead_id', …) */
const LEAD_ID_IN_CHUNK = 400;

/** Max leads uit DB voor één backfill-scan (voorkomt gigantische arrays op Nano). */
const BACKFILL_LEAD_SCAN_LIMIT = 2000;

type SupabaseClient = ReturnType<typeof createServerClient>;

async function fetchAssignmentsForLeadIds(
  supabase: SupabaseClient,
  leadIds: string[],
): Promise<{ lead_id: string; assigned_at: string }[]> {
  if (leadIds.length === 0) return [];
  const out: { lead_id: string; assigned_at: string }[] = [];
  for (let i = 0; i < leadIds.length; i += LEAD_ID_IN_CHUNK) {
    const chunk = leadIds.slice(i, i + LEAD_ID_IN_CHUNK);
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('lead_id, assigned_at')
      .in('lead_id', chunk);
    if (error) {
      console.error('[distribution] fetchAssignmentsForLeadIds:', error.message);
      continue;
    }
    for (const row of data || []) {
      if (row.lead_id && row.assigned_at) out.push({ lead_id: row.lead_id, assigned_at: row.assigned_at });
    }
  }
  return out;
}

/**
 * Alle lead_id's die ooit aan deze klant zijn gekoppeld (alle batches).
 * Gepagineerd: zonder dit mist backfill rijen na de PostgREST-default (meestal 1000)
 * en kunnen dezelfde leads opnieuw aan een nieuwe batch worden toegevoegd.
 */
async function fetchAllLeadIdsAssignedToCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .eq('customer_id', customerId)
      .range(offset, offset + ASSIGNMENT_PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    for (const row of data) ids.add(row.lead_id);
    if (data.length < ASSIGNMENT_PAGE_SIZE) break;
    offset += ASSIGNMENT_PAGE_SIZE;
  }
  return ids;
}

/**
 * Pipeline (FIFO): per klant + branche maximaal één actieve batch ontvangt nieuwe toewijzingen —
 * de oudste batch die nog niet vol is en waarvan starts_at al bereikt is.
 * `isPipelineBatchOpenForInbound`: deze batch mag nog leads ontvangen (niet vol, start bereikt).
 */
export function isPipelineBatchOpenForInbound<T extends {
  leads_delivered: number | null;
  batch_size: number;
  starts_at?: string | null;
}>(b: T, now: Date): boolean {
  const delivered = Number(b.leads_delivered ?? 0);
  const size = Number(b.batch_size ?? 0);
  if (size <= 0 || delivered >= size) return false;
  if (b.starts_at && new Date(b.starts_at) > now) return false;
  return true;
}

function filterActivePipelineBatchesToFifoHeadPerCustomer<T extends {
  id: string;
  customer_id: string;
  branch: string;
  created_at: string;
  leads_delivered: number | null;
  batch_size: number;
  starts_at?: string | null;
}>(batches: T[], now: Date): T[] {
  const byCustomer = new Map<string, T[]>();
  for (const b of batches) {
    const key = b.customer_id;
    const list = byCustomer.get(key);
    if (list) list.push(b);
    else byCustomer.set(key, [b]);
  }
  const keep = new Set<string>();
  for (const list of byCustomer.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const head = list.find(b => isPipelineBatchOpenForInbound(b, now));
    if (head) keep.add(head.id);
  }
  return batches.filter(b => keep.has(b.id));
}

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
  provincie?: string | null;
  land?: string | null;
  postcode?: string | null;
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

/** Optioneel per lead: `custom_fields.max_customer_assignments` (1–3). */
function effectiveMaxAssignments(lead: LeadForDistribution): number {
  const cf = lead.custom_fields;
  if (!cf || typeof cf !== 'object') return MAX_ASSIGNMENTS;
  const raw = (cf as Record<string, unknown>).max_customer_assignments;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n) || n < 1) return MAX_ASSIGNMENTS;
  return Math.min(MAX_ASSIGNMENTS, Math.max(1, Math.floor(n)));
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

/** Row shape from customer_batches select in distribution (PostgREST nested customers). */
type ActiveCustomerBatch = {
  id: string;
  customer_id: string;
  branch: string;
  batch_size: number;
  leads_delivered: number | null;
  leads_delivered_external?: number | null;
  leads_per_week: number | null;
  leads_per_day: number | null;
  lead_filters: unknown;
  created_at: string;
  is_paid: boolean | null;
  starts_at: string | null;
  customers: { id: string; is_active: boolean; portal_active: boolean };
};

async function fetchActiveBatchesForBranch(
  supabase: SupabaseClient,
  branch: string,
): Promise<ActiveCustomerBatch[]> {
  const { data } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_size, leads_delivered, leads_delivered_external, leads_per_week, leads_per_day, lead_filters, created_at, is_paid, starts_at, customers!inner(id, is_active, portal_active)')
    .eq('branch', branch)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .eq('customers.is_active', true)
    .neq('is_paid', false)
    .order('created_at', { ascending: true });
  return (data || []) as unknown as ActiveCustomerBatch[];
}

export type DistributeLeadContext = {
  supabase?: SupabaseClient;
  /** When set (e.g. from distributeLeads), avoids one customer_batches query per lead for that branch. */
  activeBatchesByBranch?: Map<string, ActiveCustomerBatch[]>;
  /** Bij meerdere matches eerst deze klant (bv. backfill). */
  preferCustomerId?: string;
  /**
   * Alleen voor admin/backfill: `phone_valid === false` mag tóch verdeeld worden,
   * maar uitsluitend naar deze klant-id's (doorgaans één vaste partij).
   */
  allowInvalidPhoneForCustomerIds?: string[];
  /** Alleen administratieve backfill: negeer leads_per_day (contract / leveringsbelofte — voorzichtig gebruiken). */
  ignoreBatchDailyCap?: boolean;
};

/**
 * Distribute a single lead to ONE matching customer (max 1 per run).
 * Respects 12h cooldown: if this lead was assigned to anyone in the last 12 hours, skip.
 */
export async function distributeLead(
  lead: LeadForDistribution,
  ctx?: DistributeLeadContext,
): Promise<DistributionResult> {
  const result: DistributionResult = { lead_id: lead.id, assignments: [] };

  // Never distribute demo leads to real customers (early check before DB fetch)
  if (lead.bron === 'demo') return result;

  const supabase = ctx?.supabase ?? createServerClient();

  let fullLead = lead;
  if (!lead.custom_fields) {
    const { data: leadRow } = await supabase.from('leads').select('*').eq('id', lead.id).single();
    if (leadRow) fullLead = { ...leadRow, lat: lead.lat, lng: lead.lng };
  }

  // Double-check after DB fetch in case bron wasn't passed by caller
  if (fullLead.bron === 'demo') return result;

  // Niche-onderzoek: geen geo vereist; telt niet mee voor pipeline 12u-cooldown
  if (fullLead.phone_valid !== false) {
    const { tryAssignLeadToNicheResearchBatch } = await import('./nicheResearchDistribution');
    const nicheHit = await tryAssignLeadToNicheResearchBatch(supabase, fullLead);
    if (nicheHit) {
      result.assignments.push({
        customer_id: nicheHit.customer_id,
        batch_id: nicheHit.batch_id,
        distance_km: null,
      });
    }
  }

  const hasCoords = !!(fullLead.lat && fullLead.lng);
  const hasProv = !!(fullLead as { provincie?: string }).provincie;
  if (!hasCoords && !hasProv) return result;

  if (fullLead.phone_valid === false) {
    const allow = ctx?.allowInvalidPhoneForCustomerIds;
    if (!allow?.length) return result;
  }

  const { data: existingAssignments } = await supabase
    .from('lead_assignments')
    .select('customer_id, assigned_at, batch_id, customer_batches(batch_kind)')
    .eq('lead_id', lead.id);

  const pipelineCooldownAssignments = (existingAssignments || []).filter((a) => {
    const kind = (a as { customer_batches?: { batch_kind?: string } | null }).customer_batches?.batch_kind;
    return kind !== 'niche_research';
  });

  const reassignmentCutoff = new Date(Date.now() - REASSIGNMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const recentAssignments = (existingAssignments || []).filter(a => new Date(a.assigned_at) >= reassignmentCutoff);
  const recentAssignedIds = new Set(recentAssignments.map(a => a.customer_id));
  if (recentAssignedIds.size >= effectiveMaxAssignments(fullLead as LeadForDistribution)) return result;

  // 12-hour cooldown: alleen pipeline-toewijzingen (niche-onderzoek blokkeert andere klanten niet structureel)
  if (pipelineCooldownAssignments.length > 0) {
    const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
    const cooldownHit = pipelineCooldownAssignments.find(a =>
      new Date(a.assigned_at) > cooldownCutoff
    );
    if (cooldownHit) return result;
  }

  let activeBatches = ctx?.activeBatchesByBranch?.get(lead.branch);
  if (activeBatches === undefined) {
    activeBatches = await fetchActiveBatchesForBranch(supabase, lead.branch);
    ctx?.activeBatchesByBranch?.set(lead.branch, activeBatches);
  }

  if (!activeBatches || activeBatches.length === 0) return result;

  const now = new Date();
  const fifoActiveBatches = filterActivePipelineBatchesToFifoHeadPerCustomer(activeBatches, now);
  if (fifoActiveBatches.length === 0) return result;

  const batchesWithWeeklyLimit = fifoActiveBatches.filter(b => b.leads_per_week && b.leads_per_week > 0);
  const batchesWithDailyLimit = fifoActiveBatches.filter(b => b.leads_per_day && b.leads_per_day > 0);
  const weeklyCountByBatch: Record<string, number> = {};
  const dailyCountByBatch: Record<string, number> = {};

  if (batchesWithWeeklyLimit.length > 0 || batchesWithDailyLimit.length > 0) {
    const { dayStart, weekStart } = getLeadLimitPeriodAnchors(now);

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

  const customerIds = [...new Set(fifoActiveBatches.map(b => b.customer_id))];

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

  for (const batch of fifoActiveBatches) {
    if (Number(batch.leads_delivered ?? 0) >= batch.batch_size) continue;
    if (recentAssignedIds.has(batch.customer_id)) continue;
    if (batch.starts_at && new Date(batch.starts_at) > now) continue;

    if (
      fullLead.phone_valid === false &&
      ctx?.allowInvalidPhoneForCustomerIds?.length &&
      !ctx.allowInvalidPhoneForCustomerIds.includes(batch.customer_id)
    ) {
      continue;
    }

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

    if (!ctx?.ignoreBatchDailyCap && batch.leads_per_day && batch.leads_per_day > 0) {
      const todayCount = dailyCountByBatch[batch.id] || 0;
      if (todayCount >= batch.leads_per_day) continue;
    }

    const custTargets = targetsByCustomer[batch.customer_id];
    if (!custTargets) continue;

    let bestMatch: { radius: number; distance: number } | null = null;
    for (const t of custTargets) {
      if ((t.target_type || 'radius') === 'province') {
        const provs: string[] = Array.isArray(t.provinces) ? t.provinces : [];
        if (provs.length > 0 && leadMatchesAnyProvinceTarget(fullLead, provs)) {
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

  const prefer = ctx?.preferCustomerId;
  matches.sort((a, b) => {
    if (prefer) {
      const aPref = a.customer_id === prefer;
      const bPref = b.customer_id === prefer;
      if (aPref !== bPref) return aPref ? -1 : 1;
    }
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
    const batchForCheck = fifoActiveBatches.find(b => b.id === m.batch_id);
    const externalOffset = (batchForCheck as any)?.leads_delivered_external || 0;
    if (batchForCheck && (currentCount || 0) + externalOffset >= batchForCheck.batch_size) continue;

    const { data: insertedAssignment, error } = await supabase
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: m.customer_id,
        batch_id: m.batch_id,
        distance_km: m.distance_km,
      })
      .select('id')
      .single();

    if (error || !insertedAssignment) continue;

    const { onLeadAssignedToCustomer } = await import('@/lib/integrations/onLeadAssigned');
    onLeadAssignedToCustomer({
      customerId: m.customer_id,
      leadId: lead.id,
      assignmentId: insertedAssignment.id,
    });

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
 * Prefetches active batches per distinct branch to cut repeated customer_batches queries.
 */
export async function distributeLeads(leads: LeadForDistribution[]): Promise<{ distributed: number; assignments: number }> {
  let distributed = 0;
  let assignments = 0;

  const supabase = createServerClient();
  const branches = [...new Set(leads.map(l => l.branch).filter((b): b is string => !!b))];
  const activeBatchesByBranch = new Map<string, ActiveCustomerBatch[]>();
  await Promise.all(
    branches.map(async b => {
      const rows = await fetchActiveBatchesForBranch(supabase, b);
      activeBatchesByBranch.set(b, rows);
    }),
  );

  const ctx: DistributeLeadContext = { supabase, activeBatchesByBranch };

  for (const lead of leads) {
    const result = await distributeLead(lead, ctx);
    if (result.assignments.length > 0) {
      distributed++;
      assignments += result.assignments.length;
    }
  }

  return { distributed, assignments };
}

/**
 * Sleutel voor "kalenderdag" van een ISO-timestamp in server-locale (Vercel = UTC).
 * Bewust gelijk aan de runtime-distributie die ook `Date#getDate()` gebruikt voor
 * daily/weekly buckets, zodat backfill en cron op dezelfde grens werken.
 */
function backfillDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Sleutel voor "kalenderweek" (maandag-start, NL-gewoonte). Identieke definitie
 * als gebruikt in de runtime weekly-cap (zie `distributeLead`-tellingen).
 */
function backfillWeekKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

/**
 * Targeted backfill for a single newly created batch.
 * Only assigns leads from the last `lookbackDays` to this specific batch.
 * If lookbackDays is 0, no backfill is performed (only future leads via cron).
 *
 * Respecteert `leads_per_day` / `leads_per_week`: per kalenderdag (resp. -week)
 * in het lookback-venster worden niet meer leads toegewezen dan het limiet.
 * Daarmee voorkomen we dat een batch met bv. `max 5/dag` en `lookback 2` ineens
 * 20 leads in één keer krijgt zodra die historisch beschikbaar zijn.
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

  const nowBf = new Date();
  const { data: fifoSiblings } = await supabase
    .from('customer_batches')
    .select('id, created_at, leads_delivered, batch_size, starts_at')
    .eq('customer_id', batch.customer_id)
    .eq('branch', batch.branch)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .neq('is_paid', false)
    .order('created_at', { ascending: true });

  const fifoHead = (fifoSiblings || []).find(b => isPipelineBatchOpenForInbound(b, nowBf));
  if (!fifoHead || fifoHead.id !== batch.id) {
    return { assigned: 0 };
  }

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

  const { data: leads } = await leadsQuery.limit(BACKFILL_LEAD_SCAN_LIMIT);

  if (!leads || leads.length === 0) return { assigned: 0 };

  const alreadyAssigned = await fetchAllLeadIdsAssignedToCustomer(supabase, batch.customer_id);

  const filters: LeadFilter[] = Array.isArray(batch.lead_filters) ? batch.lead_filters : [];
  let assigned = 0;

  const backfillExternal = (batch as any).leads_delivered_external || 0;

  const { count: initialAssignCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batch.id);
  let runningAssignCount = initialAssignCount ?? 0;

  const dailyLimit = batch.leads_per_day && batch.leads_per_day > 0 ? Number(batch.leads_per_day) : null;
  const weeklyLimit = batch.leads_per_week && batch.leads_per_week > 0 ? Number(batch.leads_per_week) : null;

  const dailyCountByDay = new Map<string, number>();
  const weeklyCountByWeek = new Map<string, number>();

  // Bestaande assignments voor deze batch meetellen op `lead.created_at`-basis,
  // zodat een tweede backfill-run (bv. na batch-grow) de eerder geleverde leads
  // van dezelfde lookback-dag niet opnieuw negeert.
  if (dailyLimit !== null || weeklyLimit !== null) {
    type ExistingAssignmentRow = { leads: { created_at?: string | null } | { created_at?: string | null }[] | null };
    const { data: existingAssigns } = await supabase
      .from('lead_assignments')
      .select('leads(created_at)')
      .eq('batch_id', batch.id);

    for (const row of (existingAssigns as ExistingAssignmentRow[] | null) || []) {
      const joined = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      const createdAt = joined?.created_at ?? null;
      if (!createdAt) continue;
      if (dailyLimit !== null) {
        const k = backfillDayKey(createdAt);
        if (k) dailyCountByDay.set(k, (dailyCountByDay.get(k) || 0) + 1);
      }
      if (weeklyLimit !== null) {
        const k = backfillWeekKey(createdAt);
        if (k) weeklyCountByWeek.set(k, (weeklyCountByWeek.get(k) || 0) + 1);
      }
    }
  }

  let skippedByDailyLimit = 0;
  let skippedByWeeklyLimit = 0;

  for (const lead of leads) {
    if (runningAssignCount + backfillExternal >= batch.batch_size) break;

    if (alreadyAssigned.has(lead.id)) continue;
    if (excludedLeadIds.has(lead.id)) continue;
    if (!matchesAllFilters(lead as LeadForDistribution, filters)) continue;

    const leadCreatedAt = (lead as { created_at?: string | null }).created_at ?? null;
    const dayKey = dailyLimit !== null ? backfillDayKey(leadCreatedAt) : null;
    const weekKey = weeklyLimit !== null ? backfillWeekKey(leadCreatedAt) : null;

    if (dailyLimit !== null && dayKey) {
      const used = dailyCountByDay.get(dayKey) || 0;
      if (used >= dailyLimit) { skippedByDailyLimit++; continue; }
    }
    if (weeklyLimit !== null && weekKey) {
      const used = weeklyCountByWeek.get(weekKey) || 0;
      if (used >= weeklyLimit) { skippedByWeeklyLimit++; continue; }
    }

    let inRange = false;
    let bestDist = Infinity;
    for (const t of targets) {
      if ((t.target_type || 'radius') === 'province') {
        const provs: string[] = Array.isArray(t.provinces) ? t.provinces : [];
        if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) {
          inRange = true;
          bestDist = Math.min(bestDist, 0);
        }
      } else if (lead.lat && lead.lng) {
        const dist = haversineKm(lead.lat, lead.lng, t.lat, t.lng);
        if (dist <= t.radius_km) { inRange = true; bestDist = Math.min(bestDist, dist); }
      }
    }
    if (!inRange) continue;

    const { data: insertedAssignment, error } = await supabase
      .from('lead_assignments')
      .insert({ lead_id: lead.id, customer_id: batch.customer_id, batch_id: batch.id, distance_km: Math.round(bestDist * 10) / 10 })
      .select('id')
      .single();

    if (!error && insertedAssignment) {
      const { onLeadAssignedToCustomer } = await import('@/lib/integrations/onLeadAssigned');
      onLeadAssignedToCustomer({
        customerId: batch.customer_id,
        leadId: lead.id,
        assignmentId: insertedAssignment.id,
      });
      assigned++;
      runningAssignCount++;
      alreadyAssigned.add(lead.id);
      if (dailyLimit !== null && dayKey) {
        dailyCountByDay.set(dayKey, (dailyCountByDay.get(dayKey) || 0) + 1);
      }
      if (weeklyLimit !== null && weekKey) {
        weeklyCountByWeek.set(weekKey, (weeklyCountByWeek.get(weekKey) || 0) + 1);
      }

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

  if (skippedByDailyLimit > 0 || skippedByWeeklyLimit > 0) {
    console.info('[backfillBatch] rate-limit respected', {
      batchId: batch.id,
      assigned,
      skippedByDailyLimit,
      skippedByWeeklyLimit,
      leads_per_day: dailyLimit,
      leads_per_week: weeklyLimit,
      lookbackDays,
    });
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
    .order('created_at', { ascending: false })
    .limit(DISTRIBUTE_CRON_LEAD_LIMIT);

  if (!leads || leads.length === 0) return { distributed: 0, assignments: 0, avgAssignments: 0 };

  const leadIds = leads.map(l => l.id);
  const existingAssignments = await fetchAssignmentsForLeadIds(supabase, leadIds);

  const reassignWindowCutoff = new Date(Date.now() - REASSIGNMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const recentAssignmentCounts: Record<string, number> = {};
  const lastAssignedAt: Record<string, Date> = {};
  existingAssignments.forEach(a => {
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

  // Recalculate average after pass 1 (zelfde benadering als voorheen; alleen op deze lead-set)
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
      const cap = effectiveMaxAssignments(l as LeadForDistribution);
      if (count === 0 || count >= cap) return false;
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

  const rowsForCandidates = existingAssignments.length + totalAssignments;
  const distinctCandidateLeads = new Set(leads.map(l => l.id)).size;
  const avgAssignments =
    distinctCandidateLeads > 0 ? Math.round((rowsForCandidates / distinctCandidateLeads) * 100) / 100 : 0;

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
      if (rules.regions.type === 'provinces') {
        if (!leadMatchesAnyProvinceTarget(lead, rules.regions.values)) return false;
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
