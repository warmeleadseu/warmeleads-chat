/**
 * WARMELEADS CHECKBOX COMPONENT
 * 
 * Accessible checkbox component
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  error?: boolean;
  errorMessage?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      label,
      description,
      error,
      errorMessage,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = error || !!errorMessage;

    return (
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            type="checkbox"
            ref={ref}
            id={checkboxId}
            disabled={disabled}
            className={cn(
              'w-4 h-4 text-primary-600 bg-white border-neutral-300 rounded',
              'focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2',
              'transition-all duration-200 cursor-pointer',
              'disabled:cursor-not-allowed disabled:opacity-50',
              hasError && 'border-error-500',
              className
            )}
            {...props}
          />
        </div>

        {(label || description) && (
          <div className="ml-3 text-sm">
            {label && (
              <label
                htmlFor={checkboxId}
                className={cn(
                  'font-medium select-none',
                  disabled
                    ? 'text-neutral-400 cursor-not-allowed'
                    : 'text-neutral-700 cursor-pointer'
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-neutral-500 mt-0.5">{description}</p>
            )}
            {errorMessage && (
              <p className="text-error-600 mt-0.5">{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };

