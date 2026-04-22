import { ReactNode } from 'react';
import { ArrowPathIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/portalFormat';
import { T } from './tokens';

export interface OrderLine {
  label: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'muted' | 'strike' | 'positive' | 'negative';
}

interface OrderSummaryCardProps {
  lines: OrderLine[];
  total: number;
  ctaLabel?: string;
  onCheckout?: () => void;
  submitting?: boolean;
  disabled?: boolean;
  helper?: ReactNode;
  className?: string;
}

const TONES: Record<NonNullable<OrderLine['tone']>, string> = {
  default: 'text-sm font-medium text-slate-800',
  muted: 'text-sm text-slate-500',
  strike: 'text-sm font-medium text-slate-400 line-through',
  positive: 'text-sm font-medium text-emerald-600',
  negative: 'text-sm font-medium text-red-600',
};

/**
 * Standaard prijsopsomming-kaart voor het bestelproces.
 * Deskop heeft inline CTA; mobile UI gebruikt losse `StickyCheckoutBar`.
 */
export function OrderSummaryCard({
  lines,
  total,
  ctaLabel = 'Afrekenen',
  onCheckout,
  submitting = false,
  disabled = false,
  helper,
  className = '',
}: OrderSummaryCardProps) {
  return (
    <div className={`${T.card} ${className}`.trim()}>
      <div className="space-y-0 divide-y divide-slate-100 px-5 py-4">
        {lines.map((l, i) => {
          const tone = l.tone || 'default';
          const labelCls =
            tone === 'muted' || tone === 'strike' ? 'text-sm text-slate-500' : TONES[tone].replace(/text-slate-\d+/, 'text-slate-500').replace('font-medium', 'text-sm');
          return (
            <div key={i} className={`flex items-center justify-between ${i === 0 ? 'pb-3' : i === lines.length - 1 ? 'pt-3' : 'py-3'}`}>
              <span className={tone === 'positive' || tone === 'negative' ? TONES[tone] : labelCls}>{l.label}</span>
              <span className={TONES[tone]}>{l.value}</span>
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-3">
          <span className="text-sm font-bold text-slate-900">Totaal</span>
          <span className="text-lg font-bold text-brand-purple">{formatCurrency(total)}</span>
        </div>
      </div>

      {onCheckout && (
        <div className="hidden border-t border-slate-100 p-4 sm:block">
          <button
            type="button"
            onClick={onCheckout}
            disabled={submitting || disabled}
            className={T.btnPrimaryLg}
          >
            {submitting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Wordt verwerkt...
              </>
            ) : (
              <>
                <CreditCardIcon className="h-5 w-5" />
                {ctaLabel} &middot; {formatCurrency(total)}
              </>
            )}
          </button>
          {helper && <div className="mt-3 px-1">{helper}</div>}
        </div>
      )}
    </div>
  );
}
