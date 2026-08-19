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

  const { data: customers } = await sb
    .from('customers')
    .select('id, name, email, branches, is_active, portal_active, demo_mode, notes, created_at')
    .ilike('name', '%oevering%');

  console.log('=== CUSTOMERS matching Oevering ===');
  console.log(JSON.stringify(customers, null, 2));
  if (!customers?.length) return;

  for (const customer of customers) {
    const cid = customer.id;
    console.log(`\n${'='.repeat(60)}\nCUSTOMER: ${customer.name} (${cid})\n${'='.repeat(60)}`);
    console.log('branches:', customer.branches);

    const { data: targets } = await sb.from('customer_targets').select('*').eq('customer_id', cid);
    console.log('\n--- customer_targets ---');
    console.log(JSON.stringify(targets, null, 2));

    const { data: batches } = await sb
      .from('customer_batches')
      .select('id, branch, status, batch_kind, batch_size, leads_delivered, is_paid, lookback_days, created_at, notes, lead_filters')
      .eq('customer_id', cid)
      .order('created_at', { ascending: false });
    console.log('\n--- customer_batches ---');
    console.log(JSON.stringify(batches, null, 2));

    const batchIds = (batches || []).map(b => b.id);
    if (batchIds.length) {
      const { data: bt, error: btErr } = await sb.from('batch_targets').select('*').in('batch_id', batchIds);
      console.log('\n--- batch_targets ---', btErr ? btErr.message : '');
      console.log(JSON.stringify(bt, null, 2));
    }

    const { data: assignments } = await sb
      .from('lead_assignments')
      .select(
        'id, lead_id, batch_id, source, assigned_at, distance_km, customer_batches(branch, batch_kind), leads(id, naam_klant, plaatsnaam, provincie, postcode, branch, bron, status, created_at, phone_valid, meta_form_id, campaign_name)',
      )
      .eq('customer_id', cid)
      .order('assigned_at', { ascending: false });

    console.log(`\n--- lead_assignments (${assignments?.length ?? 0} total) ---`);

    const byLeadBranch: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byBatchBranch: Record<string, number> = {};
    const mismatches: Array<Record<string, unknown>> = [];

    const customerBranches = new Set((customer.branches as string[] | null) || []);

    for (const a of assignments || []) {
      const l = a.leads as Record<string, unknown> | null;
      const b = a.customer_batches as { branch?: string; batch_kind?: string } | null;
      const leadBranch = String(l?.branch || '?');
      const batchBranch = String(b?.branch || '?');
      const src = String(a.source || 'null');

      byLeadBranch[leadBranch] = (byLeadBranch[leadBranch] || 0) + 1;
      bySource[src] = (bySource[src] || 0) + 1;
      byBatchBranch[batchBranch] = (byBatchBranch[batchBranch] || 0) + 1;

      const branchMismatch = customerBranches.size > 0 && !customerBranches.has(leadBranch);
      const batchLeadMismatch = b?.branch && leadBranch !== '?' && b.branch !== leadBranch;

      if (branchMismatch || batchLeadMismatch) {
        mismatches.push({
          naam: l?.naam_klant,
          lead_branch: leadBranch,
          batch_branch: batchBranch,
          customer_branches: [...customerBranches],
          source: src,
          assigned_at: a.assigned_at,
          batch_id: a.batch_id,
          lead_id: a.lead_id,
          plaats: l?.plaatsnaam,
          bron: l?.bron,
        });
      }
    }

    console.log('\nBy LEAD branch:', JSON.stringify(byLeadBranch, null, 2));
    console.log('By assignment SOURCE:', JSON.stringify(bySource, null, 2));
    console.log('By BATCH branch:', JSON.stringify(byBatchBranch, null, 2));

    console.log('\n--- MISMATCHES (lead branch not in customer.branches OR lead branch != batch branch) ---');
    console.log(JSON.stringify(mismatches, null, 2));

    // Full list grouped by lead branch for weird ones
    const weird = ['truck_lease', 'zakelijke_batterij', 'airco', 'zonnepanelen', 'zonnepanelen_leads'];
    const weirdLeads = (assignments || []).filter(a => {
      const lb = (a.leads as any)?.branch;
      return weird.some(w => lb?.includes(w) || lb === w);
    });
    console.log('\n--- SUSPICIOUS BRANCH LEADS (detail) ---');
    for (const a of weirdLeads) {
      const l = a.leads as any;
      const b = a.customer_batches as any;
      console.log(JSON.stringify({
        naam: l?.naam_klant,
        lead_branch: l?.branch,
        batch_branch: b?.branch,
        source: a.source,
        assigned_at: a.assigned_at,
        batch_id: a.batch_id,
        lead_id: a.lead_id,
        plaats: l?.plaatsnaam,
        bron: l?.bron,
        campaign: l?.campaign_name,
      }, null, 2));
    }

    // Audit for bulk assign / export
    const { data: audit } = await sb
      .from('audit_log')
      .select('action, details, created_at, admin_name')
      .contains('details', { customer_id: cid })
      .order('created_at', { ascending: false })
      .limit(30);
    console.log('\n--- AUDIT (customer_id) ---');
    console.log(JSON.stringify(audit, null, 2));

    const { data: bulkAll } = await sb
      .from('audit_log')
      .select('action, details, created_at, admin_name')
      .in('action', ['bulk_assign_leads', 'export_leads', 'bulk_export_leads'])
      .order('created_at', { ascending: false })
      .limit(80);
    const bulkForCustomer = (bulkAll || []).filter(r => {
      const d = r.details as Record<string, unknown> | null;
      return d?.customer_id === cid || JSON.stringify(d || '').toLowerCase().includes('oevering');
    });
    console.log('\n--- BULK/EXPORT AUDIT ---');
    console.log(JSON.stringify(bulkForCustomer, null, 2));
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
