import { PricingTier, isActiveTier } from './math';

interface PricingTierLegendProps {
  tiers: PricingTier[];
  effectiveSize: number;
  unitLabel?: string;
  isCustom?: boolean;
}

export function PricingTierLegend({
  tiers,
  effectiveSize,
  unitLabel = 'leads',
  isCustom = false,
}: PricingTierLegendProps) {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min_leads - b.min_leads);

  return (
    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Staffelprijzen</p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((t, i) => {
          const active = isActiveTier(sorted, i, effectiveSize);
          return (
            <span
              key={i}
              className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                active
                  ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {t.min_leads}+ {unitLabel} &rarr; &euro;{Number(t.price_per_lead).toFixed(2)}
            </span>
          );
        })}
      </div>
      {isCustom && <p className="mt-1.5 text-[10px] font-medium text-amber-600">Speciaal tarief voor je bedrijf</p>}
    </div>
  );
}
