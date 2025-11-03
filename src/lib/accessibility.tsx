/**
 * Accessibility Utilities
 * 
 * WCAG compliant helpers and hooks
 */

import { useEffect, useRef, useState } from 'react';

// ========================================
// FOCUS TRAP HOOK
// ========================================

export const useFocusTrap = (isActive: boolean = true) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element on mount
    firstElement?.focus();

    container.addEventListener('keydown', handleTab);

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [isActive]);

  return containerRef;
};

// ========================================
// ESCAPE KEY HANDLER
// ========================================

export const useEscapeKey = (callback: () => void, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        callback();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [callback, isActive]);
};

// ========================================
// REDUCED MOTION CHECK
// ========================================

export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  return prefersReducedMotion;
};

// ========================================
// SCREEN READER ONLY TEXT
// ========================================

export const VisuallyHidden: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
};

// ========================================
// ARIA ANNOUNCEMENT HOOK
// ========================================

export const useAriaAnnouncement = () => {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!announcement) return;

    // Clear after announcement
    const timer = setTimeout(() => {
      setAnnouncement('');
    }, 1000);

    return () => clearTimeout(timer);
  }, [announcement]);

  return {
    announce: setAnnouncement,
    announcement,
  };
};

export const AriaLiveRegion: React.FC<{ announcement: string }> = ({ announcement }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
};

// ========================================
// KEYBOARD NAVIGATION HELPERS
// ========================================

export const handleKeyboardSelect = (
  e: React.KeyboardEvent,
  callback: () => void
) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    callback();
  }
};

// ========================================
// FOCUS VISIBLE UTILITY
// ========================================

export const focusVisibleClasses = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2';

