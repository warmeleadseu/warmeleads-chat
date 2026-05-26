/**
 * Voorstel + uitvoer: verdeling Meta-backfill thuisbatterij-leads.
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/propose-backfill-distribution.ts
 *   npx tsx scripts/propose-backfill-distribution.ts --execute
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { batchIsAtCapacity, isCappedDeliveryModel } from '../src/lib/batchDeliveryModel';
import { isPipelineBatchOpenForInbound } from '../src/lib/distribution';
import { leadMatchesAnyProvinceTarget } from '../src/lib/provinceTargetMatch';
import { syncBatchDelivered } from '../src/lib/batchSync';
import { onLeadAssignedToCustomer } from '../src/lib/integrations/onLeadAssigned';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const EXECUTE = process.argv.includes('--execute');

const BRANCH = 'thuisbatterij';
const MAX_TOTAL_RATIO = 2.5;
const PREFERRED_MAX_PER_LEAD = 2;
const HARD_MAX_PER_LEAD = 3;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterFifoHead<T extends { id: string; customer_id: string; created_at: string; leads_delivered: number | null; batch_size: number; starts_at?: string | null }>(
  batches: T[],
  now: Date,
): T[] {
  const byCustomer = new Map<string, T[]>();
  for (const b of batches) {
    const list = byCustomer.get(b.customer_id);
    if (list) list.push(b);
    else byCustomer.set(b.customer_id, [b]);
  }
  const keep = new Set<string>();
  for (const list of byCustomer.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const head = list.find((b) => isPipelineBatchOpenForInbound(b, now));
    if (head) keep.add(head.id);
  }
  return batches.filter((b) => keep.has(b.id));
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env ontbreekt');
  return createClient(url, key);
}

type LeadRow = {
  id: string;
  naam_klant: string | null;
  email: string | null;
  telefoonnummer: string | null;
  postcode: string | null;
  plaatsnaam: string | null;
  provincie: string | null;
  lat: number | null;
  lng: number | null;
  phone_valid: boolean | null;
  wervingsdatum: string | null;
  custom_fields: Record<string, string> | null;
  quality_score: number | null;
  budget: string | null;
  zonnepanelen: string | null;
  dynamisch_contract: string | null;
  stroomverbruik: string | null;
  bron: string | null;
  land: string | null;
};

type BatchRow = {
  id: string;
  customer_id: string;
  branch: string;
  batch_size: number;
  leads_delivered: number | null;
  leads_delivered_external: number | null;
  leads_per_week: number | null;
  leads_per_day: number | null;
  lead_filters: unknown;
  created_at: string;
  is_paid: boolean | null;
  starts_at: string | null;
  delivery_model: string | null;
  batch_kind: string | null;
  customers: { id: string; name: string; is_active: boolean; portal_active: boolean; exclude_customers: string[] | null };
};

type TargetRow = {
  customer_id: string;
  label: string;
  lat: number;
  lng: number;
  radius_km: number;
  target_type: string | null;
  provinces: string[] | null;
};

type Match = {
  customer_id: string;
  customer_name: string;
  batch_id: string;
  distance_km: number;
  min_radius: number;
};

type PlannedAssignment = Match & { lead_id: string; round: number };

interface LeadFilter {
  field: string;
  operator: string;
  value: string;
  values?: string[];
}

function getLeadFieldValue(lead: LeadRow, fieldKey: string): string | null {
  if (fieldKey === 'quality_score') return lead.quality_score != null ? String(lead.quality_score) : null;
  if (fieldKey === 'phone_valid') return lead.phone_valid != null ? String(lead.phone_valid) : null;
  const direct = (lead as Record<string, unknown>)[fieldKey];
  if (direct != null && direct !== '') return String(direct);
  if (lead.custom_fields?.[fieldKey]) return String(lead.custom_fields[fieldKey]);
  return null;
}

function matchesFilter(lead: LeadRow, filter: LeadFilter): boolean {
  const raw = getLeadFieldValue(lead, filter.field);
  if (raw === null) return false;
  if (filter.operator === 'in' && filter.values?.length) {
    const lower = raw.toLowerCase();
    return filter.values.some((v) => v.toLowerCase() === lower);
  }
  const numA = parseFloat(raw.replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  const numB = parseFloat((filter.value || '').replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  const bothNumeric = !Number.isNaN(numA) && !Number.isNaN(numB);
  switch (filter.operator) {
    case 'eq':
      return raw.toLowerCase() === (filter.value || '').toLowerCase();
    case 'neq':
      return raw.toLowerCase() !== (filter.value || '').toLowerCase();
    case 'gt':
      return bothNumeric ? numA > numB : raw > (filter.value || '');
    case 'gte':
      return bothNumeric ? numA >= numB : raw >= (filter.value || '');
    case 'lt':
      return bothNumeric ? numA < numB : raw < (filter.value || '');
    case 'lte':
      return bothNumeric ? numA <= numB : raw <= (filter.value || '');
    case 'contains':
      return raw.toLowerCase().includes((filter.value || '').toLowerCase());
    case 'not_contains':
      return !raw.toLowerCase().includes((filter.value || '').toLowerCase());
    default:
      return true;
  }
}

function matchesAllFilters(lead: LeadRow, filters: LeadFilter[]): boolean {
  if (!filters.length) return true;
  return filters.every((f) => matchesFilter(lead, f));
}

function findMatches(
  lead: LeadRow,
  fifoBatches: BatchRow[],
  targetsByCustomer: Record<string, TargetRow[]>,
  excludeMap: Record<string, string[]>,
  assignedCustomerIds: Set<string>,
): Match[] {
  const hasCoords = !!(lead.lat && lead.lng);
  const hasProv = !!lead.provincie;
  if (!hasCoords && !hasProv) return [];

  const matches: Match[] = [];
  const now = new Date();

  for (const batch of fifoBatches) {
    if (!isPipelineBatchOpenForInbound(batch, now)) continue;
    if (assignedCustomerIds.has(batch.customer_id)) continue;
    if (batch.starts_at && new Date(batch.starts_at) > now) continue;

    const candidateExcludes = excludeMap[batch.customer_id] || [];
    let excluded = false;
    for (const assignedCustId of assignedCustomerIds) {
      if (candidateExcludes.includes(assignedCustId)) {
        excluded = true;
        break;
      }
      const assignedExcludes = excludeMap[assignedCustId] || [];
      if (assignedExcludes.includes(batch.customer_id)) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;

    const custTargets = targetsByCustomer[batch.customer_id];
    if (!custTargets?.length) continue;

    let bestMatch: { radius: number; distance: number } | null = null;
    for (const t of custTargets) {
      if ((t.target_type || 'radius') === 'province') {
        const provs = Array.isArray(t.provinces) ? t.provinces : [];
        if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) {
          if (!bestMatch || 999 < bestMatch.radius) bestMatch = { radius: 999, distance: 0 };
        }
      } else if (hasCoords) {
        const dist = haversineKm(lead.lat!, lead.lng!, t.lat, t.lng);
        if (dist <= t.radius_km) {
          if (!bestMatch || t.radius_km < bestMatch.radius) {
            bestMatch = { radius: t.radius_km, distance: dist };
          }
        }
      }
    }
    if (!bestMatch) continue;

    const filters: LeadFilter[] = Array.isArray(batch.lead_filters) ? (batch.lead_filters as LeadFilter[]) : [];
    if (!matchesAllFilters(lead, filters)) continue;

    if (!matches.find((m) => m.customer_id === batch.customer_id)) {
      matches.push({
        customer_id: batch.customer_id,
        customer_name: batch.customers.name,
        batch_id: batch.id,
        distance_km: Math.round(bestMatch.distance * 10) / 10,
        min_radius: bestMatch.radius,
      });
    }
  }

  matches.sort((a, b) => {
    if (a.min_radius !== b.min_radius) return a.min_radius - b.min_radius;
    return a.distance_km - b.distance_km;
  });
  return matches;
}

function batchRemaining(batch: BatchRow, plannedForBatch: number, assignCountByBatch: Map<string, number>): number {
  const current = assignCountByBatch.get(batch.id) ?? 0;
  const external = batch.leads_delivered_external ?? 0;
  if (
    isCappedDeliveryModel(batch.delivery_model, batch.batch_kind) &&
    current + plannedForBatch + external >= batch.batch_size
  ) {
    return 0;
  }
  if (isCappedDeliveryModel(batch.delivery_model, batch.batch_kind)) {
    return batch.batch_size - external - current - plannedForBatch;
  }
  return 9999;
}

async function main() {
  const sb = supabase();

  const { data: leads, error: lErr } = await sb
    .from('leads')
    .select(
      'id, naam_klant, email, telefoonnummer, postcode, plaatsnaam, provincie, lat, lng, phone_valid, wervingsdatum, custom_fields, quality_score, budget, zonnepanelen, dynamisch_contract, stroomverbruik, bron, land',
    )
    .eq('branch', BRANCH)
    .like('notities', '%Meta backfill%')
    .order('wervingsdatum', { ascending: true });

  if (lErr || !leads) throw new Error(lErr?.message || 'Leads ophalen mislukt');

  const backfillLeads = (leads as LeadRow[]).filter(
    (l) => l.email?.toLowerCase() !== 'test@meta.com' && l.phone_valid !== false,
  );
  const skippedInvalid = (leads as LeadRow[]).filter((l) => l.phone_valid === false);
  const skippedTest = (leads as LeadRow[]).filter((l) => l.email?.toLowerCase() === 'test@meta.com');

  const maxTotalAssignments = Math.floor(backfillLeads.length * MAX_TOTAL_RATIO);

  const { data: batchesRaw } = await sb
    .from('customer_batches')
    .select(
      'id, customer_id, branch, batch_size, leads_delivered, leads_delivered_external, leads_per_week, leads_per_day, lead_filters, created_at, is_paid, starts_at, delivery_model, batch_kind, customers!inner(id, name, is_active, portal_active, exclude_customers)',
    )
    .eq('branch', BRANCH)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .eq('customers.is_active', true)
    .neq('is_paid', false)
    .order('created_at', { ascending: true });

  const batches = (batchesRaw || []) as unknown as BatchRow[];
  const now = new Date();
  const fifoBatches = filterFifoHead(batches, now);

  const customerIds = [...new Set(fifoBatches.map((b) => b.customer_id))];
  const { data: targets } = await sb
    .from('customer_targets')
    .select('customer_id, label, lat, lng, radius_km, target_type, provinces')
    .in('customer_id', customerIds)
    .eq('is_active', true);

  const targetsByCustomer: Record<string, TargetRow[]> = {};
  for (const t of (targets || []) as TargetRow[]) {
    if (!targetsByCustomer[t.customer_id]) targetsByCustomer[t.customer_id] = [];
    targetsByCustomer[t.customer_id].push(t);
  }

  const excludeMap: Record<string, string[]> = {};
  for (const b of fifoBatches) {
    excludeMap[b.customer_id] = Array.isArray(b.customers.exclude_customers)
      ? b.customers.exclude_customers
      : [];
  }

  const batchIds = fifoBatches.map((b) => b.id);
  const { data: existingAssigns } = await sb
    .from('lead_assignments')
    .select('batch_id')
    .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000']);

  const assignCountByBatch = new Map<string, number>();
  for (const a of existingAssigns || []) {
    assignCountByBatch.set(a.batch_id, (assignCountByBatch.get(a.batch_id) || 0) + 1);
  }

  const plannedByBatch = new Map<string, number>();
  const planned: PlannedAssignment[] = [];
  const assignmentsPerLead = new Map<string, PlannedAssignment[]>();
  const noMatchLeads: LeadRow[] = [];
  const noGeoLeads: LeadRow[] = [];

  for (const lead of backfillLeads) {
    const hasGeo = !!(lead.lat && lead.lng) || !!lead.provincie;
    if (!hasGeo) {
      noGeoLeads.push(lead);
      continue;
    }

    const assignedIds = new Set<string>();
    const leadMatches = findMatches(lead, fifoBatches, targetsByCustomer, excludeMap, assignedIds);
    if (leadMatches.length === 0) {
      noMatchLeads.push(lead);
      continue;
    }

    assignmentsPerLead.set(lead.id, []);

    for (let round = 1; round <= PREFERRED_MAX_PER_LEAD; round++) {
      if (planned.length >= maxTotalAssignments) break;

      const current = assignmentsPerLead.get(lead.id)!;
      const taken = new Set(current.map((a) => a.customer_id));
      const available = leadMatches.filter((m) => {
        if (taken.has(m.customer_id)) return false;
        const batch = fifoBatches.find((b) => b.id === m.batch_id)!;
        const plannedCount = plannedByBatch.get(m.batch_id) || 0;
        return batchRemaining(batch, plannedCount, assignCountByBatch) > 0;
      });
      if (!available.length) break;

      const pick = available[0];
      const assignment: PlannedAssignment = { ...pick, lead_id: lead.id, round };
      planned.push(assignment);
      current.push(assignment);
      plannedByBatch.set(pick.batch_id, (plannedByBatch.get(pick.batch_id) || 0) + 1);
      assignedIds.add(pick.customer_id);
    }
  }

  // Optionele 3e ronde alleen als nog ruimte onder totaalplafond en lead heeft nog maar 1 match
  if (planned.length < maxTotalAssignments) {
    for (const lead of backfillLeads) {
      if (planned.length >= maxTotalAssignments) break;
      const current = assignmentsPerLead.get(lead.id);
      if (!current || current.length >= HARD_MAX_PER_LEAD || current.length >= PREFERRED_MAX_PER_LEAD) continue;

      const assignedIds = new Set(current.map((a) => a.customer_id));
      const leadMatches = findMatches(lead, fifoBatches, targetsByCustomer, excludeMap, assignedIds);
      const available = leadMatches.filter((m) => {
        if (assignedIds.has(m.customer_id)) return false;
        const batch = fifoBatches.find((b) => b.id === m.batch_id)!;
        const plannedCount = plannedByBatch.get(m.batch_id) || 0;
        return batchRemaining(batch, plannedCount, assignCountByBatch) > 0;
      });
      if (!available.length) continue;

      const pick = available[0];
      const assignment: PlannedAssignment = { ...pick, lead_id: lead.id, round: 3 };
      planned.push(assignment);
      current.push(assignment);
      plannedByBatch.set(pick.batch_id, (plannedByBatch.get(pick.batch_id) || 0) + 1);
    }
  }

  const byCustomer = new Map<string, { name: string; count: number; batch_id: string }>();
  for (const p of planned) {
    const key = p.customer_id;
    const prev = byCustomer.get(key);
    if (prev) prev.count++;
    else byCustomer.set(key, { name: p.customer_name, count: 1, batch_id: p.batch_id });
  }

  const leadsWith1 = [...assignmentsPerLead.values()].filter((a) => a.length === 1).length;
  const leadsWith2 = [...assignmentsPerLead.values()].filter((a) => a.length === 2).length;
  const leadsWith0 = noMatchLeads.length + noGeoLeads.length;

  console.log('\n=== VOORSTEL META-BACKFILL DISTRIBUTIE ===\n');
  console.log(`Backfill-leads (excl. test):     ${backfillLeads.length}`);
  console.log(`Overgeslagen ongeldig nummer:    ${skippedInvalid.length}`);
  console.log(`Overgeslagen test-lead:          ${skippedTest.length}`);
  console.log(`Actieve klanten (FIFO-batch):    ${fifoBatches.length}`);
  console.log(`Max totaal toewijzingen (×${MAX_TOTAL_RATIO}): ${maxTotalAssignments}`);
  console.log(`Geplande toewijzingen:           ${planned.length}`);
  console.log(`Gemiddeld per lead:              ${(planned.length / backfillLeads.length).toFixed(2)}`);
  console.log(`Leads met 2 klanten:             ${leadsWith2}`);
  console.log(`Leads met 1 klant:                ${leadsWith1}`);
  console.log(`Leads zonder match:              ${leadsWith0} (geen geo: ${noGeoLeads.length}, buiten targets: ${noMatchLeads.length})`);

  console.log('\n--- Per klant ---');
  const sortedCustomers = [...byCustomer.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [, v] of sortedCustomers) {
    const batch = fifoBatches.find((b) => b.id === v.batch_id)!;
    const current = assignCountByBatch.get(v.batch_id) ?? 0;
    const plannedExtra = plannedByBatch.get(v.batch_id) ?? 0;
    const external = batch.leads_delivered_external ?? 0;
    const after = current + plannedExtra + external;
    const cap = isCappedDeliveryModel(batch.delivery_model, batch.batch_kind) ? batch.batch_size : '∞';
    console.log(
      `  ${v.name.padEnd(28)} +${String(v.count).padStart(2)} leads  → batch ${after}/${cap} (nu ${current + external}/${cap})`,
    );
  }

  console.log('\n--- Actieve batches (context) ---');
  for (const b of fifoBatches) {
    const current = assignCountByBatch.get(b.id) ?? 0;
    const external = b.leads_delivered_external ?? 0;
    const plannedExtra = plannedByBatch.get(b.id) ?? 0;
    const targets = (targetsByCustomer[b.customer_id] || []).map((t) => t.label).join(', ');
    const cap = isCappedDeliveryModel(b.delivery_model, b.batch_kind) ? b.batch_size : '∞';
    const atCap = batchIsAtCapacity(b) ? ' [VOL]' : '';
    console.log(
      `  ${b.customers.name.padEnd(28)} ${current + external}/${cap} +${plannedExtra}${atCap} | ${targets || 'geen targets'}`,
    );
  }

  console.log('\n--- Detail per lead ---');
  for (const lead of backfillLeads) {
    const assigns = assignmentsPerLead.get(lead.id) || [];
    const loc = [lead.plaatsnaam, lead.postcode].filter(Boolean).join(' ') || lead.provincie || '?';
    if (assigns.length === 0) {
      const reason = noGeoLeads.includes(lead) ? 'geen geo' : 'geen match';
      console.log(`  ✗ ${lead.wervingsdatum} | ${lead.naam_klant} | ${loc} | ${reason}`);
      continue;
    }
    const custs = assigns.map((a) => `${a.customer_name} (${a.distance_km}km, r${a.round})`).join(' + ');
    console.log(`  ✓ ${lead.wervingsdatum} | ${lead.naam_klant} | ${loc} | ${assigns.length}x → ${custs}`);
  }

  if (noMatchLeads.length) {
    console.log('\n--- Geen match (wel geldig nummer) ---');
    for (const l of noMatchLeads) {
      console.log(`  ${l.naam_klant} | ${l.postcode} ${l.plaatsnaam} | prov=${l.provincie} | lat=${l.lat}`);
    }
  }

  if (!EXECUTE) {
    console.log('\n(dry-run — voeg --execute toe om in te laden)');
    return;
  }

  if (planned.length === 0) {
    console.log('\nGeen assignments om in te laden.');
    return;
  }

  const leadIds = [...new Set(planned.map((p) => p.lead_id))];
  const { data: existingPairs } = await sb
    .from('lead_assignments')
    .select('lead_id, customer_id')
    .in('lead_id', leadIds);

  const existingPairKeys = new Set(
    (existingPairs || []).map((r) => `${r.lead_id}:${r.customer_id}`),
  );

  let inserted = 0;
  let skippedDup = 0;
  let failed = 0;
  const touchedBatches = new Set<string>();

  console.log('\n=== UITVOEREN ===\n');

  for (const p of planned) {
    const key = `${p.lead_id}:${p.customer_id}`;
    if (existingPairKeys.has(key)) {
      skippedDup++;
      continue;
    }

    const { data: row, error } = await sb
      .from('lead_assignments')
      .insert({
        lead_id: p.lead_id,
        customer_id: p.customer_id,
        batch_id: p.batch_id,
        distance_km: p.distance_km,
      })
      .select('id')
      .single();

    if (error || !row) {
      failed++;
      console.error(`FAIL ${p.lead_id} → ${p.customer_name}:`, error?.message);
      continue;
    }

    inserted++;
    existingPairKeys.add(key);
    touchedBatches.add(p.batch_id);
    onLeadAssignedToCustomer({
      customerId: p.customer_id,
      leadId: p.lead_id,
      assignmentId: row.id,
    });
    console.log(`OK ${p.lead_id} → ${p.customer_name} (batch ${p.batch_id.slice(0, 8)}…)`);
  }

  for (const batchId of touchedBatches) {
    await syncBatchDelivered(sb, batchId);
  }

  console.log('\n=== KLAAR ===');
  console.log(`Ingeladen:        ${inserted}`);
  console.log(`Overgeslagen dup: ${skippedDup}`);
  console.log(`Mislukt:          ${failed}`);
  console.log(`Batches bijgewerkt: ${touchedBatches.size}`);

  await sb.from('app_settings').upsert({
    key: `backfill:distribution:meta_old_form:${Date.now()}`,
    value: JSON.stringify({
      executed_at: new Date().toISOString(),
      planned: planned.length,
      inserted,
      skipped_dup: skippedDup,
      failed,
      batch_ids: [...touchedBatches],
      lead_ids: leadIds,
    }),
  }, { onConflict: 'key' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
