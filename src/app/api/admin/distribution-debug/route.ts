import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { leadMatchesAnyProvinceTarget } from '@/lib/provinceTargetMatch';

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

export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const supabase = createServerClient();

  /** Safety caps voor debug-tool. Voorkomt dat een per-ongeluk-geklikte refresh de DB plat trekt. */
  const DEBUG_LIMIT = 2000;

  const [leadsRes, assignRes, batchRes, targetRes, custRes, batchTargetRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, naam_klant, email, branch, postcode, plaatsnaam, lat, lng, land, provincie, created_at')
      .order('created_at', { ascending: false })
      .limit(DEBUG_LIMIT),
    supabase
      .from('lead_assignments')
      .select('id, lead_id, customer_id, batch_id, distance_km, assigned_at, customers(name)')
      .order('assigned_at', { ascending: false })
      .limit(DEBUG_LIMIT),
    supabase
      .from('customer_batches')
      .select('id, customer_id, branch, batch_size, leads_delivered, leads_per_day, leads_per_week, status, is_paid, customers(name)')
      .limit(DEBUG_LIMIT),
    supabase
      .from('customer_targets')
      .select('id, customer_id, label, lat, lng, radius_km, is_active, target_type, provinces')
      .limit(DEBUG_LIMIT),
    supabase
      .from('customers')
      .select('id, name, is_active, portal_active')
      .limit(DEBUG_LIMIT),
    supabase
      .from('batch_targets')
      .select('id, batch_id, label, lat, lng, radius_km, is_active, target_type, provinces')
      .eq('is_active', true)
      .limit(DEBUG_LIMIT),
  ]);

  const leads = leadsRes.data || [];
  const assignments = assignRes.data || [];
  const batches = batchRes.data || [];
  const targets = targetRes.data || [];
  const customers = custRes.data || [];
  // batch_targets kan ontbreken vóór migratie 144 → dan gewoon lege lijst.
  const batchTargets = batchTargetRes.error ? [] : (batchTargetRes.data || []);

  const batchTargetsByBatch: Record<string, typeof batchTargets> = {};
  for (const t of batchTargets) {
    if (!batchTargetsByBatch[t.batch_id]) batchTargetsByBatch[t.batch_id] = [];
    batchTargetsByBatch[t.batch_id].push(t);
  }

  const _debugScope = {
    limitPerTable: DEBUG_LIMIT,
    leadsTruncated: leads.length >= DEBUG_LIMIT,
    assignmentsTruncated: assignments.length >= DEBUG_LIMIT,
    batchesTruncated: batches.length >= DEBUG_LIMIT,
    targetsTruncated: targets.length >= DEBUG_LIMIT,
    customersTruncated: customers.length >= DEBUG_LIMIT,
    note: 'Debug-tool: voor volledige analyses gebruik specifieke routes met filters.',
  };

  const assignmentsByLead: Record<string, typeof assignments> = {};
  for (const a of assignments) {
    if (!assignmentsByLead[a.lead_id]) assignmentsByLead[a.lead_id] = [];
    assignmentsByLead[a.lead_id].push(a);
  }

  const activeBatchesByBranch: Record<string, typeof batches> = {};
  for (const b of batches) {
    if (b.status !== 'active') continue;
    if (b.is_paid === false) continue;
    if (!activeBatchesByBranch[b.branch]) activeBatchesByBranch[b.branch] = [];
    activeBatchesByBranch[b.branch].push(b);
  }

  const targetsByCustomer: Record<string, typeof targets> = {};
  for (const t of targets) {
    if (!targetsByCustomer[t.customer_id]) targetsByCustomer[t.customer_id] = [];
    targetsByCustomer[t.customer_id].push(t);
  }

  const customerMap: Record<string, (typeof customers)[0]> = {};
  for (const c of customers) customerMap[c.id] = c;

  const leadDetails = leads.map(lead => {
    const leadAssignments = assignmentsByLead[lead.id] || [];
    const assignedCustomerIds = new Set(leadAssignments.map(a => a.customer_id));
    const hasCoords = lead.lat != null && lead.lng != null;

    const potentialMatches: {
      customer_id: string;
      customer_name: string;
      assigned: boolean;
      reason_not_assigned?: string;
      distance_km?: number;
      target_label?: string;
    }[] = [];

    const branchBatches = activeBatchesByBranch[lead.branch] || [];
    const allBranchBatches = batches.filter(b => b.branch === lead.branch);

    const relevantCustomerIds = new Set([
      ...branchBatches.map(b => b.customer_id),
      ...allBranchBatches.map(b => b.customer_id),
    ]);

    for (const custId of relevantCustomerIds) {
      const cust = customerMap[custId];
      if (!cust) continue;

      const isAssigned = assignedCustomerIds.has(custId);
      if (isAssigned) {
        const a = leadAssignments.find(x => x.customer_id === custId);
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: true,
          distance_km: a?.distance_km ?? undefined,
        });
        continue;
      }

      const leadProv = (lead as any).provincie as string | undefined;

      if (!hasCoords && !leadProv) {
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: 'Lead heeft geen coördinaten en geen provincie',
        });
        continue;
      }

      if (!cust.is_active) {
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: 'Klant is inactief',
        });
        continue;
      }

      const custBatch = branchBatches.find(b => b.customer_id === custId);
      if (!custBatch) {
        const completedBatch = allBranchBatches.find(b => b.customer_id === custId && b.status === 'completed');
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: completedBatch
            ? `Batch is vol (${completedBatch.leads_delivered}/${completedBatch.batch_size})`
            : 'Geen actieve batch voor deze branche',
        });
        continue;
      }

      if (custBatch.leads_delivered >= custBatch.batch_size) {
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: `Batch zit vol (${custBatch.leads_delivered}/${custBatch.batch_size})`,
        });
        continue;
      }

      // Batch-target-override: eigen targetgebieden van de batch overrulen de klant.
      const overrideTargets = (batchTargetsByBatch[custBatch.id] || []).filter(t => t.is_active !== false);
      const custTargets = overrideTargets.length > 0
        ? overrideTargets
        : (targetsByCustomer[custId] || []).filter(t => t.is_active);
      if (custTargets.length === 0) {
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: 'Geen actieve targetgebieden',
        });
        continue;
      }

      let provinceMatch: { label: string } | null = null;
      let closestTarget: { label: string; distance: number; radius: number } | null = null;

      for (const t of custTargets) {
        if ((t.target_type || 'radius') === 'province') {
          const provs: string[] = Array.isArray(t.provinces) ? t.provinces : [];
          if (leadMatchesAnyProvinceTarget(lead, provs)) {
            provinceMatch = { label: t.label };
          }
        } else if (hasCoords) {
          const dist = haversineKm(lead.lat!, lead.lng!, t.lat, t.lng);
          if (!closestTarget || dist < closestTarget.distance) {
            closestTarget = { label: t.label, distance: Math.round(dist * 10) / 10, radius: t.radius_km };
          }
        }
      }

      const radiusInRange = closestTarget && closestTarget.distance <= closestTarget.radius;
      const inRange = provinceMatch || radiusInRange;

      if (inRange) {
        const leadAssignCount = leadAssignments.length;
        const matchLabel = provinceMatch
          ? `Binnen bereik (provincie "${leadProv}" in target "${provinceMatch.label}")`
          : `Binnen bereik (${closestTarget!.distance}km)`;
        let reason: string;
        if (leadAssignCount >= 3) {
          reason = `${matchLabel} maar lead heeft al max 3 toewijzingen`;
        } else {
          reason = `${matchLabel}. Wacht op verdeling (klik "Verdeel leads" of wacht op cron).`;
        }
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: reason,
          distance_km: provinceMatch ? 0 : closestTarget!.distance,
          target_label: provinceMatch ? provinceMatch.label : closestTarget!.label,
        });
      } else if (closestTarget) {
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: `Buiten bereik: ${closestTarget.distance}km (max ${closestTarget.radius}km voor "${closestTarget.label}")`,
          distance_km: closestTarget.distance,
          target_label: closestTarget.label,
        });
      } else {
        const provTargets = custTargets.filter(t => (t.target_type || 'radius') === 'province');
        const radiusTargets = custTargets.filter(t => (t.target_type || 'radius') === 'radius');
        let reason: string;
        if (provTargets.length > 0 && radiusTargets.length > 0) {
          reason = hasCoords
            ? `Buiten bereik radius-targets en provincie "${leadProv || '(leeg)'}" niet in provincie-targets`
            : `Geen coördinaten voor radius-targets en provincie "${leadProv || '(leeg)'}" niet in provincie-targets`;
        } else if (provTargets.length > 0) {
          reason = `Provincie "${leadProv || '(leeg)'}" niet in targets`;
        } else {
          reason = 'Lead heeft geen coördinaten voor radius-targets';
        }
        potentialMatches.push({
          customer_id: custId,
          customer_name: cust.name,
          assigned: false,
          reason_not_assigned: reason,
        });
      }
    }

    return {
      id: lead.id,
      naam_klant: lead.naam_klant,
      email: lead.email,
      branch: lead.branch,
      postcode: lead.postcode,
      plaatsnaam: lead.plaatsnaam,
      has_coords: hasCoords,
      lat: lead.lat,
      lng: lead.lng,
      land: lead.land,
      created_at: lead.created_at,
      assignment_count: leadAssignments.length,
      assignments: leadAssignments.map(a => ({
        id: a.id,
        customer_name: (a.customers as any)?.name || 'Onbekend',
        customer_id: a.customer_id,
        distance_km: a.distance_km,
        assigned_at: a.assigned_at,
      })),
      potential_matches: potentialMatches,
    };
  });

  const summary = {
    total_leads: leads.length,
    leads_with_coords: leads.filter(l => l.lat != null && l.lng != null).length,
    leads_without_coords: leads.filter(l => l.lat == null || l.lng == null).length,
    total_assignments: assignments.length,
    active_batches: batches.filter(b => b.status === 'active').length,
    completed_batches: batches.filter(b => b.status === 'completed').length,
  };

  return NextResponse.json({ summary, leads: leadDetails, _debugScope });
}
