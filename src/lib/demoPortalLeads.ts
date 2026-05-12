import { createServerClient } from '@/lib/supabase';

const PAGE_SIZE = 1000;

/** Vast aantal voorbeeldleads in het pre-pay portaal (template `bron = demo`). */
export const DEMO_PORTAL_ASSIGNMENT_CAP = 4;

const DEMO_STATUS_DISTRIBUTION: { status: string; notities: string | null }[] = [
  { status: 'nieuw', notities: null },
  { status: 'nieuw', notities: null },
  { status: 'gecontacteerd', notities: 'Terugbellen na 17:00' },
  { status: 'offerte', notities: 'Interesse in 10kWh systeem' },
];

type Supabase = ReturnType<typeof createServerClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery<T>(query: any): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return all;
}

/** Distinct branch slugs that exist on global demo template leads. */
export async function fetchDemoTemplateBranchSlugs(supabase: Supabase): Promise<Set<string>> {
  const branches = new Set<string>();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('leads')
      .select('branch')
      .eq('bron', 'demo')
      .is('customer_id', null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (!data?.length) break;
    data.forEach((r: { branch: string | null }) => {
      if (r.branch) branches.add(r.branch);
    });
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return branches;
}

/**
 * Branches to use when attaching demo template leads to a customer.
 * Uses customer.branches when they overlap demo templates; otherwise all template branches
 * (covers empty branches, typos, or outdated slugs on demo accounts).
 */
export async function resolveBranchesForDemoTemplate(
  supabase: Supabase,
  customerBranches: string[] | null | undefined,
): Promise<string[]> {
  const available = await fetchDemoTemplateBranchSlugs(supabase);
  if (available.size === 0) return [];

  const requested = [...new Set((customerBranches || []).map(b => String(b).trim()).filter(Boolean))];
  if (requested.length > 0) {
    const hit = requested.filter(b => available.has(b));
    if (hit.length > 0) return hit;
  }
  return Array.from(available);
}

async function fetchDemoTemplateLeadsForBranches(
  supabase: Supabase,
  branches: string[],
): Promise<{ id: string; branch: string }[]> {
  if (branches.length === 0) return [];
  const out: { id: string; branch: string }[] = [];
  // .in() size limits — chunk branch list if ever huge
  const BR_CHUNK = 50;
  for (let i = 0; i < branches.length; i += BR_CHUNK) {
    const slice = branches.slice(i, i + BR_CHUNK);
    const batch = await paginateQuery<{ id: string; branch: string }>(
      supabase.from('leads').select('id, branch').eq('bron', 'demo').is('customer_id', null).in('branch', slice),
    );
    out.push(...batch);
  }
  return out;
}

/**
 * Replace all demo-source assignments for this customer with the current template set.
 * Idempotent; fixes empty seeds, branch mismatches, and orphaned lead_ids.
 */
export async function syncDemoLeadAssignmentsForCustomer(
  supabase: Supabase,
  customerId: string,
  customerBranches: string[] | null | undefined,
): Promise<number> {
  const branches = await resolveBranchesForDemoTemplate(supabase, customerBranches);
  const demoLeads = await fetchDemoTemplateLeadsForBranches(supabase, branches);
  if (demoLeads.length === 0) return 0;

  const sorted = [...demoLeads].sort((a, b) => {
    const byBranch = String(a.branch).localeCompare(String(b.branch), 'nl');
    if (byBranch !== 0) return byBranch;
    return a.id.localeCompare(b.id);
  });
  const capped = sorted.slice(0, DEMO_PORTAL_ASSIGNMENT_CAP);

  const { error: delErr } = await supabase
    .from('lead_assignments')
    .delete()
    .eq('customer_id', customerId)
    .eq('source', 'demo');
  if (delErr) {
    console.error('[demoPortalLeads] delete demo assignments failed:', delErr.message, { customerId });
    return 0;
  }

  const rows = capped.map((lead, i) => {
    const preset = DEMO_STATUS_DISTRIBUTION[i % DEMO_STATUS_DISTRIBUTION.length];
    return {
      lead_id: lead.id,
      customer_id: customerId,
      batch_id: null,
      distance_km: Math.round((3 + Math.random() * 25) * 10) / 10,
      source: 'demo',
      status: preset.status,
      notities: preset.notities,
    };
  });

  const { error: insErr } = await supabase.from('lead_assignments').insert(rows);
  if (insErr) {
    console.error('[demoPortalLeads] insert demo assignments failed:', insErr.message, { customerId });
    return 0;
  }
  return rows.length;
}

const IN_CHUNK = 500;

async function countBronDemoLeadsInIds(supabase: Supabase, leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < leadIds.length; i += IN_CHUNK) {
    const chunk = leadIds.slice(i, i + IN_CHUNK);
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('id', chunk)
      .eq('bron', 'demo');
    total += count || 0;
  }
  return total;
}

/**
 * Ensures demo customers have valid demo assignments (login + API recovery).
 * Does not run full template diff on every request — only fixes empty or clearly broken state.
 */
export async function repairDemoAssignmentsIfNeeded(
  supabase: Supabase,
  customerId: string,
  customerBranches: string[] | null | undefined,
): Promise<void> {
  const { count: rawCount } = await supabase
    .from('lead_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('source', 'demo');

  if (!rawCount) {
    await syncDemoLeadAssignmentsForCustomer(supabase, customerId, customerBranches);
    return;
  }

  if ((rawCount ?? 0) > DEMO_PORTAL_ASSIGNMENT_CAP) {
    await syncDemoLeadAssignmentsForCustomer(supabase, customerId, customerBranches);
    return;
  }

  const assignRows = await paginateQuery<{ lead_id: string }>(
    supabase.from('lead_assignments').select('lead_id').eq('customer_id', customerId).eq('source', 'demo'),
  );
  const uniqueIds = [...new Set(assignRows.map(r => r.lead_id))];
  const valid = await countBronDemoLeadsInIds(supabase, uniqueIds);
  if (valid === 0 || valid < uniqueIds.length) {
    await syncDemoLeadAssignmentsForCustomer(supabase, customerId, customerBranches);
  }
}
