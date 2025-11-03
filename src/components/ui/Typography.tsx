/**
 * Typography System
 * 
 * Consistent heading and text styles across the entire app
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ========================================
// HEADING COMPONENT
// ========================================

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  variant?: 'display' | 'hero' | 'section' | 'subsection' | 'card' | 'small';
}

const headingStyles = {
  display: 'text-5xl sm:text-6xl lg:text-7xl font-bold',
  hero: 'text-4xl sm:text-5xl lg:text-6xl font-bold',
  section: 'text-3xl sm:text-4xl font-bold',
  subsection: 'text-2xl sm:text-3xl font-semibold',
  card: 'text-xl font-semibold',
  small: 'text-lg font-semibold',
};

export const Heading: React.FC<HeadingProps> = ({
  as = 'h2',
  variant = 'section',
  className,
  children,
  ...props
}) => {
  const Component = as;

  return (
    <Component className={cn(headingStyles[variant], className)} {...props}>
      {children}
    </Component>
  );
};

// ========================================
// TEXT COMPONENT
// ========================================

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'body' | 'small' | 'tiny' | 'lead';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'default' | 'muted' | 'white' | 'white-muted' | 'success' | 'danger' | 'warning';
}

const textStyles = {
  body: 'text-base',
  small: 'text-sm',
  tiny: 'text-xs',
  lead: 'text-lg',
};

const weightStyles = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colorStyles = {
  default: 'text-gray-900',
  muted: 'text-gray-600',
  white: 'text-white',
  'white-muted': 'text-white/80',
  success: 'text-green-600',
  danger: 'text-red-600',
  warning: 'text-yellow-600',
};

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  weight = 'normal',
  color = 'default',
  className,
  children,
  ...props
}) => {
  return (
    <p
      className={cn(
        textStyles[variant],
        weightStyles[weight],
        colorStyles[color],
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
};

// ========================================
// LABEL COMPONENT
// ========================================

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  variant?: 'light' | 'dark';
}

export const Label: React.FC<LabelProps> = ({
  required,
  variant = 'light',
  className,
  children,
  ...props
}) => {
  return (
    <label
      className={cn(
        'block text-sm font-medium mb-2',
        variant === 'dark' ? 'text-white/80' : 'text-gray-700',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
};

