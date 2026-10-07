import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfanityResult } from './profanityFilter';

/**
 * Quarantaine voor leads die de scheldwoordfilter tegenhoudt.
 *
 * Voorheen verdween zo'n lead zonder spoor (verwijderd, geweigerd of
 * overgeslagen). De woordenlijst raakt ook gewone achternamen ("Pik",
 * "Van Reet"), dus nu bewaren we de lead volledig en beslist een beheerder.
 */

export type QuarantaineRoute = 'webhook' | 'verdeel_cron' | 'meta_inhaalslag';
export type QuarantaineStatus = 'open' | 'vrijgegeven' | 'afgewezen';

/** Leesbare reden, bijvoorbeeld: "pik" in naam_klant. */
export function quarantaineReden(p: ProfanityResult): string {
  const woord = p.word ? `"${p.word}"` : 'ongepast woord';
  return p.field ? `${woord} in ${p.field}` : woord;
}

/**
 * Kolommen die de database zelf bijhoudt en die bij terugzetten dus niet
 * mogen worden meegestuurd (is_assigned is GENERATED ALWAYS). De oude
 * toewijzingen bestaan niet meer, dus assigned_customer_ids begint leeg.
 */
export function leadVoorTerugzetten(lead: Record<string, unknown>): Record<string, unknown> {
  const rij: Record<string, unknown> = { ...lead };
  delete rij.is_assigned;
  if ('assigned_customer_ids' in rij) rij.assigned_customer_ids = [];
  return rij;
}

type Db = SupabaseClient;

/**
 * Zet een lead in quarantaine. Geeft `ok: true` ook als dezelfde Meta-lead er
 * al in staat (unieke index): dan is hij immers al veilig bewaard.
 */
export async function zetInQuarantaine(
  supabase: Db,
  invoer: {
    route: QuarantaineRoute;
    reden: string;
    lead: Record<string, unknown>;
    oorspronkelijkLeadId?: string | null;
    metaLeadgenId?: string | null;
  },
): Promise<{ ok: boolean; id: string | null; bestond: boolean; fout?: string }> {
  /* Mislukte het verwijderen na het bewaren, dan komt de verdeel-cron de lead
     de volgende ronde opnieuw tegen; één rij is genoeg. */
  if (invoer.oorspronkelijkLeadId) {
    const { data: al } = await supabase
      .from('leads_quarantaine')
      .select('id')
      .eq('oorspronkelijk_lead_id', invoer.oorspronkelijkLeadId)
      .eq('status', 'open')
      .limit(1);
    if (al && al.length > 0) return { ok: true, id: (al[0] as { id: string }).id, bestond: true };
  }

  const { data, error } = await supabase
    .from('leads_quarantaine')
    .insert({
      route: invoer.route,
      reden: invoer.reden,
      lead: invoer.lead,
      oorspronkelijk_lead_id: invoer.oorspronkelijkLeadId ?? null,
      meta_leadgen_id: invoer.metaLeadgenId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { ok: true, id: null, bestond: true };
    return { ok: false, id: null, bestond: false, fout: error.message };
  }
  return { ok: true, id: (data as { id: string }).id, bestond: false };
}

/** Lead-id's die een beheerder al heeft vrijgegeven; die houdt de filter niet opnieuw tegen. */
export async function vrijgegevenLeadIds(supabase: Db, leadIds: string[]): Promise<Set<string>> {
  const uit = new Set<string>();
  for (let i = 0; i < leadIds.length; i += 150) {
    const { data } = await supabase
      .from('leads_quarantaine')
      .select('vrijgegeven_lead_id')
      .eq('status', 'vrijgegeven')
      .in('vrijgegeven_lead_id', leadIds.slice(i, i + 150));
    for (const r of data || []) if (r.vrijgegeven_lead_id) uit.add(r.vrijgegeven_lead_id as string);
  }
  return uit;
}
