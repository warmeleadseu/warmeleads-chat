import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Koppelingen tussen klantportalen: wie mag er bij wie afspraken inboeken.
 *
 * Gericht en niet wederkerig. Dat Infinite Scale voor installateur X mag
 * boeken, betekent niet dat X ook in hun agenda mag.
 */

export interface Portaalkoppeling {
  id: string;
  bron_customer_id: string;
  doel_customer_id: string;
  branches: string[] | null;
  verbruikt_batch: boolean;
  deelt_leadgegevens: boolean;
  mag_wijzigen_tot_bevestiging: boolean;
  actief: boolean;
  notities: string | null;
}

/** Of deze koppeling voor deze branche geldt. Leeg branches-veld betekent alle. */
export function koppelingGeldtVoorBranche(
  koppeling: Pick<Portaalkoppeling, 'branches'>,
  branche: string,
): boolean {
  if (!koppeling.branches || koppeling.branches.length === 0) return true;
  return koppeling.branches.includes(branche);
}

/**
 * Of de boekende partij een reeds geplaatste afspraak nog mag aanpassen.
 *
 * Standaard mag dat tot de ontvangende klant hem bevestigt. Daarna niet meer,
 * anders verschuift een callcenter de agenda van een installateur zonder dat
 * die het doorheeft.
 */
export function bronMagNogWijzigen(
  koppeling: Pick<Portaalkoppeling, 'mag_wijzigen_tot_bevestiging'>,
  afspraak: { bevestigd_at?: string | null; status?: string | null },
): boolean {
  if (afspraak.status && afspraak.status !== 'scheduled') return false;
  if (!koppeling.mag_wijzigen_tot_bevestiging) return false;
  return !afspraak.bevestigd_at;
}

/** Actieve koppelingen waar deze klant de boekende partij is. */
export async function haalKoppelingenVoorBron(
  supabase: SupabaseClient,
  bronCustomerId: string,
): Promise<(Portaalkoppeling & { doel_naam: string })[]> {
  const { data, error } = await supabase
    .from('portaalkoppelingen')
    .select('*, doel:customers!portaalkoppelingen_doel_customer_id_fkey(name)')
    .eq('bron_customer_id', bronCustomerId)
    .eq('actief', true);

  if (error) {
    console.error('[portaalkoppelingen] ophalen mislukt:', error.message);
    return [];
  }

  return (data || []).map(rij => {
    const { doel, ...rest } = rij as Portaalkoppeling & { doel: { name: string } | null };
    return { ...rest, doel_naam: doel?.name ?? 'Onbekend' };
  });
}

/**
 * Haalt de koppeling op die deze boeking mag dragen, of null.
 *
 * De enige plek waar wordt beslist of een boeking bij een ander portaal is
 * toegestaan. Elke route die grensoverschrijdend boekt gaat hierlangs, zodat er
 * geen tweede, soepelere controle kan ontstaan.
 */
export async function vindKoppeling(
  supabase: SupabaseClient,
  bronCustomerId: string,
  doelCustomerId: string,
  branche: string,
): Promise<Portaalkoppeling | null> {
  const { data } = await supabase
    .from('portaalkoppelingen')
    .select('*')
    .eq('bron_customer_id', bronCustomerId)
    .eq('doel_customer_id', doelCustomerId)
    .eq('actief', true)
    .maybeSingle();

  if (!data) return null;
  const koppeling = data as Portaalkoppeling;
  if (!koppelingGeldtVoorBranche(koppeling, branche)) return null;
  return koppeling;
}

/**
 * De velden waarmee een grensoverschrijdende afspraak wordt weggeschreven.
 *
 * Staat het delen van leadgegevens uit, dan gaat de koppeling naar de lead niet
 * mee: de ontvangende klant krijgt dan alleen de contactgegevens die bij de
 * afspraak zelf horen. Met lead_id erbij zou hij de hele lead in zijn portaal
 * kunnen openen, en dat is feitelijk een leadlevering.
 */
export function boekingsVelden(
  koppeling: Portaalkoppeling,
  invoer: { lead_id?: string | null; lead_assignment_id?: string | null },
): { lead_id: string | null; lead_assignment_id: string | null } {
  if (!koppeling.deelt_leadgegevens) {
    return { lead_id: null, lead_assignment_id: null };
  }
  return {
    lead_id: invoer.lead_id ?? null,
    lead_assignment_id: invoer.lead_assignment_id ?? null,
  };
}
