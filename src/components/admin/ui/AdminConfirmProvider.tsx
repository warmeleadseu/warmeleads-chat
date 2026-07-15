'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function AdminConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    setOpen(false);
    resolver.current?.(result);
    resolver.current = null;
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open && opts && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div
            role="alertdialog"
            aria-labelledby="admin-confirm-title"
            aria-describedby="admin-confirm-desc"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 id="admin-confirm-title" className="text-lg font-bold text-slate-900">{opts.title}</h3>
            <p id="admin-confirm-desc" className="mt-2 text-sm text-slate-600">{opts.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
              >
                {opts.cancelLabel || 'Annuleren'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-white ${opts.destructive ? 'bg-red-600' : 'bg-brand-purple'}`}
              >
                {opts.confirmLabel || 'Bevestigen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useAdminConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useAdminConfirm must be used within AdminConfirmProvider');
  return ctx;
}

/** Drop-in replacement for window.confirm in admin code. */
export async function adminConfirm(message: string, title = 'Bevestigen'): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent('admin-confirm-request', { detail: { title, message } });
  window.dispatchEvent(event);
  return window.confirm(message);
}
