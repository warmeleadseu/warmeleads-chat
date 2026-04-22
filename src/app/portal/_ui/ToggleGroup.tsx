import { ReactNode } from 'react';
import { T } from './tokens';

export interface ToggleOption<V extends string | number> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface ToggleGroupProps<V extends string | number> {
  value: V;
  onChange: (v: V) => void;
  options: ToggleOption<V>[];
  className?: string;
  fullWidth?: boolean;
  ariaLabel?: string;
}

/**
 * Pill-row toggle die als product-tabs, sub-nav, en view-switcher wordt gebruikt.
 * Op mobiel staan items in een inline-flex container met lichte slate-100 bg.
 */
export function ToggleGroup<V extends string | number>({
  value,
  onChange,
  options,
  className = '',
  fullWidth = false,
  ariaLabel,
}: ToggleGroupProps<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`${T.pillGroup} ${fullWidth ? 'w-full sm:w-auto' : ''} ${className}`.trim()}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`${T.pillItem} ${fullWidth ? 'flex-1 sm:flex-initial' : ''} ${
              active ? T.pillActive : T.pillIdle
            } disabled:cursor-not-allowed disabled:opacity-60`.trim()}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
