/**
 * WARMELEADS SELECT COMPONENT
 * 
 * Professional select/dropdown component
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const selectVariants = cva(
  'w-full transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-no-repeat',
  {
    variants: {
      variant: {
        default:
          'border border-neutral-300 rounded-lg px-4 py-2 pr-10 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
        filled:
          'bg-neutral-100 border-transparent rounded-lg px-4 py-2 pr-10 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
        outline:
          'border-2 border-primary-200 rounded-lg px-4 py-2 pr-10 focus:border-primary-500',
      },
      selectSize: {
        sm: 'h-9 text-sm',
        md: 'h-10 text-base',
        lg: 'h-12 text-lg',
      },
      error: {
        true: 'border-error-500 focus:border-error-500 focus:ring-error-500/20',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      selectSize: 'md',
      error: false,
    },
  }
);

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      variant,
      selectSize,
      error,
      label,
      helperText,
      errorMessage,
      options,
      placeholder,
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = error || !!errorMessage;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              selectVariants({ variant, selectSize, error: hasError, className })
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* Chevron icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {(helperText || errorMessage) && (
          <p
            className={cn(
              'mt-1.5 text-sm',
              hasError ? 'text-error-600' : 'text-neutral-600'
            )}
          >
            {errorMessage || helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select, selectVariants };

