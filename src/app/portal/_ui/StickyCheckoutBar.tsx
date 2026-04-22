import { ArrowPathIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/portalFormat';
import { T } from './tokens';

interface StickyCheckoutBarProps {
  total: number;
  onCheckout: () => void;
  submitting?: boolean;
  disabled?: boolean;
  label?: string;
}

export function StickyCheckoutBar({
  total,
  onCheckout,
  submitting = false,
  disabled = false,
  label = 'Afrekenen',
}: StickyCheckoutBarProps) {
  return (
    <div className={T.stickyBar}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">Totaal incl. BTW</p>
        <p className="text-base font-bold text-brand-purple">{formatCurrency(total)}</p>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={submitting || disabled}
        className={T.btnPrimary + ' w-full'}
      >
        {submitting ? (
          <>
            <ArrowPathIcon className="h-5 w-5 animate-spin" />
            Wordt verwerkt...
          </>
        ) : (
          <>
            <CreditCardIcon className="h-5 w-5" />
            {label}
          </>
        )}
      </button>
    </div>
  );
}
