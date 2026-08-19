/**
 * READ-ONLY: welke thuisbatterij-leads van de afgelopen 72 uur zouden bij klant
 * 'Bespaarr' kunnen worden ingeladen? Toont alle leads die aan hun voorwaarden
 * voldoen (targetgebieden — incl. eventuele batch-target-override —, geldig
 * telefoonnummer, batch-lead_filters, nog niet toegewezen aan Bespaarr).
 *
 * Dit script WIJZIGT NIETS. Het laadt niets in en schrijft niet naar de database.
 *
 * Credentials (zelfde als andere scripts):
 *   set -a && source .env.vercel.prod.full && set +a   # of .env.local
 *   npx tsx scripts/list-bespaarr-eligible-thuisbatterij.ts
 *
 * Optioneel een andere klant/branche/venster:
 *   CUSTOMER="Bespaarr" BRANCH="thuisbatterij" HOURS=72 npx tsx scripts/list-bespaarr-eligible-thuisbatterij.ts
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { leadMatchesAnyProvinceTarget } from '../src/lib/provinceTargetMatch';
import { targetCountryAllowsLead } from '../src/lib/targetCountryMatch';
import { batchIsAtCapacity, isCappedDeliveryModel } from '../src/lib/batchDeliveryModel';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const CUSTOMER_QUERY = process.env.CUSTOMER || 'Bespaarr';
const BRANCH = process.env.BRANCH || 'thuisbatterij';
const HOURS = Number(process.env.HOURS || '72');

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env ontbreekt. Doe eerst: set -a && source .env.vercel.prod.full && set +a',
    );
  }
  return createClient(url, key);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type TargetRow = {
  label: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
  target_type: string | null;
  provinces: string[] | null;
  country: string | null;
  is_active: boolean | null;
};

interface LeadFilter { field: string; operator: string; value?: string; values?: string[] }

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
  land: string | null;
  phone_valid: boolean | null;
  quality_score: number | null;
  bron: string | null;
  created_at: string;
  wervingsdatum: string | null;
  custom_fields: Record<string, unknown> | null;
};

function getLeadFieldValue(lead: LeadRow, fieldKey: string): string | null {
  if (fieldKey === 'quality_score') return lead.quality_score != null ? String(lead.quality_score) : null;
  if (fieldKey === 'phone_valid') return lead.phone_valid != null ? String(lead.phone_valid) : null;
  const direct = (lead as Record<string, unknown>)[fieldKey];
  if (direct != null && direct !== '') return String(direct);
  const cf = lead.custom_fields?.[fieldKey];
  if (cf != null && cf !== '') return String(cf);
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

function matchesAllFilters(lead: LeadRow, filters: LeadFilter[]): boolean {
  if (!filters.length) return true;
  return filters.every((f) => matchesFilter(lead, f));
}

/** Geeft de best matchende target terug (of null als de lead buiten alle targets valt). */
function matchTargets(lead: LeadRow, targets: TargetRow[]): { label: string; kind: string; distance: number | null } | null {
  const hasCoords = lead.lat != null && lead.lng != null;
  let best: { label: string; kind: string; distance: number | null; radius: number } | null = null;
  for (const t of targets) {
    if (t.is_active === false) continue;
    if (!targetCountryAllowsLead(t, lead)) continue;
    if ((t.target_type || 'radius') === 'province') {
      const provs = Array.isArray(t.provinces) ? t.provinces : [];
      if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) {
        if (!best || 999 < best.radius) best = { label: t.label || 'provincie', kind: 'provincie', distance: null, radius: 999 };
      }
    } else if (hasCoords && t.lat != null && t.lng != null && t.radius_km != null) {
      const dist = haversineKm(lead.lat!, lead.lng!, t.lat, t.lng);
      if (dist <= t.radius_km) {
        if (!best || t.radius_km < best.radius) {
          best = { label: t.label || 'radius', kind: `radius ${t.radius_km}km`, distance: Math.round(dist * 10) / 10, radius: t.radius_km };
        }
      }
    }
  }
  return best ? { label: best.label, kind: best.kind, distance: best.distance } : null;
}

async function main() {
  const sb = supabase();

  // 1. Klant Bespaarr resolven
  const { data: custs } = await sb
    .from('customers')
    .select('id, name, is_active, exclude_customers')
    .ilike('name', `%${CUSTOMER_QUERY}%`);
  if (!custs || custs.length === 0) throw new Error(`Geen klant gevonden voor "${CUSTOMER_QUERY}"`);
  if (custs.length > 1) {
    console.log('Meerdere klanten matchen; kies met CUSTOMER="exacte naam":');
    for (const c of custs) console.log(`  - ${c.name} (${c.id})`);
  }
  const customer = custs[0];
  console.log(`\nKlant: ${customer.name} (${customer.id})  actief=${customer.is_active}`);

  // 2. Actieve, betaalde thuisbatterij-batches die leads kunnen ontvangen
  const { data: batchesRaw } = await sb
    .from('customer_batches')
    .select('id, branch, batch_size, leads_delivered, leads_delivered_external, lead_filters, status, is_paid, starts_at, delivery_model, batch_kind, created_at')
    .eq('customer_id', customer.id)
    .eq('branch', BRANCH)
    .eq('status', 'active')
    .neq('is_paid', false)
    .order('created_at', { ascending: true });
  const batches = (batchesRaw || []).filter(b => b.batch_kind === 'leads' || b.batch_kind === 'bulk_leads' || b.batch_kind == null);

  if (batches.length === 0) {
    console.log(`\n⚠️  Bespaarr heeft GEEN actieve, betaalde ${BRANCH}-batch. Er kan dus nu niets worden ingeladen (los van targetmatch).`);
  }

  // 3. Effectieve targets per batch: batch_targets (override) anders customer_targets
  const { data: custTargets } = await sb
    .from('customer_targets')
    .select('label, lat, lng, radius_km, target_type, provinces, country, is_active')
    .eq('customer_id', customer.id)
    .eq('is_active', true);

  const batchIds = batches.map(b => b.id);
  let batchTargetsByBatch: Record<string, TargetRow[]> = {};
  if (batchIds.length) {
    const { data: bt } = await sb
      .from('batch_targets')
      .select('batch_id, label, lat, lng, radius_km, target_type, provinces, country, is_active')
      .in('batch_id', batchIds)
      .eq('is_active', true);
    for (const t of (bt || []) as (TargetRow & { batch_id: string })[]) {
      (batchTargetsByBatch[t.batch_id] ||= []).push(t);
    }
  }

  const effectiveTargetsForBatch = (batchId: string): { targets: TargetRow[]; source: string } => {
    const override = batchTargetsByBatch[batchId];
    if (override && override.length > 0) return { targets: override, source: 'batch-override' };
    return { targets: (custTargets || []) as TargetRow[], source: 'klant-targets' };
  };

  console.log('\n--- Actieve thuisbatterij-batches van Bespaarr ---');
  for (const b of batches) {
    const { targets, source } = effectiveTargetsForBatch(b.id);
    const cap = isCappedDeliveryModel(b.delivery_model, b.batch_kind) ? b.batch_size : '∞';
    const delivered = (b.leads_delivered ?? 0);
    const full = batchIsAtCapacity(b as { delivery_model?: string; batch_kind?: string; batch_size: number; leads_delivered: number | null });
    const tlabels = targets.map(t => t.label || (t.target_type === 'province' ? (t.provinces || []).join('/') : 'radius')).join(', ');
    console.log(`  batch ${b.id.slice(0, 8)}… kind=${b.batch_kind} ${delivered}/${cap}${full ? ' [VOL]' : ''} | targets(${source}): ${tlabels || 'geen'}`);
  }

  if (!custTargets?.length && Object.keys(batchTargetsByBatch).length === 0) {
    console.log('\n⚠️  Bespaarr heeft geen actieve targetgebieden → distributie matcht geen leads.');
  }

  // 4. Leads van de afgelopen HOURS uur voor de branche
  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000).toISOString();
  const { data: leads } = await sb
    .from('leads')
    .select('id, naam_klant, email, telefoonnummer, postcode, plaatsnaam, provincie, lat, lng, land, phone_valid, quality_score, bron, created_at, wervingsdatum, custom_fields')
    .eq('branch', BRANCH)
    .gte('created_at', since)
    .neq('bron', 'demo')
    .order('created_at', { ascending: false });

  const allLeads = (leads || []) as LeadRow[];
  console.log(`\nLeads (${BRANCH}) laatste ${HOURS}u: ${allLeads.length}`);

  // 5. Al aan Bespaarr toegewezen leads uitsluiten
  const leadIds = allLeads.map(l => l.id);
  const assignedToBespaarr = new Set<string>();
  for (let i = 0; i < leadIds.length; i += 300) {
    const chunk = leadIds.slice(i, i + 300);
    if (!chunk.length) break;
    const { data: asg } = await sb
      .from('lead_assignments')
      .select('lead_id')
      .eq('customer_id', customer.id)
      .in('lead_id', chunk);
    for (const a of asg || []) assignedToBespaarr.add(a.lead_id);
  }

  // 6. Evalueer elke lead
  const eligible: { lead: LeadRow; match: { label: string; kind: string; distance: number | null }; batchId: string }[] = [];
  const reasons: Record<string, number> = { geen_telnr: 0, geen_geo: 0, buiten_targets: 0, filter_mismatch: 0, al_toegewezen: 0, geen_batch: 0 };

  for (const lead of allLeads) {
    if (assignedToBespaarr.has(lead.id)) { reasons.al_toegewezen++; continue; }
    if (lead.phone_valid === false) { reasons.geen_telnr++; continue; }
    const hasGeo = (lead.lat != null && lead.lng != null) || !!lead.provincie;
    if (!hasGeo) { reasons.geen_geo++; continue; }
    if (batches.length === 0) { reasons.geen_batch++; continue; }

    let matchedForLead: { label: string; kind: string; distance: number | null; batchId: string } | null = null;
    for (const b of batches) {
      const { targets } = effectiveTargetsForBatch(b.id);
      const m = matchTargets(lead, targets);
      if (!m) continue;
      const filters: LeadFilter[] = Array.isArray(b.lead_filters) ? (b.lead_filters as LeadFilter[]) : [];
      if (!matchesAllFilters(lead, filters)) continue;
      if (!matchedForLead || (m.distance ?? 9999) < (matchedForLead.distance ?? 9999)) {
        matchedForLead = { ...m, batchId: b.id };
      }
    }

    if (!matchedForLead) {
      // Onderscheid buiten-targets vs filter-mismatch (informatief)
      const anyTargetMatch = batches.some(b => matchTargets(lead, effectiveTargetsForBatch(b.id).targets));
      if (anyTargetMatch) reasons.filter_mismatch++; else reasons.buiten_targets++;
      continue;
    }
    eligible.push({ lead, match: matchedForLead, batchId: matchedForLead.batchId });
  }

  // 7. Resultaat
  console.log(`\n=== ${eligible.length} lead(s) voldoen aan Bespaarr's voorwaarden (laatste ${HOURS}u) ===\n`);
  for (const e of eligible) {
    const l = e.lead;
    const loc = [l.plaatsnaam, l.postcode].filter(Boolean).join(' ') || l.provincie || '?';
    const phone = l.phone_valid === true ? 'tel ✓' : 'tel ?(niet gevalideerd)';
    const dist = e.match.distance != null ? `${e.match.distance}km` : e.match.kind;
    console.log(`  ✓ ${l.created_at.slice(0, 16).replace('T', ' ')} | ${l.naam_klant || '—'} | ${loc} | ${l.land || 'NL'} | ${phone} | match: ${e.match.label} (${dist})`);
  }

  console.log('\n--- Niet in aanmerking (samenvatting) ---');
  console.log(`  Al toegewezen aan Bespaarr:     ${reasons.al_toegewezen}`);
  console.log(`  Ongeldig telefoonnummer:        ${reasons.geen_telnr}`);
  console.log(`  Geen geo (coords/provincie):    ${reasons.geen_geo}`);
  console.log(`  Buiten targetgebieden:          ${reasons.buiten_targets}`);
  console.log(`  Binnen target, filter mismatch: ${reasons.filter_mismatch}`);
  if (reasons.geen_batch) console.log(`  Geen actieve batch:             ${reasons.geen_batch}`);

  // 8. Optioneel daadwerkelijk toewijzen (APPLY=1). Repliceert de admin-bulk-assign:
  //    insert lead_assignments (source='bulk_assign', batch_id) + leads_delivered bijwerken
  //    + audit-log. Bespaarr heeft geen CRM/Sheets/webhook-integraties, dus er is geen
  //    aanvullende levering nodig (onLeadAssignedToCustomer zou een no-op zijn).
  if (process.env.APPLY === '1') {
    if (eligible.length === 0) {
      console.log('\n(APPLY=1 — maar er zijn 0 leads om toe te wijzen)');
      return;
    }
    console.log(`\n=== APPLY=1 — ${eligible.length} lead(s) toewijzen aan ${customer.name} ===`);

    // Respecteer batch-capaciteit per batch.
    const insertedByBatch: Record<string, number> = {};
    let inserted = 0;
    const affectedBatches = new Set<string>();

    for (const e of eligible) {
      const b = batches.find(x => x.id === e.batchId);
      if (!b) continue;
      const capped = isCappedDeliveryModel(b.delivery_model, b.batch_kind);
      if (capped) {
        const already = (b.leads_delivered ?? 0) + ((b as { leads_delivered_external?: number }).leads_delivered_external ?? 0) + (insertedByBatch[b.id] || 0);
        if (already >= b.batch_size) {
          console.log(`  ⚠️  batch ${b.id.slice(0, 8)}… is vol (${already}/${b.batch_size}) — ${e.lead.naam_klant || e.lead.id} overgeslagen`);
          continue;
        }
      }
      const { error: insErr } = await sb.from('lead_assignments').insert({
        lead_id: e.lead.id,
        customer_id: customer.id,
        batch_id: e.batchId,
        distance_km: e.match.distance,
        source: 'bulk_assign',
      });
      if (insErr) {
        console.log(`  ✗ ${e.lead.naam_klant || e.lead.id}: ${insErr.message}`);
        continue;
      }
      inserted++;
      insertedByBatch[e.batchId] = (insertedByBatch[e.batchId] || 0) + 1;
      affectedBatches.add(e.batchId);
      console.log(`  ✓ toegewezen: ${e.lead.naam_klant || e.lead.id} → batch ${e.batchId.slice(0, 8)}…`);
    }

    // leads_delivered opnieuw synchroniseren (recount + externe offset), zoals syncBatchDelivered.
    for (const batchId of affectedBatches) {
      const { count } = await sb
        .from('lead_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('batch_id', batchId);
      const b = batches.find(x => x.id === batchId);
      const external = (b as { leads_delivered_external?: number } | undefined)?.leads_delivered_external ?? 0;
      const delivered = (count || 0) + external;
      await sb.from('customer_batches').update({ leads_delivered: delivered }).eq('id', batchId);
      console.log(`  → batch ${batchId.slice(0, 8)}… leads_delivered = ${delivered}`);
    }

    await sb.from('audit_log').insert({
      admin_id: null,
      admin_name: 'script (handmatige inlaad)',
      action: 'bulk_assign_leads',
      entity_type: 'lead',
      entity_id: null,
      details: {
        customer_id: customer.id,
        customer_name: customer.name,
        scope: 'selected',
        branch: BRANCH,
        window_hours: HOURS,
        assigned: inserted,
        via: 'list-bespaarr-eligible-thuisbatterij.ts APPLY=1',
      },
      ip_address: null,
    });

    console.log(`\n✅ ${inserted} lead(s) daadwerkelijk toegewezen aan ${customer.name} (audit-log geschreven).`);
    return;
  }

  console.log('\n(read-only — er is niets ingeladen of gewijzigd; gebruik APPLY=1 om toe te wijzen)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
