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
  opties: { bijFout?: 'doorgaan' | 'stoppen' } = {},
): Promise<boolean> {
  const { data, error } = await supabase.rpc('neem_cron_slot', {
    p_naam: naam,
    p_minuten: minuten,
  });
  if (error) {
    /* Bij twijfel doorgaan. Een slot dat niet te pakken is mag de verdeling
       niet stilleggen; dat middel is erger dan de kwaal. */
    /* Een optionele ronde (zoals het minuut-vangnet) slaat juist over bij twijfel. */
    const stoppen = opties.bijFout === 'stoppen';
    console.error(stoppen ? '[cronSlot] slot nemen mislukt, ronde overgeslagen' : '[cronSlot] slot nemen mislukt, ronde gaat toch door', {
      naam,
      message: error.message,
    });
    return !stoppen;
  }
  return data === true;
}

export async function geefCronSlotTerug(supabase: SupabaseClient, naam: string): Promise<void> {
  const { error } = await supabase.rpc('geef_cron_slot_terug', { p_naam: naam });
  if (error) {
    console.error('[cronSlot] slot teruggeven mislukt', { naam, message: error.message });
  }
}

/**
 * Loopt een andere ronde nu? Alleen kijken, het slot niet aanraken. Bij een
 * fout geldt het slot als bezet: wie dit vraagt, slaat dan liever een keer over.
 */
export async function cronSlotBezet(supabase: SupabaseClient, naam: string): Promise<boolean> {
  const { data, error } = await supabase.from('cron_sloten').select('vergrendeld_tot').eq('naam', naam).maybeSingle();
  if (error) {
    console.error('[cronSlot] slot lezen mislukt', { naam, message: error.message });
    return true;
  }
  return !!data && new Date(data.vergrendeld_tot as string).getTime() > Date.now();
}
