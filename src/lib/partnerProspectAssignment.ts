import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_PARTNER_PROSPECT_AM_ID,
  PARTNER_PROSPECT_BRANCH_SLUG,
  PARTNER_PROSPECT_BRANCH_SLUGS,
  type PartnerProspectBranchSlug,
} from '@/lib/partnerProspectConstants';

export const PARTNER_PROSPECT_AM_CONFIG_KEY = 'partner_prospect_am_config' as const;

export type PartnerProspectAmStrategy = 'single' | 'round_robin' | 'weighted_random';

export interface PartnerProspectAmAssignee {
  admin_user_id: string;
  /** Alleen gebruikt bij `weighted_random`; default 1. */
  weight?: number;
}

export interface PartnerProspectAmBranchConfig {
  strategy: PartnerProspectAmStrategy;
  assignees: PartnerProspectAmAssignee[];
}

/** Per partner-branch-slug (`thuisbatterij_partners`, `airco_partners`, …). */
export type PartnerProspectAmConfigDoc = Record<string, PartnerProspectAmBranchConfig>;

export function defaultPartnerProspectAmConfigDoc(): PartnerProspectAmConfigDoc {
  const entry: PartnerProspectAmBranchConfig = {
    strategy: 'single',
    assignees: [{ admin_user_id: DEFAULT_PARTNER_PROSPECT_AM_ID, weight: 1 }],
  };
  return Object.fromEntries(
    PARTNER_PROSPECT_BRANCH_SLUGS.map(slug => [slug, { ...entry, assignees: [...entry.assignees] }]),
  ) as PartnerProspectAmConfigDoc;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Valideert structuur; mutatie niet — alleen voor API / opslaan. */
export function parsePartnerProspectAmConfigDoc(raw: string | null | undefined): PartnerProspectAmConfigDoc | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: PartnerProspectAmConfigDoc = {};
    for (const [branch, bc] of Object.entries(parsed as Record<string, unknown>)) {
      if (!branch.trim()) continue;
      if (!bc || typeof bc !== 'object' || Array.isArray(bc)) continue;
      const strategy = (bc as { strategy?: unknown }).strategy;
      if (strategy !== 'single' && strategy !== 'round_robin' && strategy !== 'weighted_random') continue;
      const assigneesRaw = (bc as { assignees?: unknown }).assignees;
      if (!Array.isArray(assigneesRaw) || assigneesRaw.length === 0) continue;
      const assignees: PartnerProspectAmAssignee[] = [];
      for (const a of assigneesRaw) {
        if (!a || typeof a !== 'object') continue;
        const id = String((a as { admin_user_id?: unknown }).admin_user_id || '').trim();
        if (!isUuid(id)) continue;
        const w = (a as { weight?: unknown }).weight;
        let weight = 1;
        if (typeof w === 'number' && Number.isFinite(w) && w >= 0) weight = w;
        else if (w != null && String(w).trim() !== '') {
          const n = Number(w);
          if (Number.isFinite(n) && n >= 0) weight = n;
        }
        assignees.push({ admin_user_id: id, weight });
      }
      if (assignees.length === 0) continue;
      out[branch.trim()] = { strategy, assignees };
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

async function loadConfigDoc(supabase: SupabaseClient): Promise<PartnerProspectAmConfigDoc | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', PARTNER_PROSPECT_AM_CONFIG_KEY)
    .maybeSingle();
  return parsePartnerProspectAmConfigDoc(data?.value ?? null);
}

function branchConfig(
  doc: PartnerProspectAmConfigDoc | null,
  branchSlug: PartnerProspectBranchSlug,
): PartnerProspectAmBranchConfig | null {
  if (!doc) return null;
  return doc[branchSlug] ?? doc[PARTNER_PROSPECT_BRANCH_SLUG] ?? null;
}

async function pickRoundRobin(
  supabase: SupabaseClient,
  branchSlug: string,
  assigneeIds: string[],
): Promise<string> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await supabase
    .from('prospects')
    .select('account_manager_id')
    .contains('branches', [branchSlug])
    .not('account_manager_id', 'is', null)
    .gte('created_at', since);

  const counts = new Map<string, number>();
  for (const id of assigneeIds) counts.set(id, 0);
  for (const row of data || []) {
    const id = row.account_manager_id as string;
    if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  let bestId = assigneeIds[0];
  let bestCount = counts.get(bestId) ?? 0;
  for (const id of assigneeIds) {
    const c = counts.get(id) ?? 0;
    if (c < bestCount) {
      bestId = id;
      bestCount = c;
    }
  }
  return bestId;
}

function pickWeightedRandom(assignees: PartnerProspectAmAssignee[]): string {
  const weights = assignees.map(a => Math.max(0, a.weight ?? 1));
  const sum = weights.reduce((x, y) => x + y, 0);
  if (sum <= 0) return assignees[0].admin_user_id;
  let r = Math.random() * sum;
  for (let i = 0; i < assignees.length; i++) {
    r -= weights[i];
    if (r <= 0) return assignees[i].admin_user_id;
  }
  return assignees[assignees.length - 1].admin_user_id;
}

/**
 * Bepaalt welke `admin_users.id` op een nieuwe partner-prospect gezet wordt.
 * Leest `app_settings.partner_prospect_am_config` (JSON per branch).
 */
export async function resolvePartnerProspectAccountManagerId(
  supabase: SupabaseClient,
  branchSlug: PartnerProspectBranchSlug = PARTNER_PROSPECT_BRANCH_SLUG,
): Promise<string> {
  const defaults = defaultPartnerProspectAmConfigDoc();
  const doc = (await loadConfigDoc(supabase)) ?? defaults;
  const bc = branchConfig(doc, branchSlug);
  const assignees = bc?.assignees?.length
    ? bc.assignees
    : (defaults[branchSlug] ?? defaults[PARTNER_PROSPECT_BRANCH_SLUG]).assignees;
  const strategy = bc?.strategy ?? 'single';
  const ids = assignees.map(a => a.admin_user_id).filter(Boolean);
  if (ids.length === 0) return DEFAULT_PARTNER_PROSPECT_AM_ID;

  if (strategy === 'single' || ids.length === 1) {
    return ids[0];
  }
  if (strategy === 'weighted_random') {
    return pickWeightedRandom(assignees);
  }
  /* round_robin */
  return pickRoundRobin(supabase, branchSlug, ids);
}
