'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import type { BatchWinst } from '@/lib/batchWinst';

/**
 * Winst van één batch in de batchkaart: wat hij tot nu toe opbracht, wat zijn
 * leads kostten en wat er overblijft. Alleen voor superadmins (de API weigert
 * anderen; dan toont dit blok niets).
 */

const EURO = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EURO2 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BRON: Record<BatchWinst['omzetBron'], string> = {
  factuur: 'factuur in het systeem',
  extern: 'extern bedrag',
  batchprijs: 'batchprijs',
};
const BETAAL: Record<BatchWinst['betaalwijze'], string> = {
  mollie: 'via Mollie',
  factuur: 'via factuur',
  extern: 'extern gefactureerd',
  open: 'nog niet betaald',
};

export default function BatchWinstBlok({ batchId }: { batchId: string }) {
  const [w, setW] = useState<BatchWinst | null>(null);
  const [extNr, setExtNr] = useState<string | null>(null);
  const [verborgen, setVerborgen] = useState(false);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    let weg = false;
    setW(null);
    setFout(false);
    void adminFetch(`/api/admin/winst/${batchId}?samenvatting=1`, { cache: 'no-store' })
      .then(async res => {
        if (weg) return;
        if (res.status === 401 || res.status === 403) { setVerborgen(true); return; }
        const d = (await res.json().catch(() => ({}))) as { samenvatting?: BatchWinst; extern_factuurnummer?: string | null };
        if (!res.ok || !d.samenvatting) { setFout(true); return; }
        setW(d.samenvatting);
        setExtNr(d.extern_factuurnummer ?? null);
      })
      .catch(() => { if (!weg) setFout(true); });
    return () => { weg = true; };
  }, [batchId]);

  if (verborgen) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Winst</p>
        <Link href="/admin/winst" className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-brand-purple">
          Alle batches <ArrowTopRightOnSquareIcon className="h-3 w-3" />
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {fout ? (
          <p className="text-xs text-slate-500">De winst kon niet worden berekend.</p>
        ) : !w ? (
          <div className="h-20 animate-pulse rounded-lg bg-slate-50" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-slate-400">Omzet</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{EURO.format(w.gerealiseerd)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Leadkosten</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{EURO.format(w.kosten)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Winst</p>
                <p className={`text-sm font-bold tabular-nums ${w.winst >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {EURO.format(w.winst)}
                  {w.marge != null && <span className="ml-1 text-[11px] font-medium text-slate-400">{w.marge.toLocaleString('nl-NL')}%</span>}
                </p>
              </div>
            </div>
            <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
              <div className="flex justify-between gap-2">
                <span>Gefactureerd</span>
                <span className="text-right text-slate-700">{EURO2.format(w.omzet)} <span className="text-slate-400">({BRON[w.omzetBron]}, {BETAAL[w.betaalwijze]}{extNr ? `, ${extNr}` : ''})</span></span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Geleverd</span>
                <span className="tabular-nums text-slate-700">{w.geleverd + w.geleverdExtern} van {w.grootte}</span>
              </div>
              {w.kostenPerLead != null && (
                <div className="flex justify-between gap-2">
                  <span>Kosten per lead</span>
                  <span className="tabular-nums text-slate-700">
                    {EURO2.format(w.kostenPerLead)}
                    {w.gedeeldGemiddeld ? <span className="text-slate-400"> (gem. gedeeld met {w.gedeeldGemiddeld.toLocaleString('nl-NL')})</span> : null}
                  </span>
                </div>
              )}
              {w.prognoseWinst != null && w.voortgang < 1 && (
                <div className="flex justify-between gap-2">
                  <span>Prognose als hij vol is</span>
                  <span className={`tabular-nums font-medium ${w.prognoseWinst >= 0 ? 'text-slate-700' : 'text-red-600'}`}>{EURO.format(w.prognoseWinst)}</span>
                </div>
              )}
              {w.leadsZonderKosten > 0 && (
                <p className="text-[11px] text-amber-600">{w.leadsZonderKosten} leads zonder bekende kosten (geen campagne of vóór 1 mei 2026).</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
