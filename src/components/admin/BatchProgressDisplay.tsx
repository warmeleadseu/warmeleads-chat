'use client';

import {
  getBatchProgressView,
  progressBarColorClass,
  type BatchProgressInput,
} from '@/lib/batchDeliveryModel';

type Props = BatchProgressInput & {
  /** sm = table row, md = card/detail */
  size?: 'sm' | 'md';
  className?: string;
};

export function BatchProgressDisplay({
  size = 'sm',
  className = '',
  ...batch
}: Props) {
  const view = getBatchProgressView(batch);
  const barH = size === 'md' ? 'h-3' : 'h-2';
  const barW = size === 'sm' ? 'w-24' : 'w-full';

  if (view.progressPercent === null) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <span
          className={`font-semibold text-fuchsia-900 ${size === 'md' ? 'text-lg' : 'text-xs'}`}
        >
          {view.primaryLabel}
        </span>
        <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-medium text-fuchsia-800">
          Doorlopend
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={`flex items-center gap-3 ${size === 'md' ? 'mb-2' : ''}`}>
        {size === 'sm' && (
          <div className={barW}>
            <div className={`${barH} overflow-hidden rounded-full bg-slate-100`}>
              <div
                className={`${barH} rounded-full transition-all ${progressBarColorClass(view.progressPercent)}`}
                style={{ width: `${view.progressPercent}%` }}
              />
            </div>
          </div>
        )}
        <div className="min-w-0">
          <span
            className={`whitespace-nowrap text-slate-600 ${size === 'md' ? 'text-sm' : 'text-xs'}`}
          >
            <span className={`font-bold text-slate-800 ${size === 'md' ? 'text-lg' : ''}`}>
              {view.primaryLabel}
            </span>
            {view.secondaryLabel && (
              <span className="text-slate-400"> {view.secondaryLabel}</span>
            )}
            {view.showOverdelivery && view.overdeliveryLabel && (
              <span className="ml-1 text-[10px] font-medium text-amber-600">
                {view.overdeliveryLabel}
              </span>
            )}
            {!view.showOverdelivery && view.overdeliveryLabel && (
              <span className="ml-1 text-[10px] font-medium text-slate-500">
                {view.overdeliveryLabel}
              </span>
            )}
          </span>
        </div>
      </div>
      {size === 'md' && (
        <div className={`${barH} overflow-hidden rounded-full bg-slate-200`}>
          <div
            className={`${barH} rounded-full transition-all ${progressBarColorClass(view.progressPercent)}`}
            style={{ width: `${view.progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
