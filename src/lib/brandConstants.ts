/**
 * WarmeLeads Brand Constants
 * 
 * Centralized brand colors, gradients, and design tokens
 * USE THESE EVERYWHERE to ensure consistency!
 */

// ========================================
// BRAND COLORS
// ========================================

export const BRAND_COLORS = {
  navy: '#1A1A2E',
  purple: '#3B2F75',
  pink: '#E74C8C',
  orange: '#FF6B35',
  red: '#FF4757',
  gray: '#F8F9FA',
  success: '#2ECC71',
} as const;

// ========================================
// OFFICIAL BRAND GRADIENT
// ========================================

/**
 * The ONE TRUE GRADIENT for WarmeLeads
 * Use this for all background gradients across the website
 */
export const BRAND_GRADIENT = {
  // Tailwind classes - USE THIS IN JSX
  tailwind: 'bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink',
  
  // CSS string - use in inline styles if needed
  css: 'linear-gradient(to bottom right, #1A1A2E, #3B2F75, #E74C8C)',
  
  // Object format for styled-components or CSS-in-JS
  object: {
    background: 'linear-gradient(to bottom right, #1A1A2E, #3B2F75, #E74C8C)',
  },
} as const;

// ========================================
// BUTTON GRADIENTS
// ========================================

export const BUTTON_GRADIENTS = {
  primary: 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700',
  secondary: 'bg-gradient-to-r from-brand-purple to-brand-pink hover:from-purple-700 hover:to-pink-700',
} as const;

// ========================================
// SHADOW STYLES
// ========================================

export const SHADOWS = {
  card: '0 4px 20px rgba(59, 47, 117, 0.15)',
  button: '0 4px 15px rgba(255, 107, 53, 0.3)',
  modal: '0 20px 60px rgba(26, 26, 46, 0.4)',
} as const;

// ========================================
// USAGE EXAMPLES
// ========================================

/*
CORRECT USAGE:

// In JSX/TSX:
<div className={BRAND_GRADIENT.tailwind}>
  Content here
</div>

// Or use the CSS class:
<div className="bg-brand-gradient">
  Content here
</div>

// In inline styles:
<div style={{ background: BRAND_GRADIENT.css }}>
  Content here
</div>

WRONG - DON'T DO THIS:
<div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500">
  ❌ Wrong colors!
</div>
*/

