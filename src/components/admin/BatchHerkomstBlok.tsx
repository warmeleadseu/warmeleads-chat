'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import type { BatchHerkomst } from '@/lib/campagneEffectiviteit';

/**
 * Waar de leads van één batch vandaan kwamen: uit de gekoppelde Meta-
 * campagne(s), uit andere campagnes of zonder campagne, met per koppeling hoe
 * die liep. Alleen voor superadmins (de API weigert anderen; dan toont dit
 * blok niets).
 */

const EURO2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EURO = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const datum = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

export default function BatchHerkomstBlok({ batchId }: { batchId: string }) {
  const [h, setH] = useState<BatchHerkomst | null>(null);
  const [verborgen, setVerborgen] = useState(false);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    let weg = false;
    setH(null);
    setFout(false);
    void adminFetch(`/api/admin/campagnes/herkomst?batch=${batchId}`, { cache: 'no-store' })
      .then(async res => {
        if (weg) return;
        if (res.status === 401 || res.status === 403) { setVerborgen(true); return; }
        const d = (await res.json().catch(() => null)) as BatchHerkomst | null;
        if (!res.ok || !d) { setFout(true); return; }
        setH(d);
      })
      .catch(() => { if (!weg) setFout(true); });
    return () => { weg = true; };
  }, [batchId]);

  if (verborgen) return null;
  const pct = (n: number) => (h && h.leveringen ? ` (${Math.round((n / h.leveringen) * 100)}%)` : '');

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Herkomst leads</p>
        <Link href="/admin/campagnes" className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-brand-purple">
          Alle campagnes <ArrowTopRightOnSquareIcon className="h-3 w-3" />
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {fout ? (
          <p className="text-xs text-slate-500">De herkomst kon niet worden geladen.</p>
        ) : !h ? (
          <div className="h-16 animate-pulse rounded-lg bg-slate-50" />
        ) : h.leveringen === 0 && h.koppelingen.length === 0 ? (
          <p className="text-xs text-slate-500">Nog geen leads geleverd en geen campagne gekoppeld.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-slate-400">Eigen campagne</p>
                <p className="text-sm font-bold tabular-nums text-slate-800">{h.uit_gekoppeld}<span className="text-[11px] font-medium text-slate-400">{pct(h.uit_gekoppeld)}</span></p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Andere campagnes</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{h.uit_andere}<span className="text-[11px] font-medium text-slate-400">{pct(h.uit_andere)}</span></p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Zonder campagne</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{h.zonder_campagne}</p>
              </div>
            </div>

            {h.koppelingen.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-100 pt-2 text-xs">
                <p className="font-medium text-slate-600">Gekoppelde campagnes</p>
                {h.koppelingen.map(k => (
                  <div key={`${k.campaign_id}-${k.van}`} className="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p className="truncate font-medium text-slate-800" title={k.naam}>{k.naam}</p>
                    <p className="text-slate-500">
                      {k.geschat ? 'Sinds aanmaken batch (geschat)' : `Vanaf ${datum(k.van)}`}{k.tot ? ` tot ${datum(k.tot)}` : ', nog gekoppeld'}
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {k.naar_batch} van de {k.binnen} leads naar deze batch
                      {k.uitgaven > 0 && <> · {EURO.format(k.uitgaven)} uitgegeven{k.kosten_per_lead_naar_batch !== null && <> · <span className="font-medium text-slate-800">{EURO2.format(k.kosten_per_lead_naar_batch)}</span> per lead voor deze batch</>}</>}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {h.andere_campagnes.length > 0 && (
              <div className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                <p className="mb-1 font-medium text-slate-600">Uit andere campagnes</p>
                <ul className="space-y-0.5">
                  {h.andere_campagnes.slice(0, 5).map(a => (
                    <li key={a.campaign_id} className="flex justify-between gap-2"><span className="truncate" title={a.naam}>{a.naam}</span><span className="tabular-nums text-slate-700">{a.leads}</span></li>
                  ))}
                  {h.andere_campagnes.length > 5 && <li className="text-slate-400">en nog {h.andere_campagnes.length - 5} campagnes</li>}
                </ul>
              </div>
            )}
            {h.geschat && <p className="text-[11px] text-slate-400">Koppelingen van vóór 6 november 2026 zijn geschat: toen werd de geschiedenis nog niet bijgehouden.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
