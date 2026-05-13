'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

interface ToastApi {
  show: (msg: string, type?: ToastType) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, type: ToastType = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now();
    setToast({ id, msg, type });
    timerRef.current = setTimeout(() => {
      setToast(prev => (prev && prev.id === id ? null : prev));
    }, AUTO_DISMISS_MS);
  }, []);

  const success = useCallback((msg: string) => show(msg, 'success'), [show]);
  const error = useCallback((msg: string) => show(msg, 'error'), [show]);
  const info = useCallback((msg: string) => show(msg, 'info'), [show]);

  // Stabiele referentie naar het toast-API zodat consumenten (zoals portal/page.tsx)
  // niet bij elke ToastProvider-render een nieuwe `showToast`-callback krijgen.
  const api = useMemo<ToastApi>(
    () => ({ show, success, error, info }),
    [show, success, error, info],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${
              toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-slate-800' : 'bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <XCircleIcon className="h-4 w-4 shrink-0 text-red-200" />
              ) : toast.type === 'info' ? (
                <InformationCircleIcon className="h-4 w-4 shrink-0 text-sky-200" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-400" />
              )}
              <span className="min-w-0 flex-1 leading-snug">{toast.msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
