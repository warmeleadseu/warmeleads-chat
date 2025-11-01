/**
 * WARMELEADS INPUT COMPONENT
 * 
 * Professional input component with variants
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'w-full transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-neutral-300 rounded-lg px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
        filled:
          'bg-neutral-100 border-transparent rounded-lg px-4 py-2 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
        outline:
          'border-2 border-primary-200 rounded-lg px-4 py-2 focus:border-primary-500',
      },
      inputSize: {
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
      inputSize: 'md',
      error: false,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant,
      inputSize,
      error,
      label,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = error || !!errorMessage;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputVariants({ variant, inputSize, error: hasError, className }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10'
            )}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {rightIcon}
            </div>
          )}
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

Input.displayName = 'Input';

export { Input, inputVariants };

