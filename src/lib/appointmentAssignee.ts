import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Een afspraak toewijzen aan een adviseur, en controleren of dat kan.
 *
 * WAAROM APART VAN validateSlot
 * -----------------------------
 * `validateSlot` beantwoordt de vraag "kan hier geboekt worden": het slot moet
 * binnen het rooster vallen, vrij zijn, én in de toekomst liggen. Voor
 * herverdelen is dat de verkeerde vraag. Een afspraak van gisteren alsnog aan
 * een collega toeschrijven moet gewoon kunnen, en of die collega toen rooster
 * had is niet meer relevant.
 *
 * Wat je bij herverdelen wél wilt weten: staat die adviseur op dat moment al
 * ergens anders? Dat is deze module.
 *
 * Tot nu toe werd er bij het wijzigen van alleen de adviseur helemaal niets
 * gecontroleerd, waardoor twee afspraken op hetzelfde moment bij dezelfde
 * persoon konden belanden zonder enige melding.
 */

export interface AfspraakVenster {
  id: string;
  starts_at: string;
  duration_minutes: number;
  travel_buffer_minutes?: number | null;
  portal_user_id?: string | null;
  status?: string | null;
  contact_name?: string | null;
}

/** Begin en eind in milliseconden, inclusief reistijd aan weerszijden. */
export function vensterVan(a: AfspraakVenster): { van: number; tot: number } | null {
  const start = new Date(a.starts_at).getTime();
  if (Number.isNaN(start)) return null;
  const buffer = (a.travel_buffer_minutes ?? 0) * 60_000;
  const duur = (a.duration_minutes || 0) * 60_000;
  return { van: start - buffer, tot: start + duur + buffer };
}

export function overlapt(a: AfspraakVenster, b: AfspraakVenster): boolean {
  const va = vensterVan(a);
  const vb = vensterVan(b);
  if (!va || !vb) return false;
  /* Aansluitend is geen overlap: eindigt de een om 10:00 en begint de ander om
     10:00, dan is dat precies de bedoeling van de reistijdbuffer. */
  return va.van < vb.tot && vb.van < va.tot;
}

/** Statussen die een plek in de agenda bezet houden. */
const BEZET = new Set(['scheduled']);

/**
 * Welke afspraken van deze adviseur botsen met het gegeven venster.
 *
 * Alleen ingeplande afspraken tellen: een geannuleerde of afgeboekte afspraak
 * houdt geen tijd meer bezet.
 */
export function vindConflicten(
  bestaande: AfspraakVenster[],
  doel: AfspraakVenster,
  adviseurId: string | null,
): AfspraakVenster[] {
  if (!adviseurId) return [];
  return bestaande.filter(a =>
    a.id !== doel.id &&
    a.portal_user_id === adviseurId &&
    BEZET.has(a.status || 'scheduled') &&
    overlapt(a, doel),
  );
}

export function beschrijfConflict(conflicten: AfspraakVenster[]): string {
  if (conflicten.length === 0) return '';
  const eerste = conflicten[0];
  const tijd = new Date(eerste.starts_at).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const naam = eerste.contact_name || 'een andere afspraak';
  const rest = conflicten.length > 1 ? ` (en nog ${conflicten.length - 1})` : '';
  return `Deze adviseur heeft op dat moment al een afspraak: ${naam} om ${tijd}${rest}.`;
}

/**
 * Haalt de afspraken op van één adviseur rond een moment, om op te botsen.
 *
 * Kijkt een dag voor en na, ruim genoeg voor elke duur plus reistijd, en klein
 * genoeg om niet de hele agenda op te halen.
 */
export async function haalAgendaRondom(
  supabase: SupabaseClient,
  customerId: string,
  momentIso: string,
): Promise<AfspraakVenster[]> {
  const moment = new Date(momentIso).getTime();
  if (Number.isNaN(moment)) return [];
  const van = new Date(moment - 86_400_000).toISOString();
  const tot = new Date(moment + 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .select('id, starts_at, duration_minutes, travel_buffer_minutes, portal_user_id, status, contact_name')
    .eq('customer_id', customerId)
    .gte('starts_at', van)
    .lte('starts_at', tot);

  if (error) {
    console.error('[appointmentAssignee] agenda ophalen mislukt:', error.message);
    return [];
  }
  return (data || []) as AfspraakVenster[];
}

export type ToewijzingUitkomst =
  | { ok: true; adviseurId: string | null }
  | { ok: false; conflict: string; conflicten: AfspraakVenster[] };

/**
 * Controleert een herverdeling.
 *
 * `forceer` laat een bewuste dubbele boeking toe: soms wil een bedrijf twee
 * afspraken op één adviseur zetten omdat ze weten dat de eerste kort duurt.
 * Dat mag, maar dan wel met een expliciete keuze in plaats van stilzwijgend.
 */
export async function controleerToewijzing(
  supabase: SupabaseClient,
  opties: {
    customerId: string;
    afspraak: AfspraakVenster;
    nieuweAdviseurId: string | null;
    forceer?: boolean;
  },
): Promise<ToewijzingUitkomst> {
  const { customerId, afspraak, nieuweAdviseurId, forceer } = opties;

  if (!nieuweAdviseurId) return { ok: true, adviseurId: null };
  if (forceer) return { ok: true, adviseurId: nieuweAdviseurId };

  const agenda = await haalAgendaRondom(supabase, customerId, afspraak.starts_at);
  const conflicten = vindConflicten(agenda, afspraak, nieuweAdviseurId);

  if (conflicten.length > 0) {
    return { ok: false, conflict: beschrijfConflict(conflicten), conflicten };
  }
  return { ok: true, adviseurId: nieuweAdviseurId };
}
