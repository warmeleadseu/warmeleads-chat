'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';
import {
  activeCustomerTargets,
  formatCustomerTargetSummary,
  parseCustomerTargets,
  type CustomerTargetRow,
} from '@/lib/batchTargetAreas';

function targetsFromProps(
  customers: { customer_targets?: unknown } | null | undefined,
  targets: unknown | undefined,
): CustomerTargetRow[] {
  const raw = targets !== undefined ? targets : customers?.customer_targets;
  return parseCustomerTargets(raw);
}

type Variant = 'default' | 'dark' | 'compact';

const VARIANT_CHIP: Record<Variant, string> = {
  default: 'border-brand-purple/20 bg-brand-purple/[0.07] text-brand-purple',
  compact: 'border-slate-200 bg-slate-50 text-slate-700',
  dark: 'border-white/[0.08] bg-white/[0.06] text-white/65',
};

const VARIANT_WARN: Record<Variant, string> = {
  default: 'border-amber-200 bg-amber-50 text-amber-900',
  compact: 'border-amber-200 bg-amber-50 text-amber-900',
  dark: 'border-amber-400/25 bg-amber-500/15 text-amber-100',
};

const VARIANT_ICON: Record<Variant, string> = {
  default: 'text-slate-400',
  compact: 'text-slate-400',
  dark: 'text-white/35',
};

/**
 * Toont actieve klant-targets die de distributie gebruikt voor lead-batches.
 * `customers` komt uit PostgREST op `customer_batches` / `appointment_batches`.
 */
export function BatchTargetAreaBadges({
  customers,
  targets,
  presetLabels,
  variant = 'default',
  className = '',
  showHeading = false,
}: {
  customers?: { customer_targets?: unknown } | null;
  targets?: unknown;
  /** Reeds geformatteerde regels (bijv. live-stats); dan geen `customer_targets` nodig. */
  presetLabels?: string[];
  variant?: Variant;
  className?: string;
  /** Alleen in batch-detailpaneel; in tabellen weglaten. */
  showHeading?: boolean;
}) {
  const chipCls = VARIANT_CHIP[variant];
  const warnCls = VARIANT_WARN[variant];
  const iconCls = VARIANT_ICON[variant];

  if (presetLabels !== undefined) {
    const title = presetLabels.join(' — ');
    if (presetLabels.length === 0) {
      return (
        <div className={`flex flex-col gap-1 ${className}`}>
          {showHeading && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Targetgebieden</p>
          )}
          <div className="flex flex-wrap items-center gap-1" title="Geen actieve customer_targets — leads worden niet geo-gematcht">
            <span
              className={`inline-flex max-w-full items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${warnCls}`}
            >
              <MapPinIcon className="h-3 w-3 shrink-0" aria-hidden />
              Geen actieve targetgebieden
            </span>
          </div>
        </div>
      );
    }
    return (
      <div className={`flex flex-col gap-1 ${className}`} title={title}>
        {showHeading && (
          <p className={`text-[11px] font-semibold uppercase tracking-wider ${variant === 'dark' ? 'text-white/35' : 'text-slate-400'}`}>
            Targetgebieden (actief)
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <MapPinIcon className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} aria-hidden />
          {presetLabels.map((text, i) => (
            <span
              key={`${i}-${text.slice(0, 32)}`}
              className={`max-w-[min(100%,14rem)] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${chipCls}`}
            >
              {text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const list = targetsFromProps(customers, targets);
  const active = activeCustomerTargets(list);
  const title = active.map(formatCustomerTargetSummary).join(' — ');

  if (active.length === 0) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {showHeading && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Targetgebieden</p>
        )}
        <div className="flex flex-wrap items-center gap-1" title="Geen actieve customer_targets — leads worden niet geo-gematcht">
          <span
            className={`inline-flex max-w-full items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${warnCls}`}
          >
            <MapPinIcon className="h-3 w-3 shrink-0" aria-hidden />
            Geen actieve targetgebieden
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`} title={title || undefined}>
      {showHeading && (
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${variant === 'dark' ? 'text-white/35' : 'text-slate-400'}`}>
          Targetgebieden (actief)
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <MapPinIcon className={`h-3.5 w-3.5 shrink-0 ${iconCls}`} aria-hidden />
        {active.map(t => (
          <span
            key={String(t.id || formatCustomerTargetSummary(t))}
            className={`max-w-[min(100%,14rem)] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${chipCls}`}
          >
            {formatCustomerTargetSummary(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
