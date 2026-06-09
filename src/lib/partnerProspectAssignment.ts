import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_PARTNER_PROSPECT_AM_ID,
  PARTNER_PROSPECT_BRANCH_SLUG,
  PARTNER_PROSPECT_BRANCH_SLUGS,
  type PartnerProspectBranchSlug,
} from '@/lib/partnerProspectConstants';

export const PARTNER_PROSPECT_AM_CONFIG_KEY = 'partner_prospect_am_config' as const;

/**
 * Per partner-branch onthouden welke `admin_users.id` als laatste een prospect
 * kreeg. Wordt gebruikt door strict-alternerende round-robin in
 * `pickRoundRobin`. Opslagvorm: `{ "thuisbatterij_partners": "<uuid>", … }`.
 */
export const PARTNER_PROSPECT_AM_POINTER_KEY = 'partner_prospect_am_pointer' as const;

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

/**
 * Strict round-robin op basis van een persistente "last-assigned"-pointer per
 * branche in `app_settings.partner_prospect_am_pointer`. Iedere nieuwe
 * prospect gaat naar de eerstvolgende AM ná de laatst-toegewezen, cyclisch
 * door de pool. Dit is wat een gebruiker verwacht onder de noemer
 * "round-robin": strict om de beurt, ongeacht historische scheefheid in de
 * dataset.
 *
 * Robuustheid:
 *  - Pool-volgorde wijzigt → we zoeken `last` op id (niet op index), dus
 *    correct.
 *  - `last` is niet (meer) in pool → we starten weer bij index 0.
 *  - Pointer-doc bestaat nog niet → eerste pick = pool[0].
 *  - Schrijfactie van pointer faalt → we gebruiken alsnog de gekozen AM
 *    voor deze prospect (verlies van strikte volgorde bij volgende pick is
 *    een acceptabel restrisico in zeldzame gevallen).
 */
export function pickNextRoundRobinId(
  assigneeIds: string[],
  lastAssignedId: string | null | undefined,
): string {
  if (assigneeIds.length === 0) {
    throw new Error('pickNextRoundRobinId: empty assigneeIds');
  }
  if (assigneeIds.length === 1) return assigneeIds[0];
  if (!lastAssignedId) return assigneeIds[0];
  const idx = assigneeIds.indexOf(lastAssignedId);
  if (idx === -1) return assigneeIds[0];
  return assigneeIds[(idx + 1) % assigneeIds.length];
}

type PointerDoc = Record<string, string>;

function parsePointerDoc(raw: unknown): PointerDoc {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: PointerDoc = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && isUuid(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

async function pickRoundRobin(
  supabase: SupabaseClient,
  branchSlug: string,
  assigneeIds: string[],
): Promise<string> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', PARTNER_PROSPECT_AM_POINTER_KEY)
    .maybeSingle();

  const pointers = parsePointerDoc(data?.value);
  const last = pointers[branchSlug] ?? null;
  const next = pickNextRoundRobinId(assigneeIds, last);

  // Persisteer de nieuwe pointer; falen mag niet-blokkerend zijn want we
  // hebben al een geldige `next` bepaald voor deze prospect.
  const updated: PointerDoc = { ...pointers, [branchSlug]: next };
  try {
    await supabase
      .from('app_settings')
      .upsert(
        { key: PARTNER_PROSPECT_AM_POINTER_KEY, value: JSON.stringify(updated) },
        { onConflict: 'key' },
      );
  } catch (err) {
    console.error(
      '[partnerProspectAssignment] pointer-upsert failed:',
      (err as Error)?.message,
    );
  }

  return next;
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
