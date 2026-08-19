import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const sb = createClient(url, key);

  const { data: customers } = await sb.from('customers').select('id, name, email, branches').ilike('name', '%partof%');
  console.log('=== CUSTOMERS ===');
  console.log(JSON.stringify(customers, null, 2));
  if (!customers?.length) return;
  const cid = customers[0].id;

  const { data: targets } = await sb.from('customer_targets').select('*').eq('customer_id', cid);
  console.log('\n=== ALL CUSTOMER TARGETS ===');
  console.log(JSON.stringify(targets, null, 2));

  const { data: batches } = await sb
    .from('customer_batches')
    .select('id, branch, status, batch_kind, lookback_days, created_at, is_paid')
    .eq('customer_id', cid)
    .order('created_at', { ascending: false });
  console.log('\n=== BATCHES ===');
  console.log(JSON.stringify(batches, null, 2));

  const batchIds = (batches || []).map(b => b.id);
  if (batchIds.length) {
    const { data } = await sb.from('batch_targets').select('*').in('batch_id', batchIds);
    console.log('\n=== BATCH TARGETS ===');
    console.log(JSON.stringify(data, null, 2));
  }

  const { data: assignments } = await sb
    .from('lead_assignments')
    .select(
      'id, lead_id, batch_id, source, assigned_at, distance_km, leads(id, naam_klant, plaatsnaam, provincie, postcode, branch, lat, lng, created_at, phone_valid)',
    )
    .eq('customer_id', cid)
    .order('assigned_at', { ascending: false });

  const enschede = (assignments || []).filter(a => {
    const l = a.leads as Record<string, unknown> | null;
    if (!l) return false;
    const place = String(l.plaatsnaam || '').toLowerCase();
    const prov = String(l.provincie || '').toLowerCase();
    return place.includes('enschede') || prov.includes('overijssel');
  });
  console.log('\n=== ENSCHEDE / OVERIJSSEL ASSIGNMENTS ===');
  console.log(JSON.stringify(enschede, null, 2));

  const { data: bulkAudit } = await sb
    .from('audit_log')
    .select('action, details, created_at, admin_name')
    .eq('action', 'bulk_assign_leads')
    .order('created_at', { ascending: false })
    .limit(100);
  const partofBulk = (bulkAudit || []).filter(r => {
    const d = r.details as Record<string, unknown> | null;
    return d?.customer_id === cid || JSON.stringify(d || {}).toLowerCase().includes('partof');
  });
  console.log('\n=== BULK_ASSIGN AUDIT (Partof) ===');
  console.log(JSON.stringify(partofBulk, null, 2));

  // Sources breakdown for all assignments
  const bySource: Record<string, number> = {};
  for (const a of assignments || []) {
    const s = a.source || 'null';
    bySource[s] = (bySource[s] || 0) + 1;
  }
  console.log('\n=== ASSIGNMENT SOURCES ===');
  console.log(JSON.stringify(bySource, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
