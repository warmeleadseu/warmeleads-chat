/**
 * Eenmalig: max 20 thuisbatterij-leads van afgelopen 3 dagen binnen 50km
 * van Utrecht, met geldig telefoonnummer en nog NIET toegewezen aan
 * "Laadbudget", alsnog inladen in de actieve Laadbudget-batch.
 *
 * - Negeert leads_per_day cap (op verzoek van klant).
 * - Alleen leads met phone_valid != false.
 * - Lat/lng moeten gezet zijn (anders kan radius niet berekend worden).
 * - Telt nieuwe assignments bij batch op via syncBatchDelivered().
 *
 * Vereist .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 *   npx tsx scripts/distribute-laadbudget-utrecht-3d.ts --dry-run
 *   npx tsx scripts/distribute-laadbudget-utrecht-3d.ts
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createServerClient } from '../src/lib/supabase';
import { syncBatchDelivered } from '../src/lib/batchSync';

config({ path: resolve(process.cwd(), '.env.local') });

const BRANCH = 'thuisbatterij';
const RADIUS_KM = 50;
const DAYS_BACK = 3;
const MAX_LEADS = 20;
// Utrecht-centrum (Domplein):
const UTRECHT_LAT = 52.0907;
const UTRECHT_LNG = 5.1214;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).');
    process.exit(1);
  }

  const supabase = createServerClient();

  // ── 1. Laadbudget-klant vinden ──
  const { data: customerRows } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', '%laadbudget%')
    .limit(5);
  if (!customerRows || customerRows.length === 0) {
    console.error('Geen klant gevonden die matcht op "laadbudget".');
    process.exit(1);
  }
  if (customerRows.length > 1) {
    console.warn('Meerdere matches op "laadbudget":', customerRows.map(c => `${c.name} (${c.id})`).join(', '));
  }
  const customer = customerRows[0];
  console.log(`Klant: ${customer.name} (${customer.id})`);

  // ── 2. Actieve thuisbatterij-batch zoeken ──
  const { data: batches, error: bErr } = await supabase
    .from('customer_batches')
    .select('id, status, branch, batch_size, leads_delivered, leads_delivered_external, leads_per_day, is_paid, batch_kind, created_at')
    .eq('customer_id', customer.id)
    .eq('branch', BRANCH)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .neq('is_paid', false)
    .order('created_at', { ascending: true });
  if (bErr) {
    console.error('Batches ophalen mislukt:', bErr.message);
    process.exit(1);
  }
  if (!batches || batches.length === 0) {
    console.error(`Geen actieve ${BRANCH}-batch voor ${customer.name}.`);
    process.exit(1);
  }
  if (batches.length > 1) {
    console.warn(`Meerdere actieve ${BRANCH}-batches; gebruik de oudste: ${batches[0].id}`);
  }
  const batch = batches[0];
  console.log(
    `Batch: ${batch.id} · ${batch.leads_delivered}/${batch.batch_size} geleverd (extern=${batch.leads_delivered_external ?? 0}, per_day=${batch.leads_per_day})`,
  );

  // ── 3. Leads van laatste 3 dagen binnen 50km van Utrecht ──
  const since = new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();
  const { data: leadsRaw, error: lErr } = await supabase
    .from('leads')
    .select('id, branch, lat, lng, phone_valid, provincie, plaatsnaam, postcode, created_at, naam_klant, bron')
    .eq('branch', BRANCH)
    .gte('created_at', since)
    .not('lat', 'is', null)
    .not('lng', 'is', null);
  if (lErr || !leadsRaw) {
    console.error('Leads ophalen mislukt:', lErr?.message);
    process.exit(1);
  }

  const inRadius = leadsRaw
    .map(l => ({ ...l, distance_km: haversineKm(Number(l.lat), Number(l.lng), UTRECHT_LAT, UTRECHT_LNG) }))
    .filter(l => l.distance_km <= RADIUS_KM)
    .sort((a, b) => a.distance_km - b.distance_km);

  const validPhone = inRadius.filter(l => l.phone_valid !== false);
  const skippedInvalidPhone = inRadius.length - validPhone.length;

  if (validPhone.length === 0) {
    console.log(`Geen thuisbatterij-leads binnen ${RADIUS_KM}km van Utrecht (laatste ${DAYS_BACK}d) met geldig nummer.`);
    process.exit(0);
  }

  // ── 4. Bestaande assignments voor deze klant filteren ──
  const leadIds = validPhone.map(l => l.id);
  const { data: existingAssigns } = await supabase
    .from('lead_assignments')
    .select('lead_id, customer_id')
    .in('lead_id', leadIds)
    .eq('customer_id', customer.id);
  const alreadyForCustomer = new Set((existingAssigns || []).map(r => r.lead_id));

  const eligible = validPhone.filter(l => !alreadyForCustomer.has(l.id));
  console.log(
    `Binnen radius: ${inRadius.length} | geldig nummer: ${validPhone.length}` +
    (skippedInvalidPhone > 0 ? ` (${skippedInvalidPhone} ongeldig overgeslagen)` : '') +
    ` | nog niet bij ${customer.name}: ${eligible.length}`,
  );

  if (eligible.length === 0) {
    console.log('Niets te doen — alle eligible leads zijn al bij deze klant.');
    process.exit(0);
  }

  // ── 5. Top-N nemen (sortering: dichtstbij Utrecht eerst) ──
  const toAssign = eligible.slice(0, MAX_LEADS);
  console.log(`Plan: ${toAssign.length} leads toewijzen aan batch ${batch.id} (negeer dagcap).`);
  for (const l of toAssign) {
    console.log(
      `  ${l.id} · ${l.distance_km.toFixed(1)}km · ${l.plaatsnaam ?? '?'} (${l.postcode ?? '-'}) · ${l.naam_klant ?? '?'} · bron=${l.bron} · ${l.created_at}`,
    );
  }

  if (dryRun) {
    console.log('Dry-run — geen wijzigingen geschreven.');
    process.exit(0);
  }

  // ── 6. Insert assignments ──
  let ok = 0;
  const failed: Array<{ id: string; msg: string }> = [];
  for (const lead of toAssign) {
    const { error } = await supabase.from('lead_assignments').insert({
      lead_id: lead.id,
      customer_id: customer.id,
      batch_id: batch.id,
      distance_km: Math.round(lead.distance_km * 10) / 10,
    });
    if (error) {
      if (error.code === '23505') {
        // Race / dubbel — al toegewezen, niet als fout tellen
        console.log(`— ${lead.id} (dubbel — bestond al)`);
      } else {
        failed.push({ id: lead.id, msg: error.message });
        console.log(`FAIL ${lead.id}: ${error.message}`);
      }
      continue;
    }
    ok++;
    console.log(`OK ${lead.id} → batch ${batch.id} (${lead.distance_km.toFixed(1)}km)`);
  }

  // ── 7. Batch-tellers bijwerken ──
  await syncBatchDelivered(supabase, batch.id);

  const { data: refreshed } = await supabase
    .from('customer_batches')
    .select('id, batch_size, leads_delivered, status')
    .eq('id', batch.id)
    .maybeSingle();

  console.log(
    `\nKlaar: ${ok} nieuwe assignments naar ${customer.name}` +
    (failed.length > 0 ? `, ${failed.length} mislukt` : '') +
    `. Batch nu: delivered=${refreshed?.leads_delivered} / batch_size=${refreshed?.batch_size} · status=${refreshed?.status}`,
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
