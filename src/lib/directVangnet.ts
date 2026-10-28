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
/** De eerste minuten elke minuut proberen, daarna elke vijf minuten. */
export const VANGNET_ELKE_MINUUT_TOT_MIN = 5;
/** Alleen in deze periode het adres opnieuw opzoeken. */
export const VANGNET_GEOCODE_TOT_MIN = 2;
/** Na deze tijd geen nieuwe lead meer beginnen: de ronde moet ruim binnen de minuut klaar zijn. */
export const VANGNET_TIJDBUDGET_MS = 35_000;
/** Eén adres opzoeken mag niet de hele ronde opslokken. */
export const VANGNET_GEOCODE_TIMEOUT_MS = 6_000;

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

/**
 * Wanneer het vangnet een lead (opnieuw) probeert: de eerste minuten elke
 * minuut, daarna elke vijf minuten. Een lead die bij niemand past, liep
 * anders 25 keer achter elkaar dezelfde vergeefse verdeling door.
 */
export function vangnetPogingNu(createdAt: string, nu: Date = new Date()): boolean {
  const leeftijdMin = Math.floor((nu.getTime() - new Date(createdAt).getTime()) / 60_000);
  return leeftijdMin < VANGNET_ELKE_MINUUT_TOT_MIN || leeftijdMin % 5 === 0;
}

/**
 * Het adres opnieuw opzoeken doen we alleen in de eerste minuten. Een adres
 * dat dan niet te vinden is, vindt de geocoder een minuut later ook niet, en
 * herhaald opvragen kan de geocoder ons laten afknijpen (ook voor de
 * verdeling bij binnenkomst).
 */
export function vangnetMagGeocoderen(createdAt: string, nu: Date = new Date()): boolean {
  return nu.getTime() - new Date(createdAt).getTime() < VANGNET_GEOCODE_TOT_MIN * 60_000;
}

/** Branches met minstens één actieve, betaalde pipeline-batch die (effectief) op direct staat. */
export async function directBranches(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('customer_batches')
    .select('branch, direct_leveren, customers!inner(direct_leveren, is_active)')
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .eq('mag_leveren', true)
    .eq('customers.is_active', true);
  if (error) throw new Error(`direct-branches ophalen mislukt: ${error.message}`);
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
  /** Leads die door de tijdslimiet naar de volgende minuut schuiven. */
  uitgesteld: number;
  details: { lead_id: string; branch: string | null; geocodeerd: boolean; klant: string | null }[];
};

function metTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<null>(res => { t = setTimeout(() => res(null), ms); })]).finally(() => clearTimeout(t));
}

export async function draaiVangnet(supabase: SupabaseClient, opties: { proef?: boolean; nu?: Date } = {}): Promise<VangnetResultaat> {
  const nu = opties.nu ?? new Date();
  const start = Date.now();
  const branches = await directBranches(supabase);
  const leeg: VangnetResultaat = { directBranches: [...branches], kandidaten: 0, geocodeerd: 0, verdeeld: 0, uitgesteld: 0, details: [] };
  if (branches.size === 0) return leeg;

  const spiegelKlanten = Object.values(MASTER_PORTAL_MIRROR_BY_BRANCH);
  /* Al in de database filteren (geen klant behalve de spiegel, geen demo of
     Excel-import), oudste eerst. Dan valt een lead zonder klant nooit buiten
     de limiet doordat er veel al verdeelde leads in hetzelfde venster zitten. */
  const { data, error } = await supabase
    .from('leads')
    .select('id, branch, bron, phone_valid, created_at, assigned_customer_ids, postcode, huisnummer, plaatsnaam, provincie, lat, lng, land, telefoonnummer, email')
    .in('branch', [...branches])
    .containedBy('assigned_customer_ids', spiegelKlanten)
    .or('bron.is.null,bron.not.in.(demo,excel_import)')
    .gte('created_at', new Date(nu.getTime() - VANGNET_MAX_LEEFTIJD_MIN * 60_000).toISOString())
    .lte('created_at', new Date(nu.getTime() - VANGNET_MIN_LEEFTIJD_SEC * 1000).toISOString())
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(`vangnet-leads ophalen mislukt: ${error.message}`);

  type Rij = VangnetLead & { postcode: string | null; huisnummer: string | null; plaatsnaam: string | null; provincie: string | null; lat: number | null; lng: number | null; land: string | null; telefoonnummer: string | null; email: string | null };
  const kandidaten = selecteerVangnetLeads((data ?? []) as Rij[], branches, spiegelKlanten, nu)
    .filter(l => vangnetPogingNu(l.created_at, nu));
  const res: VangnetResultaat = { ...leeg, kandidaten: kandidaten.length };
  if (opties.proef) {
    res.details = kandidaten.map(l => ({ lead_id: l.id, branch: l.branch, geocodeerd: !(l.lat && l.lng), klant: null }));
    return res;
  }

  for (const lead of kandidaten) {
    if (Date.now() - start > VANGNET_TIJDBUDGET_MS) { res.uitgesteld++; continue; }
    let { lat, lng, provincie } = lead;
    let geocodeerd = false;
    /* Adres opnieuw opzoeken, net als fase 1 van de verdeelronde. */
    if ((!lat || !lng) && lead.postcode && lead.huisnummer && vangnetMagGeocoderen(lead.created_at, nu)) {
      try {
        const r = await metTimeout(
          resolveAddress(lead.postcode, lead.huisnummer, lead.land as 'NL' | 'BE' | null, lead.telefoonnummer ?? undefined, lead.email ?? undefined),
          VANGNET_GEOCODE_TIMEOUT_MS,
        );
        if (r) {
          const updates: Record<string, string | number> = {};
          if (!isValidPlace(lead.plaatsnaam ?? undefined) && r.plaatsnaam) updates.plaatsnaam = r.plaatsnaam;
          if (!isValidPlace(provincie ?? undefined) && r.provincie) updates.provincie = r.provincie;
          if (r.lat && r.lng) { updates.lat = r.lat; updates.lng = r.lng; }
          if (r.land) updates.land = r.land;
          if (Object.keys(updates).length > 0) {
            const { error: updErr } = await supabase.from('leads').update(updates).eq('id', lead.id);
            /* Alleen meenemen wat echt is opgeslagen: de verdeling leest de
               lead opnieuw uit de database. */
            if (!updErr) {
              geocodeerd = true;
              res.geocodeerd++;
              if (typeof updates.provincie === 'string') provincie = updates.provincie;
              if (typeof updates.lat === 'number' && typeof updates.lng === 'number') { lat = updates.lat; lng = updates.lng; }
            }
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
