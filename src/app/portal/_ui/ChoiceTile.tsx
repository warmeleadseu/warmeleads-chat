import { ReactNode } from 'react';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { T } from './tokens';

interface ChoiceTileProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Een klikbare keuzekaart voor grid-selecties (batch-size, snelheid, etc.).
 * Active state krijgt brand-purple border, lichte bg, en een check-mark rechtsboven.
 */
export function ChoiceTile({
  selected = false,
  disabled = false,
  onClick,
  title,
  meta,
  footer,
  icon,
  className = '',
}: ChoiceTileProps) {
  const stateCls = selected ? T.tileActive : T.tileIdle;
  const titleColor = selected ? 'text-brand-purple' : 'text-slate-900';
  const footerColor = selected ? 'text-brand-purple' : 'text-slate-500';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${T.tileBase} ${stateCls} disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
    >
      {selected && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />}
      {icon && <div className="mb-1">{icon}</div>}
      <p className={`text-2xl font-bold ${titleColor}`}>{title}</p>
      {meta && <p className="text-[11px] text-slate-400">{meta}</p>}
      {footer && <p className={`mt-1 text-xs font-semibold ${footerColor}`}>{footer}</p>}
    </button>
  );
}

/**
 * Compacte pill-variant voor inline branch-keuzes of status-filters.
 */
export function ChoicePill({
  selected = false,
  onClick,
  children,
  className = '',
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const stateCls = selected
    ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${stateCls} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
