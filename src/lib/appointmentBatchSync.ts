import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Eén definitie van "hoeveel afspraken heeft deze batch geleverd".
 *
 * ACHTERGROND
 * -----------
 * Het veld `appointment_batches.appointments_delivered` werd nergens in de
 * codebase opgehoogd. Het werd alleen gelezen (voortgangsbalk in het portaal en
 * in de admin) en bij aankoop op nul gezet door de Mollie-webhook. In productie
 * stonden daardoor zeven batches op 0 van de 10 terwijl er al elf afspraken aan
 * een batch hingen: de klant zag altijd nul voortgang en een batch raakte nooit
 * vol.
 *
 * Dat is hetzelfde patroon als het verdeelincident van augustus 2026, waar een
 * teller iets anders zei dan de werkelijkheid. Daarom hier dezelfde aanpak: één
 * functie die telt, en iedereen die de teller aanraakt gaat hierlangs.
 */

/** Statussen die niet meetellen als geleverde afspraak. */
const NIET_GELEVERD = new Set(['cancelled', 'rescheduled']);

/**
 * Aantal werkelijk geleverde afspraken in deze batch.
 *
 * Een geannuleerde afspraak telt niet: die heeft niet plaatsgevonden en mag
 * geen plek uit de batch opsnoepen. Een verzette afspraak telt ook niet, want
 * zijn opvolger staat er als losse rij bij en zou hem anders dubbel tellen.
 *
 * Een no-show telt wél mee. De adviseur is erheen gereden, de afspraak is
 * geleverd, en of de consument thuis was is een kwestie voor de reclamatie en
 * niet voor deze teller.
 */
export async function telGeleverdeAfspraken(
  supabase: SupabaseClient,
  batchId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, status')
    .eq('batch_id', batchId);

  if (error) {
    console.error('[appointmentBatchSync] tellen mislukt:', error.message);
    return 0;
  }

  return (data || []).filter(a => !NIET_GELEVERD.has(a.status)).length;
}

export interface BatchSyncResultaat {
  geteld: number;
  bijgewerkt: boolean;
  afgesloten: boolean;
}

/**
 * Trekt de teller van één afsprakenbatch gelijk met de werkelijkheid en sluit
 * hem als hij vol is.
 *
 * Sluit alleen actieve batches. Een afgesloten of gepauzeerde batch blijft
 * zoals hij is: dat is boekhouding uit het verleden, en heropenen zou hem
 * opnieuw afspraken laten opnemen. Die les komt uit migratie 158.
 */
export async function syncAfsprakenBatch(
  supabase: SupabaseClient,
  batchId: string | null | undefined,
): Promise<BatchSyncResultaat | null> {
  if (!batchId) return null;

  const { data: batch } = await supabase
    .from('appointment_batches')
    .select('id, batch_size, appointments_delivered, status')
    .eq('id', batchId)
    .maybeSingle();

  if (!batch) return null;

  const geteld = await telGeleverdeAfspraken(supabase, batchId);

  const velden: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let afgesloten = false;

  if (batch.appointments_delivered !== geteld) {
    velden.appointments_delivered = geteld;
  }

  if (batch.status === 'active' && batch.batch_size > 0 && geteld >= batch.batch_size) {
    velden.status = 'completed';
    afgesloten = true;
  }

  const moetSchrijven = 'appointments_delivered' in velden || 'status' in velden;
  if (!moetSchrijven) return { geteld, bijgewerkt: false, afgesloten: false };

  const { error } = await supabase
    .from('appointment_batches')
    .update(velden)
    .eq('id', batchId);

  if (error) {
    console.error('[appointmentBatchSync] bijwerken mislukt:', error.message);
    return { geteld, bijgewerkt: false, afgesloten: false };
  }

  return { geteld, bijgewerkt: true, afgesloten };
}

/**
 * Of er in deze batch nog plek is.
 *
 * Gebruikt bij het inboeken, zodat een partner niet in een volle batch boekt en
 * de ontvanger achteraf voor afspraken staat die hij niet heeft besteld.
 */
export function heeftRuimte(
  batch: { batch_size: number; appointments_delivered: number; status: string },
): boolean {
  if (batch.status !== 'active') return false;
  if (!batch.batch_size || batch.batch_size <= 0) return true;
  return batch.appointments_delivered < batch.batch_size;
}
