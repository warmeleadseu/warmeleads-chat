import type { SupabaseClient } from '@supabase/supabase-js';
import { effectiefDirect } from './directLeveren';
import { resolveAddress, isValidPlace } from './pdok';
import { distributeLead } from './distribution';
import { MASTER_PORTAL_MIRROR_BY_BRANCH } from './masterPortalMirror';

/**
 * Vangnet voor direct leveren: elke minuut.
 *
 * Bij binnenkomst krijgt 78% van de leads binnen een minuut een klant. De
 * rest wacht op de verdeelronde van elk kwartier, meestal omdat het adres
 * bij binnenkomst niet te vinden was of het verdelen toen mislukte. Voor een
 * direct-klant is een kwartier te laat. Dit vangnet pakt zulke leads binnen
 * een minuut op, maar alleen in branches waar iemand op direct staat: staat
 * niemand op direct, dan doet het niets.
 */

/** Pas na deze tijd: de verdeling bij binnenkomst krijgt eerst de kans (geen wedloop). */
export const VANGNET_MIN_LEEFTIJD_SEC = 45;
/** Ouder dan dit is geen "direct" meer; dan laat het vangnet hem aan de verdeelronde. */
export const VANGNET_MAX_LEEFTIJD_MIN = 30;

/**
 * Minuten waarin de kwartierronde start of net gaat starten: dan niet, zodat
 * het vangnet en de verdeelronde nooit tegelijk dezelfde lead verdelen.
 */
export function vangnetMinuutOverslaan(nu: Date = new Date()): boolean {
  const m = nu.getUTCMinutes() % 15;
  return m === 0 || m === 14;
}

export type VangnetLead = {
  id: string;
  branch: string | null;
  bron: string | null;
  phone_valid: boolean | null;
  created_at: string;
  assigned_customer_ids: string[] | null;
};

/** Welke leads het vangnet oppakt. */
export function selecteerVangnetLeads<T extends VangnetLead>(
  leads: T[],
  directBranches: Set<string>,
  spiegelKlanten: string[],
  nu: Date = new Date(),
): T[] {
  const spiegel = new Set(spiegelKlanten);
  const jongst = nu.getTime() - VANGNET_MIN_LEEFTIJD_SEC * 1000;
  const oudst = nu.getTime() - VANGNET_MAX_LEEFTIJD_MIN * 60_000;
  return leads.filter(l => {
    const t = new Date(l.created_at).getTime();
    if (!(t <= jongst && t >= oudst)) return false;
    if (!l.branch || !directBranches.has(l.branch)) return false;
    if (l.bron === 'demo' || l.bron === 'excel_import') return false;
    if (l.phone_valid === false) return false;
    /* Al een echte klant (een spiegelkopie telt niet): niets te doen. */
    return (l.assigned_customer_ids ?? []).every(id => spiegel.has(id));
  });
}

/** Branches met minstens één actieve, betaalde pipeline-batch die (effectief) op direct staat. */
export async function directBranches(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase
    .from('customer_batches')
    .select('branch, direct_leveren, customers!inner(direct_leveren, is_active)')
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .neq('is_paid', false)
    .eq('customers.is_active', true);
  const uit = new Set<string>();
  for (const b of data ?? []) {
    const klant = (Array.isArray(b.customers) ? b.customers[0] : b.customers) as { direct_leveren?: boolean } | null;
    if (effectiefDirect(b.direct_leveren as string | null, klant?.direct_leveren)) uit.add(b.branch as string);
  }
  return uit;
}

export type VangnetResultaat = {
  directBranches: string[];
  kandidaten: number;
  geocodeerd: number;
  verdeeld: number;
  details: { lead_id: string; branch: string | null; geocodeerd: boolean; klant: string | null }[];
};

export async function draaiVangnet(supabase: SupabaseClient, opties: { proef?: boolean; nu?: Date } = {}): Promise<VangnetResultaat> {
  const nu = opties.nu ?? new Date();
  const branches = await directBranches(supabase);
  const leeg: VangnetResultaat = { directBranches: [...branches], kandidaten: 0, geocodeerd: 0, verdeeld: 0, details: [] };
  if (branches.size === 0) return leeg;

  const { data } = await supabase
    .from('leads')
    .select('id, branch, bron, phone_valid, created_at, assigned_customer_ids, postcode, huisnummer, plaatsnaam, provincie, lat, lng, land, telefoonnummer, email')
    .in('branch', [...branches])
    .gte('created_at', new Date(nu.getTime() - VANGNET_MAX_LEEFTIJD_MIN * 60_000).toISOString())
    .lte('created_at', new Date(nu.getTime() - VANGNET_MIN_LEEFTIJD_SEC * 1000).toISOString())
    .limit(200);

  type Rij = VangnetLead & { postcode: string | null; huisnummer: string | null; plaatsnaam: string | null; provincie: string | null; lat: number | null; lng: number | null; land: string | null; telefoonnummer: string | null; email: string | null };
  const kandidaten = selecteerVangnetLeads((data ?? []) as Rij[], branches, Object.values(MASTER_PORTAL_MIRROR_BY_BRANCH), nu);
  const res: VangnetResultaat = { ...leeg, kandidaten: kandidaten.length };
  if (opties.proef) {
    res.details = kandidaten.map(l => ({ lead_id: l.id, branch: l.branch, geocodeerd: !(l.lat && l.lng), klant: null }));
    return res;
  }

  for (const lead of kandidaten) {
    let { lat, lng, provincie } = lead;
    let geocodeerd = false;
    /* Adres opnieuw opzoeken, net als fase 1 van de verdeelronde. */
    if ((!lat || !lng) && lead.postcode && lead.huisnummer) {
      try {
        const r = await resolveAddress(lead.postcode, lead.huisnummer, lead.land as 'NL' | 'BE' | null, lead.telefoonnummer ?? undefined, lead.email ?? undefined);
        if (r) {
          const updates: Record<string, string | number> = {};
          if (!isValidPlace(lead.plaatsnaam ?? undefined) && r.plaatsnaam) updates.plaatsnaam = r.plaatsnaam;
          if (!isValidPlace(provincie ?? undefined) && r.provincie) { updates.provincie = r.provincie; provincie = r.provincie; }
          if (r.lat && r.lng) { updates.lat = r.lat; updates.lng = r.lng; lat = r.lat; lng = r.lng; }
          if (r.land) updates.land = r.land;
          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
            if (!error) { geocodeerd = true; res.geocodeerd++; }
          }
        }
      } catch (err) {
        console.warn('[direct-vangnet] adres opzoeken mislukt:', lead.id, err instanceof Error ? err.message : err);
      }
    }
    if (!(lat && lng) && !provincie) { res.details.push({ lead_id: lead.id, branch: lead.branch, geocodeerd, klant: null }); continue; }

    try {
      const r = await distributeLead({ id: lead.id, branch: lead.branch as string, lat: lat as number, lng: lng as number, bron: lead.bron } as never, { supabase });
      const klant = r.assignments[0]?.customer_id ?? null;
      if (klant) res.verdeeld++;
      res.details.push({ lead_id: lead.id, branch: lead.branch, geocodeerd, klant });
    } catch (err) {
      console.error('[direct-vangnet] verdelen mislukt:', lead.id, err instanceof Error ? err.message : err);
      res.details.push({ lead_id: lead.id, branch: lead.branch, geocodeerd, klant: null });
    }
  }
  return res;
}
