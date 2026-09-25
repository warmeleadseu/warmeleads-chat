import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Eén cronronde tegelijk.
 *
 * De verdeelronde draait elk kwartier. Duurt een ronde langer, dan start de
 * volgende terwijl de vorige nog loopt, lezen ze dezelfde stand en delen ze
 * dezelfde lead allebei uit. Dat brak zowel het plafond van drie klanten als
 * de cooldown van twaalf uur: de consument kreeg twee bedrijven tegelijk aan
 * de lijn.
 *
 * De vervaltijd is een noodrem. Sneuvelt een ronde zonder het slot terug te
 * geven, dan loopt het slot vanzelf af en gaat het werk door. Een zeldzame
 * dubbele ronde is minder erg dan een verdeling die voorgoed stilstaat.
 */
export async function neemCronSlot(
  supabase: SupabaseClient,
  naam: string,
  minuten: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('neem_cron_slot', {
    p_naam: naam,
    p_minuten: minuten,
  });
  if (error) {
    /* Bij twijfel doorgaan. Een slot dat niet te pakken is mag de verdeling
       niet stilleggen; dat middel is erger dan de kwaal. */
    console.error('[cronSlot] slot nemen mislukt, ronde gaat toch door', {
      naam,
      message: error.message,
    });
    return true;
  }
  return data === true;
}

export async function geefCronSlotTerug(supabase: SupabaseClient, naam: string): Promise<void> {
  const { error } = await supabase.rpc('geef_cron_slot_terug', { p_naam: naam });
  if (error) {
    console.error('[cronSlot] slot teruggeven mislukt', { naam, message: error.message });
  }
}
