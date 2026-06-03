/**
 * Wijs eligible thuisbatterij-leads toe aan Greenteam (extra toewijzing, mag al bij anderen).
 *
 *   set -a && source .env.vercel.prod.full && set +a
 *   npx tsx scripts/assign-greenteam-eligible-leads.ts 2026-05-26 2026-05-27
 *   npx tsx scripts/assign-greenteam-eligible-leads.ts 2026-05-26 2026-05-27 --execute
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { syncBatchDelivered } from '../src/lib/batchSync';
import { onLeadAssignedToCustomer } from '../src/lib/integrations/onLeadAssigned';
import { leadMatchesAnyProvinceTarget } from '../src/lib/provinceTargetMatch';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const EXECUTE = process.argv.includes('--execute');
const DATE_START = args[0] || '2026-05-26';
const DATE_END = args[1] || '2026-05-27';
const GREENTEAM_ID = '88db5950-4002-455e-a531-dba63c5b4bc2';

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

function periodEndIso(dateEnd: string): string {
  const end = new Date(`${dateEnd}T00:00:00+02:00`);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
}

function periodStartIso(dateStart: string): string {
  return new Date(`${dateStart}T00:00:00+02:00`).toISOString();
}

type LeadRow = {
  id: string;
  naam_klant: string | null;
  postcode: string | null;
  plaatsnaam: string | null;
  provincie: string | null;
  lat: number | null;
  lng: number | null;
  phone_valid: boolean | null;
  land: string | null;
};

type TargetRow = {
  target_type: string | null;
  provinces: string[] | null;
  lat: number;
  lng: number;
  radius_km: number;
};

function leadMatchesGreenteamTarget(lead: LeadRow, targets: TargetRow[]): boolean {
  const hasCoords = lead.lat != null && lead.lng != null;
  const hasProv = !!lead.provincie;
  if (!hasCoords && !hasProv) return false;

  for (const t of targets) {
    if ((t.target_type || 'radius') === 'province') {
      const provs = Array.isArray(t.provinces) ? t.provinces : [];
      if (provs.length > 0 && leadMatchesAnyProvinceTarget(lead, provs)) return true;
    } else if (hasCoords) {
      const dist = haversineKm(Number(lead.lat), Number(lead.lng), t.lat, t.lng);
      if (dist <= t.radius_km) return true;
    }
  }
  return false;
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const start = periodStartIso(DATE_START);
  const end = periodEndIso(DATE_END);

  const { data: periodLeads, error: lErr } = await sb
    .from('leads')
    .select(
      'id, naam_klant, postcode, plaatsnaam, provincie, lat, lng, phone_valid, land, created_at, wervingsdatum',
    )
    .eq('branch', 'thuisbatterij')
    .or(`and(created_at.gte.${start},created_at.lt.${end}),and(wervingsdatum.gte.${start},wervingsdatum.lt.${end})`);

  if (lErr) throw new Error(lErr.message);

  const byId = new Map<string, LeadRow>();
  for (const l of (periodLeads || []) as LeadRow[]) byId.set(l.id, l);
  const leads = [...byId.values()];

  const { data: targets } = await sb
    .from('customer_targets')
    .select('target_type, provinces, lat, lng, radius_km')
    .eq('customer_id', GREENTEAM_ID)
    .eq('is_active', true);

  const targetRows = (targets || []) as TargetRow[];
  const eligible = leads.filter(
    (l) => l.phone_valid !== false && leadMatchesGreenteamTarget(l, targetRows),
  );

  const leadIds = eligible.map((l) => l.id);
  const { data: existing } = await sb
    .from('lead_assignments')
    .select('lead_id')
    .in('lead_id', leadIds.length ? leadIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('customer_id', GREENTEAM_ID);

  const atGt = new Set((existing || []).map((r) => r.lead_id));
  const toAssign = eligible.filter((l) => !atGt.has(l.id));

  console.log(`Periode ${DATE_START} t/m ${DATE_END}: ${toAssign.length} leads te laden bij Greenteam`);

  const { data: batches } = await sb
    .from('customer_batches')
    .select(
      'id, batch_size, leads_delivered, created_at, starts_at, status',
    )
    .eq('customer_id', GREENTEAM_ID)
    .eq('branch', 'thuisbatterij')
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .order('created_at', { ascending: true });

  const now = new Date();
  const batch = (batches || []).find(
    (b) => !b.starts_at || new Date(b.starts_at as string) <= now,
  );
  if (!batch) {
    console.error('Geen actieve thuisbatterij-batch voor Greenteam');
    process.exit(1);
  }
  console.log(`Batch: ${batch.id} (${batch.leads_delivered ?? 0}/${batch.batch_size})`);

  for (const l of toAssign) {
    console.log(`  ${l.naam_klant || '—'} | ${l.postcode || ''} ${l.plaatsnaam || ''}`);
  }

  if (!EXECUTE) {
    console.log('\nDry-run — voeg --execute toe om in te laden.');
    return;
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of toAssign) {
    let distanceKm = 0;
    const radiusTarget = targetRows.find((t) => (t.target_type || 'radius') !== 'province');
    if (lead.lat != null && lead.lng != null && radiusTarget) {
      distanceKm =
        Math.round(
          haversineKm(Number(lead.lat), Number(lead.lng), radiusTarget.lat, radiusTarget.lng) * 10,
        ) / 10;
    }

    const { data: row, error } = await sb
      .from('lead_assignments')
      .insert({
        lead_id: lead.id,
        customer_id: GREENTEAM_ID,
        batch_id: batch.id,
        distance_km: distanceKm,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        skipped++;
        console.log(`— ${lead.id} (bestond al)`);
        continue;
      }
      failed++;
      console.error(`FAIL ${lead.id}:`, error.message);
      continue;
    }

    inserted++;
    onLeadAssignedToCustomer({
      customerId: GREENTEAM_ID,
      leadId: lead.id,
      assignmentId: row.id,
    });
    console.log(`OK ${lead.naam_klant} → Greenteam`);
  }

  await syncBatchDelivered(sb, batch.id);

  console.log(`\nKlaar: ${inserted} ingeladen, ${skipped} overgeslagen, ${failed} mislukt.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
