import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Historie van accountmanagers per prospect: wie had de prospect wanneer.
 *
 * Er is geen aparte tabel; de historie wordt opgebouwd uit wat er al is:
 * - activiteiten van type 'assignment' (metadata.to, en sinds het begin bij
 *   losse toewijzingen ook metadata.from);
 * - de huidige account_manager_id en assigned_at van de prospect.
 *
 * Oudere bulktoewijzingen legden niet vast wie de prospect daarvóór had. Dan
 * kijken we of iemand anders vóór die toewijzing contact had met de prospect
 * (bellen, mailen, notitie, taak, status). Is dat er, dan tonen we die persoon
 * als "afgeleid"; anders is de eerste periode "niet vastgelegd".
 */

export type AmPeriode = {
  am_id: string | null;
  vanaf: string;
  tot: string | null;
  /** false = afgeleid of niet vastgelegd, true = zo vastgelegd. */
  zeker: boolean;
  /** Er is niets bekend over wie (of of iemand) de prospect toen had. */
  onbekend?: boolean;
  /** Wie de toewijzing deed (bij een vastgelegde wijziging). */
  door?: string | null;
  bulk?: boolean;
};

export type AmActiviteit = {
  prospect_id?: string;
  type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_user_id?: string | null;
};

export type AmProspect = {
  id: string;
  created_at: string;
  account_manager_id: string | null;
  assigned_at?: string | null;
};

/** Activiteiten waaruit je mag afleiden dat iemand de prospect behandelde. */
const CONTACT_TYPES = new Set(['call', 'email', 'note', 'status_change', 'task_created', 'meeting', 'updated']);

const naarId = (m: Record<string, unknown> | null): string | null => {
  const v = m?.to;
  return typeof v === 'string' && v ? v : null;
};

/** Na het aanmaken later (her)toegewezen zonder vastgelegde toewijzing? (> 1 uur na aanmaak) */
export function laterToegewezen(p: AmProspect): boolean {
  return !!p.assigned_at && Date.parse(p.assigned_at) - Date.parse(p.created_at) > 3_600_000;
}

/** Wie had het meeste contact met de prospect vóór dit moment (behalve 'behalve')? */
function meesteContact(acts: AmActiviteit[], voor: string, behalve: string | null = null): string | null {
  const tellers = new Map<string, number>();
  for (const a of acts) {
    if (a.created_at >= voor || !a.admin_user_id || a.admin_user_id === behalve || !CONTACT_TYPES.has(a.type)) continue;
    tellers.set(a.admin_user_id, (tellers.get(a.admin_user_id) ?? 0) + 1);
  }
  return [...tellers.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
}

/** Puur: bouw de periodes, oudste eerst. */
export function bouwAmHistorie(p: AmProspect, acts: AmActiviteit[]): AmPeriode[] {
  const toewijzingen = acts
    .filter(a => a.type === 'assignment')
    .sort((x, y) => x.created_at.localeCompare(y.created_at));

  const periodes: AmPeriode[] = [];
  const voegToe = (n: AmPeriode) => {
    const vorige = periodes[periodes.length - 1];
    if (vorige && vorige.am_id === n.am_id && !vorige.onbekend) return; // geen echte wissel
    if (vorige) vorige.tot = n.vanaf;
    periodes.push(n);
  };

  if (toewijzingen.length === 0) {
    /* Buiten de knoppen om overgezet (bv. in één keer naar een andere AM): wie werkte er daarvóór aan? */
    const eerder = laterToegewezen(p) ? meesteContact(acts, p.assigned_at!, p.account_manager_id) : null;
    if (eerder) {
      periodes.push({ am_id: eerder, vanaf: p.created_at, tot: p.assigned_at!, zeker: false });
      periodes.push({ am_id: p.account_manager_id, vanaf: p.assigned_at!, tot: null, zeker: true });
    } else {
      periodes.push({ am_id: p.account_manager_id, vanaf: p.created_at, tot: null, zeker: true });
    }
    return periodes;
  }

  /* Wie had hem vóór de eerste vastgelegde toewijzing? */
  const eerste = toewijzingen[0];
  const em = eerste.metadata ?? {};
  if (Object.prototype.hasOwnProperty.call(em, 'from')) {
    const van = typeof em.from === 'string' && em.from ? em.from : null;
    periodes.push({ am_id: van, vanaf: p.created_at, tot: null, zeker: true });
  } else {
    const kandidaat = meesteContact(acts, eerste.created_at);
    if (kandidaat) periodes.push({ am_id: kandidaat, vanaf: p.created_at, tot: null, zeker: false });
    else if (eerste.created_at > p.created_at) {
      periodes.push({ am_id: null, vanaf: p.created_at, tot: null, zeker: false, onbekend: true });
    }
  }

  for (const t of toewijzingen) {
    const m = t.metadata ?? {};
    voegToe({
      am_id: naarId(m),
      vanaf: t.created_at,
      tot: null,
      zeker: true,
      door: t.admin_user_id ?? null,
      bulk: m.bulk === true || undefined,
    });
  }

  /* Huidige AM wijkt af van de laatste vastgelegde toewijzing (buiten de knoppen om gewijzigd). */
  const laatste = periodes[periodes.length - 1];
  if (laatste.am_id !== p.account_manager_id) {
    const vanaf = p.assigned_at && p.assigned_at > laatste.vanaf ? p.assigned_at : laatste.vanaf;
    voegToe({ am_id: p.account_manager_id, vanaf, tot: null, zeker: false });
  }
  return periodes;
}

/** De accountmanagers die de prospect eerder had (zonder de huidige), nieuwste eerst. */
export function eerdereAms(periodes: AmPeriode[], huidig: string | null): string[] {
  const uit: string[] = [];
  for (let i = periodes.length - 1; i >= 0; i--) {
    const id = periodes[i].am_id;
    if (id && id !== huidig && !uit.includes(id)) uit.push(id);
  }
  return uit;
}

/** Haal de historie op voor een reeks prospects (lijst of één kaart). */
export async function laadAmHistorie(
  supabase: SupabaseClient,
  prospects: AmProspect[],
): Promise<Map<string, AmPeriode[]>> {
  const uit = new Map<string, AmPeriode[]>();
  if (prospects.length === 0) return uit;
  const ids = prospects.map(p => p.id);
  const acts: AmActiviteit[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('prospect_activities')
      .select('prospect_id, type, metadata, created_at, admin_user_id')
      .in('prospect_id', ids.slice(i, i + 200))
      .eq('type', 'assignment')
      .limit(5000);
    acts.push(...((data ?? []) as AmActiviteit[]));
  }

  /* Alleen bij een eerste toewijzing zonder "from" zijn eerdere contactmomenten nodig. */
  const perProspect = new Map<string, AmActiviteit[]>();
  for (const a of acts) {
    if (!a.prospect_id) continue;
    const l = perProspect.get(a.prospect_id) ?? [];
    l.push(a);
    perProspect.set(a.prospect_id, l);
  }
  const zonderVan = prospects
    .filter(p => {
      const l = perProspect.get(p.id);
      if (!l?.length) return laterToegewezen(p);
      const eerste = [...l].sort((x, y) => x.created_at.localeCompare(y.created_at))[0];
      return !Object.prototype.hasOwnProperty.call(eerste.metadata ?? {}, 'from');
    })
    .map(p => p.id);
  for (let i = 0; i < zonderVan.length; i += 50) {
    const { data } = await supabase
      .from('prospect_activities')
      .select('prospect_id, type, metadata, created_at, admin_user_id')
      .in('prospect_id', zonderVan.slice(i, i + 50))
      .in('type', [...CONTACT_TYPES])
      .not('admin_user_id', 'is', null)
      .limit(5000);
    for (const a of (data ?? []) as AmActiviteit[]) {
      const l = perProspect.get(a.prospect_id!) ?? [];
      l.push(a);
      perProspect.set(a.prospect_id!, l);
    }
  }

  for (const p of prospects) uit.set(p.id, bouwAmHistorie(p, perProspect.get(p.id) ?? []));
  return uit;
}

export type AmPeriodeMetNaam = AmPeriode & { naam: string | null; door_naam: string | null };

/** Namen erbij (ook van inmiddels inactieve accounts). */
export async function metNamen(
  supabase: SupabaseClient,
  historie: Map<string, AmPeriode[]>,
): Promise<Map<string, AmPeriodeMetNaam[]>> {
  const ids = new Set<string>();
  for (const l of historie.values()) for (const p of l) { if (p.am_id) ids.add(p.am_id); if (p.door) ids.add(p.door); }
  const namen = new Map<string, string>();
  if (ids.size) {
    const { data } = await supabase.from('admin_users').select('id, name').in('id', [...ids]);
    for (const r of data ?? []) namen.set(r.id as string, (r.name as string) || '');
  }
  const uit = new Map<string, AmPeriodeMetNaam[]>();
  for (const [k, l] of historie) {
    uit.set(k, l.map(p => ({ ...p, naam: p.am_id ? namen.get(p.am_id) ?? null : null, door_naam: p.door ? namen.get(p.door) ?? null : null })));
  }
  return uit;
}

/**
 * Voor de lijst: eerdere accountmanagers met naam, nieuwste eerst. Dezelfde
 * naam (bv. een oud en een nieuw account van één persoon) telt één keer en
 * niet als die persoon de huidige AM is.
 */
export function eerdereAmsMetNaam(periodes: AmPeriodeMetNaam[], huidig: string | null): { id: string; naam: string }[] {
  const naamVan = (id: string | null) => (id ? periodes.find(p => p.am_id === id)?.naam || null : null);
  const huidigeNaam = naamVan(huidig);
  const gezien = new Set<string>(huidigeNaam ? [huidigeNaam] : []);
  const uit: { id: string; naam: string }[] = [];
  for (const id of eerdereAms(periodes, huidig)) {
    const naam = naamVan(id) || 'Onbekend';
    if (gezien.has(naam)) continue;
    gezien.add(naam);
    uit.push({ id, naam });
  }
  return uit;
}
