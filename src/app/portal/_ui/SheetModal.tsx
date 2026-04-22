'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { MOTION } from './tokens';

interface SheetModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
  showHandle?: boolean;
}

const SIZE: Record<NonNullable<SheetModalProps['size']>, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

/**
 * Bottom-sheet op mobiel, gecentreerde modal vanaf sm+.
 * Bevat standaard een drag-handle, close-knop, safe-area padding, body-overflow lock.
 */
export function SheetModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  showHandle = true,
}: SheetModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !dismissible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, dismissible, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => dismissible && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={MOTION.springSheet}
            className={`fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[92vh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl ${SIZE[size]}`}
          >
            <div className="h-1 bg-warmeleads-gradient sm:hidden" />
            {showHandle && <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />}

            {(title || dismissible) && (
              <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
                <div className="min-w-0">
                  {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
                  {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
                </div>
                {dismissible && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Sluiten"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </header>
            )}

            <div className="flex-1 overflow-y-auto px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>

            {footer && (
              <footer className="border-t border-slate-100 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {footer}
              </footer>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
