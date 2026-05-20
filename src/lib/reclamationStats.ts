/**
 * Reclamatie-statistieken voor CPL-berekeningen.
 *
 * Goedgekeurde reclamaties (lead_reclamations.status = 'approved') kosten ons
 * altijd geld:
 *  - de Meta-spend voor de gereclameerde lead is al gemaakt;
 *  - de klant krijgt een gratis vervangende lead (batch_size += 1 + compensatie).
 *
 * In rapportages tellen we daarom een goedgekeurde reclamatie NIET als
 * netto geleverde lead. Bruto CPL blijft `spend / leads` (alle leads die we
 * voor onszelf hebben binnengehaald), maar effective CPL is voortaan:
 *
 *   eff_cpl = total_spend / (deliveries − approved_reclamations_in_periode)
 *
 * Deze helper levert tellingen op verschillende dimensies zodat alle
 * berekeningen (admin/costs, live-stats, AI Studio tree, optimizer) één
 * waarheid gebruiken.
 *
 * Met terugwerkende kracht: er is geen migratie of backfill nodig — we
 * lezen de reeds bestaande `lead_reclamations` rijen.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';

export interface ReclamationPeriodFilters {
  /** Periode-begin (inclusief) — toepassen op `lead_reclamations.resolved_at`. */
  fromIso?: string;
  /** Periode-einde (exclusief). */
  toIso?: string;
  /**
   * Optioneel: filter op de gerelateerde lead's `created_at`. Handig om
   * eff. CPL consistent te houden met de spend-noemer (= alleen leads
   * binnen hetzelfde rapportagevenster).
   */
  leadCreatedSinceIso?: string;
  /** Optioneel: alleen voor specifieke klant(en). */
  customerIds?: string[];
  /** Optioneel: alleen leads voor specifieke branche(s). */
  branches?: string[];
  /**
   * Optioneel: sluit demo/excel-leads uit (zelfde scope als rest van
   * de CPL-berekeningen — anders krijgt eff. CPL incorrect kleine noemer).
   */
  excludeBulkAndDemo?: boolean;
}

/**
 * Resultaat van een aggregatie over goedgekeurde reclamaties: ruwe rij-array
 * + pre-berekende maps zodat callers snel kunnen aftrekken op het niveau dat
 * voor hen relevant is.
 */
export interface ApprovedReclamationStats {
  total: number;
  leadIds: Set<string>;
  /** Set van "{lead_id}::{customer_id}" — exacte match op assignment. */
  approvedPairs: Set<string>;
  byCampaignId: Map<string, number>;
  byAdsetId: Map<string, number>;
  byAdId: Map<string, number>;
  byBranch: Map<string, number>;
}

/** Helper om consistent een pair-key te bouwen tussen helper en callers. */
export function reclamationPairKey(leadId: string, customerId: string): string {
  return `${leadId}::${customerId}`;
}

/**
 * Haal goedgekeurde reclamaties op met de bijbehorende lead-attributie
 * (campaign/adset/ad/branch). Retourneert losse rijen + aggregatie-maps.
 *
 * Implementatie-noot:
 *  - we filteren op `lead_reclamations.status = 'approved'`
 *  - periode wordt toegepast op `resolved_at` (datum van goedkeuring), niet
 *    `created_at`. Een lead die in januari binnenkwam maar in maart wordt
 *    goedgekeurd, telt voor maart-CPL want pas dán wordt de kost
 *    materieel: de klant krijgt een vervangslot.
 *  - join op `leads` voor Meta-attributie en branch
 */
export async function getApprovedReclamationStats(
  filters: ReclamationPeriodFilters = {},
  supabaseInput?: SupabaseClient,
): Promise<ApprovedReclamationStats> {
  const supabase = supabaseInput ?? createServerClient();
  // We selecteren met inner join op leads via embed; PostgREST doet
  // de filter op leads-velden automatisch goed bij `!inner`.
  let query = supabase
    .from('lead_reclamations')
    .select(
      `lead_id,
       customer_id,
       resolved_at,
       leads:lead_id!inner (
         id,
         branch,
         bron,
         meta_campaign_id,
         meta_adset_id,
         meta_ad_id
       )`,
    )
    .eq('status', 'approved');

  if (filters.fromIso) query = query.gte('resolved_at', filters.fromIso);
  if (filters.toIso) query = query.lt('resolved_at', filters.toIso);
  if (filters.leadCreatedSinceIso) {
    query = query.gte('leads.created_at', filters.leadCreatedSinceIso);
  }
  if (filters.customerIds && filters.customerIds.length > 0) {
    query = query.in('customer_id', filters.customerIds);
  }
  if (filters.branches && filters.branches.length > 0) {
    query = query.in('leads.branch', filters.branches);
  }
  if (filters.excludeBulkAndDemo) {
    // Sluit de 'demo'-bron uit; bulk_export-assignments zitten al niet in
    // de eff.-noemer, maar reclamaties op excel_import-leads zouden anders
    // wel meetellen. Bron-filter op join-tabel.
    query = query.neq('leads.bron', 'demo').neq('leads.bron', 'excel_import');
  }

  const { data, error } = await query;
  if (error) {
    // Bij DB-fout liever 0 aftrekken (= huidige gedrag) dan crash; loggen.
    console.warn('[reclamationStats] query faalde — return lege set', error.message);
    return emptyStats();
  }

  const stats = emptyStats();

  for (const r of (data || []) as Array<{ lead_id: string; customer_id: string; leads: unknown }>) {
    // PostgREST-embed kan single-object of array zijn afhankelijk van de
    // relatie. Bij FK met uniqueness levert het een object op; om robuust
    // te zijn ondersteunen we beide vormen.
    const leadObj = Array.isArray(r.leads) ? r.leads[0] : r.leads;
    if (!leadObj) continue;
    const l = leadObj as {
      branch: string | null;
      meta_campaign_id: string | null;
      meta_adset_id: string | null;
      meta_ad_id: string | null;
    };

    stats.total += 1;
    stats.leadIds.add(r.lead_id);
    stats.approvedPairs.add(reclamationPairKey(r.lead_id, r.customer_id));
    if (l.branch) stats.byBranch.set(l.branch, (stats.byBranch.get(l.branch) || 0) + 1);
    if (l.meta_campaign_id) {
      stats.byCampaignId.set(l.meta_campaign_id, (stats.byCampaignId.get(l.meta_campaign_id) || 0) + 1);
    }
    if (l.meta_adset_id) {
      stats.byAdsetId.set(l.meta_adset_id, (stats.byAdsetId.get(l.meta_adset_id) || 0) + 1);
    }
    if (l.meta_ad_id) {
      stats.byAdId.set(l.meta_ad_id, (stats.byAdId.get(l.meta_ad_id) || 0) + 1);
    }
  }

  return stats;
}

function emptyStats(): ApprovedReclamationStats {
  return {
    total: 0,
    leadIds: new Set(),
    approvedPairs: new Set(),
    byCampaignId: new Map(),
    byAdsetId: new Map(),
    byAdId: new Map(),
    byBranch: new Map(),
  };
}

/**
 * Tel hoeveel assignments daadwerkelijk gereclameerd zijn binnen een set
 * (lead_id, customer_id)-paren. Optioneel met groepering per branche.
 *
 * Aanpak: caller geeft de assignments mee waar over geaggregeerd wordt
 * (typisch `assignmentsForCpl` in costs/live-stats). Wij retourneren hoeveel
 * daarvan een approved reclamatie hebben.
 *
 * Belangrijk: een goedgekeurde reclamatie waarvan de assignment NIET in de
 * periode-pool zit (bv. omdat assignment uit een eerdere maand was) telt
 * niet mee. Dat voorkomt dat een approval in mei retroactief het april-CPL
 * verandert terwijl april-spend en april-assignments al vastgezet zijn.
 */
export function countApprovedReclamationsForAssignments<
  T extends { lead_id: string; customer_id: string },
>(
  assignments: T[],
  approvedPairs: Set<string>,
  branchOfAssignment?: (a: T) => string | null,
): { total: number; byBranch: Map<string, number>; pairKeys: Set<string> } {
  const out = { total: 0, byBranch: new Map<string, number>(), pairKeys: new Set<string>() };
  for (const a of assignments) {
    const key = reclamationPairKey(a.lead_id, a.customer_id);
    if (!approvedPairs.has(key)) continue;
    if (out.pairKeys.has(key)) continue; // 1 reclamatie = 1 aftrek
    out.pairKeys.add(key);
    out.total += 1;
    if (branchOfAssignment) {
      const br = branchOfAssignment(a);
      if (br) out.byBranch.set(br, (out.byBranch.get(br) || 0) + 1);
    }
  }
  return out;
}

/**
 * Tel goedgekeurde reclamaties in een periode (snelle alternatieve API als
 * je alleen het totaal nodig hebt). Geen attributie-join.
 */
export async function countApprovedReclamations(
  filters: ReclamationPeriodFilters = {},
  supabaseInput?: SupabaseClient,
): Promise<number> {
  const supabase = supabaseInput ?? createServerClient();
  let query = supabase
    .from('lead_reclamations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved');
  if (filters.fromIso) query = query.gte('resolved_at', filters.fromIso);
  if (filters.toIso) query = query.lt('resolved_at', filters.toIso);
  if (filters.customerIds && filters.customerIds.length > 0) {
    query = query.in('customer_id', filters.customerIds);
  }
  const { count, error } = await query;
  if (error) {
    console.warn('[reclamationStats] count faalde — return 0', error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Bereken eff. CPL met aftrek van goedgekeurde reclamaties.
 *
 *   spend / max(0, deliveries − approvedReclamations)
 *
 * - Als de noemer 0 of negatief wordt (bv. meer reclamaties dan
 *   deliveries — pathologisch geval), returnen we `null` zodat de UI
 *   "—" toont in plaats van een misleidende ∞.
 * - Spend en alle waarden in EUR-cents of EUR; consumer kiest zelf.
 */
export function netEffectiveCpl(
  spend: number,
  deliveries: number,
  approvedReclamations: number,
): number | null {
  const net = deliveries - approvedReclamations;
  if (net <= 0) return null;
  return spend / net;
}

export const __internal = { emptyStats };
