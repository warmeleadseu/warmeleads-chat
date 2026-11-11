/**
 * Laatst bekende campagnenamen uit onze eigen Meta-kostendata (`meta_ad_spend`).
 *
 * Terugval voor wanneer de naam niet live bij Meta op te halen is (token,
 * limiet, storing), zodat het CRM bij een gekoppelde campagne de naam toont
 * in plaats van alleen het nummer. Per campagne de nieuwste regel: campagnes
 * worden hernoemd, de laatste naam is de herkenbaarste.
 */

type Rij = { campaign_name: string | null };
type Query = {
  select: (cols: string) => Query;
  eq: (col: string, v: string) => Query;
  not: (col: string, op: string, v: null) => Query;
  order: (col: string, o: { ascending: boolean }) => Query;
  limit: (n: number) => PromiseLike<{ data: Rij[] | null; error: unknown }>;
};
export type NamenClient = { from: (tabel: string) => unknown };

export async function laadOpgeslagenCampagneNamen(supabase: NamenClient, ids: string[]): Promise<Map<string, string>> {
  const namen = new Map<string, string>();
  await Promise.all(
    ids.map(async id => {
      try {
        const { data, error } = await (supabase.from('meta_ad_spend') as Query)
          .select('campaign_name')
          .eq('campaign_id', id)
          .not('campaign_name', 'is', null)
          .order('date', { ascending: false })
          .limit(1);
        const naam = !error ? data?.[0]?.campaign_name?.trim() : '';
        if (naam) namen.set(id, naam);
      } catch {
        /* zonder naam verder: dan blijft het nummer staan */
      }
    }),
  );
  return namen;
}
