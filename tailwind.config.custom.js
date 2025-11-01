/**
 * WARMELEADS TAILWIND CONFIG
 * 
 * Custom Tailwind configuratie met design tokens
 * Merge deze met je bestaande tailwind.config.js
 */

// Import design tokens
const { designTokens } = require('./src/config/design-tokens');

module.exports = {
  theme: {
    extend: {
      // Colors
      colors: {
        primary: designTokens.colors.primary,
        secondary: designTokens.colors.secondary,
        accent: {
          purple: designTokens.colors.accent.purple,
          violet: designTokens.colors.accent.violet,
        },
        neutral: designTokens.colors.neutral,
        success: designTokens.colors.success,
        warning: designTokens.colors.warning,
        error: designTokens.colors.error,
        info: designTokens.colors.info,
      },
      
      // Custom gradient
      backgroundImage: {
        'gradient-primary': designTokens.colors.accent.gradient,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      
      // Typography
      fontFamily: {
        sans: designTokens.typography.fonts.sans.split(', '),
        mono: designTokens.typography.fonts.mono.split(', '),
      },
      
      fontSize: designTokens.typography.sizes,
      fontWeight: designTokens.typography.weights,
      lineHeight: designTokens.typography.lineHeights,
      
      // Spacing
      spacing: designTokens.spacing,
      
      // Border radius
      borderRadius: designTokens.radius,
      
      // Box shadow
      boxShadow: designTokens.shadows,
      
      // Transitions
      transitionDuration: designTokens.transitions.durations,
      transitionTimingFunction: designTokens.transitions.easings,
      
      // Z-index
      zIndex: designTokens.zIndex,
      
      // Animations
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'slide-in-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        bounce: {
          '0%, 100%': {
            transform: 'translateY(-25%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
      },
      
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-out',
        'slide-in-up': 'slide-in-up 0.3s ease-out',
        'slide-in-down': 'slide-in-down 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  
  plugins: [
    // Add any Tailwind plugins here
  ],
};

