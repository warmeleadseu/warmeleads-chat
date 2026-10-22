import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Leads in de wachtrij (`geplande_leadleveringen`) zetten.
 *
 * De tabel heeft één rij per lead en klant. Een oude rij die al is afgehandeld
 * (overgeslagen of geannuleerd) blokkeerde daardoor stilzwijgend een nieuwe
 * planning voor dezelfde lead en klant. Hier krijgt zo'n rij het nieuwe plan;
 * een rij die nog klaarstaat blijft zoals hij is, en een geleverde rij wordt
 * nooit opnieuw gebruikt.
 */

export type WachtrijRij = {
  lead_id: string;
  customer_id: string;
  batch_id: string | null;
  gepland_voor: string;
  soort: 'inhaalslag' | 'spreiding';
  reden: string;
  aangemaakt_door: string;
  negeer_geo: boolean;
};

export async function zetInWachtrij(supabase: SupabaseClient, rijen: WachtrijRij[]): Promise<{ gepland: number; fout: string | null }> {
  if (rijen.length === 0) return { gepland: 0, fout: null };
  const leadIds = [...new Set(rijen.map(r => r.lead_id))];
  const bestaand = new Map<string, { id: string; status: string }>();
  for (let i = 0; i < leadIds.length; i += 200) {
    const { data, error } = await supabase
      .from('geplande_leadleveringen')
      .select('id, lead_id, customer_id, status')
      .in('lead_id', leadIds.slice(i, i + 200));
    if (error) return { gepland: 0, fout: error.message };
    for (const r of data ?? []) bestaand.set(`${r.lead_id}:${r.customer_id}`, { id: r.id as string, status: r.status as string });
  }

  const nieuw: WachtrijRij[] = [];
  let gepland = 0;
  let fout: string | null = null;
  for (const r of rijen) {
    const oud = bestaand.get(`${r.lead_id}:${r.customer_id}`);
    if (!oud) { nieuw.push(r); continue; }
    if (oud.status === 'gepland' || oud.status === 'geleverd') continue;
    const { error } = await supabase
      .from('geplande_leadleveringen')
      .update({ ...r, status: 'gepland', pogingen: 0, laatste_reden: null, geleverd_op: null, assignment_id: null })
      .eq('id', oud.id)
      .neq('status', 'gepland');
    if (error) fout = error.message;
    else gepland++;
  }
  if (nieuw.length > 0) {
    const { data, error } = await supabase
      .from('geplande_leadleveringen')
      .upsert(nieuw.map(r => ({ ...r, status: 'gepland', pogingen: 0 })), { onConflict: 'lead_id,customer_id', ignoreDuplicates: true })
      .select('id');
    if (error) fout = error.message;
    else gepland += data?.length ?? 0;
  }
  return { gepland, fout };
}
