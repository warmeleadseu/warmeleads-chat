import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.vercel.prod.full'), override: true });

const CID = 'aae97e7d-ae4a-40b7-b279-a56243999c7c';
const BAD_EXPORT = '924bc134-39df-4bce-b60a-257d19e97a98';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: ex } = await sb.from('lead_exports').select('*').eq('id', BAD_EXPORT).single();
  const leadIds = (ex?.lead_ids as string[]) || [];

  const { data: leads } = await sb.from('leads').select('id, naam_klant, branch, plaatsnaam, provincie, wervingsdatum, bron, bulk_export_count').in('id', leadIds);

  const { data: assigns } = await sb
    .from('lead_assignments')
    .select('lead_id, source, assigned_at, batch_id')
    .eq('customer_id', CID)
    .in('lead_id', leadIds);

  const assignMap = new Map((assigns || []).map(a => [a.lead_id, a]));

  console.log('=== July 2 export — all 15 leads ===');
  for (const l of leads || []) {
    const a = assignMap.get(l.id);
    console.log(JSON.stringify({
      naam: l.naam_klant,
      branch: l.branch,
      plaats: l.plaatsnaam,
      provincie: l.provincie,
      wervingsdatum: l.wervingsdatum,
      assigned: !!a,
      source: a?.source,
      assigned_at: a?.assigned_at,
      batch_id: a?.batch_id,
    }));
  }

  // Summary all Oevering assignments by branch
  const { data: all } = await sb
    .from('lead_assignments')
    .select('source, leads(branch, naam_klant, plaatsnaam)')
    .eq('customer_id', CID);

  const summary: Record<string, { total: number; bulk: number; dist: number }> = {};
  for (const a of all || []) {
    const b = (a.leads as any)?.branch || '?';
    if (!summary[b]) summary[b] = { total: 0, bulk: 0, dist: 0 };
    summary[b].total++;
    if (a.source === 'bulk_export') summary[b].bulk++;
    if (a.source === 'distribution') summary[b].dist++;
  }
  console.log('\n=== All Oevering assignments by lead branch ===');
  console.log(JSON.stringify(summary, null, 2));

  const wrong = (all || []).filter(a => (a.leads as any)?.branch !== 'thuisbatterij');
  console.log(`\n=== Wrong-branch assignments (${wrong.length}) ===`);
  for (const a of wrong) {
    const l = a.leads as any;
    console.log(JSON.stringify({ naam: l?.naam_klant, branch: l?.branch, plaats: l?.plaatsnaam, source: a.source }));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
