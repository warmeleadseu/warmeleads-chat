import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const CID = 'aae97e7d-ae4a-40b7-b279-a56243999c7c';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const sb = createClient(url, key);

  // 1. Direct leads.customer_id (legacy portal path)
  const { data: directLeads, count: directCount } = await sb
    .from('leads')
    .select('id, naam_klant, branch, plaatsnaam, provincie, bron, status, wervingsdatum, created_at, bulk_export_count', { count: 'exact' })
    .eq('customer_id', CID)
    .order('created_at', { ascending: false });

  console.log(`=== leads.customer_id = Oevering (${directCount}) ===`);
  const byBranch: Record<string, number> = {};
  for (const l of directLeads || []) {
    byBranch[l.branch || '?'] = (byBranch[l.branch || '?'] || 0) + 1;
  }
  console.log('By branch:', byBranch);

  const weird = ['truck_lease', 'zakelijke_batterij', 'airco', 'zonnepanelen'];
  const wrong = (directLeads || []).filter(l => !['thuisbatterij', null].includes(l.branch) && l.branch !== 'thuisbatterij');
  console.log(`\nWrong branch leads (${wrong.length}):`);
  for (const l of wrong.slice(0, 30)) {
    console.log(JSON.stringify({ naam: l.naam_klant, branch: l.branch, plaats: l.plaatsnaam, bron: l.bron, bulk_export_count: l.bulk_export_count, id: l.id }));
  }

  // 2. lead_assignments all sources
  const { data: allAssign, count: assignCount } = await sb
    .from('lead_assignments')
    .select('id, lead_id, source, batch_id, assigned_at, leads(branch, naam_klant)', { count: 'exact' })
    .eq('customer_id', CID);
  console.log(`\n=== lead_assignments total (${assignCount}) ===`);
  const bySrc: Record<string, number> = {};
  for (const a of allAssign || []) {
    bySrc[a.source || 'null'] = (bySrc[a.source || 'null'] || 0) + 1;
  }
  console.log('By source:', bySrc);
  console.log(JSON.stringify(allAssign?.slice(0, 5), null, 2));

  // 3. lead_exports records
  const { data: exports } = await sb
    .from('lead_exports')
    .select('*')
    .eq('customer_id', CID)
    .order('created_at', { ascending: false });
  console.log(`\n=== lead_exports (${exports?.length}) ===`);
  for (const ex of exports || []) {
    console.log('\nExport:', ex.id, ex.created_at, 'count:', ex.lead_count, 'added_to_portal:', ex.added_to_portal);
    console.log('filters:', JSON.stringify(ex.filters));
    const leadIds = (ex.lead_ids as string[]) || [];
    if (leadIds.length) {
      const { data: exLeads } = await sb.from('leads').select('id, branch, naam_klant, plaatsnaam').in('id', leadIds.slice(0, 200));
      const eb: Record<string, number> = {};
      for (const l of exLeads || []) eb[l.branch || '?'] = (eb[l.branch || '?'] || 0) + 1;
      console.log('Lead branches in export:', eb);
      const wrongEx = (exLeads || []).filter(l => l.branch !== 'thuisbatterij');
      if (wrongEx.length) {
        console.log('WRONG in export sample:', wrongEx.slice(0, 10).map(l => ({ branch: l.branch, naam: l.naam_klant })));
      }
    }
  }

  // 4. bulk_export assignments for these lead ids
  const leadIds = (directLeads || []).map(l => l.id);
  if (leadIds.length) {
    const { data: bulkAssign } = await sb
      .from('lead_assignments')
      .select('lead_id, source, customer_id, batch_id')
      .in('lead_id', leadIds.slice(0, 500))
      .eq('source', 'bulk_export');
    console.log(`\n=== bulk_export assignments for Oevering direct leads (${bulkAssign?.length}) ===`);
    const byCust: Record<string, number> = {};
    for (const a of bulkAssign || []) byCust[a.customer_id] = (byCust[a.customer_id] || 0) + 1;
    console.log('By customer_id:', byCust);
  }

  // 5. assigned_customer_ids cache on leads
  const { data: cached } = await sb
    .from('leads')
    .select('id, branch, naam_klant, assigned_customer_ids')
    .contains('assigned_customer_ids', [CID])
    .limit(200);
  console.log(`\n=== leads.assigned_customer_ids contains Oevering (${cached?.length}) ===`);
  const cb: Record<string, number> = {};
  for (const l of cached || []) cb[l.branch || '?'] = (cb[l.branch || '?'] || 0) + 1;
  console.log('By branch:', cb);
}

main().catch(e => { console.error(e); process.exit(1); });
