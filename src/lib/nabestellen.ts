/**
 * Wanneer een klant in het portaal een nabestelsuggestie krijgt.
 *
 * Een betaalde leadbatch die voor 80% of meer vol is, of die de afgelopen 21
 * dagen is afgerond, en waarvoor de klant in dezelfde branche nog geen nieuwe
 * batch heeft (actief, gepauzeerd of al besteld en wacht op betaling). De mail
 * bij 80% en 100% bestond al; dit is dezelfde boodschap in het portaal zelf,
 * zodat de klant hem ziet op het moment dat hij er is.
 */

export type NabestelBatch = {
  id: string;
  branch: string;
  batch_kind?: string | null;
  delivery_model?: string | null;
  status: string;
  is_paid?: boolean | null;
  batch_size: number;
  leads_delivered: number;
  created_at: string;
  completed_at?: string | null;
};

export type NabestelSuggestie = {
  batch_id: string;
  branch: string;
  status: 'bijna_vol' | 'vol';
  procent: number;
  geleverd: number;
  grootte: number;
};

export const NABESTEL_DREMPEL = 0.8;
export const NABESTEL_VENSTER_DAGEN = 21;

const LOPEND = new Set(['active', 'paused', 'pending_payment']);

export function kiesNabestelSuggestie(batches: NabestelBatch[], nu: Date = new Date()): NabestelSuggestie | null {
  const leads = batches.filter(b => (b.batch_kind ?? 'leads') === 'leads' && b.delivery_model !== 'manual' && b.delivery_model !== 'unlimited');
  const venster = nu.getTime() - NABESTEL_VENSTER_DAGEN * 86_400_000;

  const kandidaten = leads.filter(b => {
    if (!b.is_paid || !(b.batch_size > 0)) return false;
    const vol = b.leads_delivered / b.batch_size;
    const bijnaVol = b.status === 'active' && vol >= NABESTEL_DREMPEL;
    const netKlaar = b.status === 'completed' && !!b.completed_at && new Date(b.completed_at).getTime() >= venster;
    if (!bijnaVol && !netKlaar) return false;
    /* Al nabesteld: een latere batch in dezelfde branche die loopt of klaarstaat. */
    const alNabesteld = leads.some(n =>
      n.id !== b.id && n.branch === b.branch && LOPEND.has(n.status) &&
      new Date(n.created_at).getTime() > new Date(b.created_at).getTime(),
    );
    return !alNabesteld;
  });
  if (kandidaten.length === 0) return null;

  /* Een volle batch eerst (de klant krijgt nu niets meer), daarna de volste. */
  kandidaten.sort((a, b) => {
    const va = a.status === 'completed' ? 2 : a.leads_delivered / a.batch_size;
    const vb = b.status === 'completed' ? 2 : b.leads_delivered / b.batch_size;
    return vb - va;
  });
  const k = kandidaten[0];
  return {
    batch_id: k.id,
    branch: k.branch,
    status: k.status === 'completed' ? 'vol' : 'bijna_vol',
    procent: Math.min(100, Math.round((k.leads_delivered / k.batch_size) * 100)),
    geleverd: k.leads_delivered,
    grootte: k.batch_size,
  };
}
