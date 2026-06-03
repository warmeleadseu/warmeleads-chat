'use client';

import { CreditCardIcon } from '@heroicons/react/24/outline';
import {
  portalBatchPricePerUnit,
  portalBatchUnitLabel,
  type PortalBatchLike,
} from '@/lib/portalBatches';
import { formatCurrency, roundMoney } from '@/lib/portalFormat';
import { isReverseChargeRate, vatTotalSuffix, vatUnitSuffix } from '@/lib/invoiceVat';

type Props = {
  batches: PortalBatchLike[];
  btwRate: number;
  payingBatchId: string | null;
  onPay: (batchId: string) => void;
  /** Optioneel: override voor enkelvoudige copy (anders afgeleid van aantal batches). */
  intro?: string;
  className?: string;
};

export function PortalPendingBatchesCard({
  batches,
  btwRate,
  payingBatchId,
  onPay,
  intro,
  className = '',
}: Props) {
  if (batches.length === 0) return null;

  const reverseCharge = isReverseChargeRate(btwRate);
  const unitSuffix = vatUnitSuffix({ reverseCharge });
  const totalSuffix = vatTotalSuffix({ reverseCharge });

  const defaultIntro =
    batches.length === 1
      ? 'Je accountmanager heeft een batch voor je klaargezet. Betaal om de levering te starten.'
      : `Je accountmanager heeft ${batches.length} batches voor je klaargezet. Betaal per batch om de levering te starten.`;

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/80 p-4 shadow-sm ${className}`}
    >
      <p className="text-sm font-bold text-amber-950">Betaling openstaand</p>
      <p className="mt-0.5 text-xs text-amber-900/90">{intro ?? defaultIntro}</p>
      <ul className="mt-3 space-y-2">
        {batches.map(b => {
          const unit = portalBatchUnitLabel(b);
          const ex = Number(b.total_price || 0);
          const incl = roundMoney(ex * (1 + btwRate));
          const branchLabel = String(b.branch_name || b.branch || 'Batch');
          const size = Number(b.batch_size || 0);
          const pricePer = portalBatchPricePerUnit(b);

          return (
            <li
              key={b.id}
              className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {branchLabel} · {size} {unit}
                  {b.batch_name ? (
                    <span className="ml-1 font-normal text-slate-500">({b.batch_name})</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">
                  {pricePer > 0 ? (
                    <>
                      {formatCurrency(pricePer)} per stuk{unitSuffix} ·{' '}
                    </>
                  ) : null}
                  <span className="font-medium text-slate-700">{formatCurrency(incl)} {totalSuffix}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPay(b.id)}
                disabled={payingBatchId === b.id}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-orange to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
              >
                <CreditCardIcon className="h-4 w-4" />
                {payingBatchId === b.id ? 'Bezig...' : 'Nu betalen'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
