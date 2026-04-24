'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

const STORAGE_KEY = 'warmeleads-cookie-consent';

type ConsentValue = 'accepted' | 'essential';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function handleConsent(value: ConsentValue) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch { /* localStorage unavailable */ }
    window.dispatchEvent(new CustomEvent('cookie-consent-update', { detail: value }));
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cookie-banner"
          role="dialog"
          aria-label="Cookie toestemming"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-[9999] flex justify-center p-4 sm:p-6 pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-lg bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-6">
            <div className="flex items-start gap-3">
              {/* Cookie icon */}
              <span className="mt-0.5 shrink-0" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-7 w-7 text-brand-orange"
                  fill="currentColor"
                >
                  <path d="M12 2a10 10 0 1 0 10 10h-2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.17A10.04 10.04 0 0 0 12 2Zm-2 5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-3 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm6 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
                </svg>
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed text-slate-700">
                  Wij gebruiken cookies om je ervaring te verbeteren en onze
                  website te analyseren.{' '}
                  <Link
                    href="/privacyverklaring"
                    className="font-medium text-brand-purple underline underline-offset-2 hover:text-brand-orange transition-colors"
                  >
                    Meer informatie
                  </Link>
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleConsent('accepted')}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-orange to-[#FF4757] px-5 py-2.5 text-sm font-semibold text-white shadow-button transition-[filter,box-shadow,transform] hover:brightness-110 hover:shadow-lg active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2"
                  >
                    Accepteren
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConsent('essential')}
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:text-brand-purple hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2"
                  >
                    Alleen noodzakelijk
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
