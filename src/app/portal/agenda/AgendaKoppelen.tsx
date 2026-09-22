'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { XMarkIcon, LinkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';

/**
 * Abonneerlink op de agenda voor Google Agenda of Outlook.
 *
 * Eenrichtingsverkeer: wat hier staat verschijnt daar. Terugschrijven vanuit
 * Google zou een heel ander verhaal zijn (tweezijdige synchronisatie met
 * conflictafhandeling) en zit hier bewust niet in.
 */
export function AgendaKoppelen({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState<{ url: string; webcal: string; scope: string } | null>(null);
  const [laden, setLaden] = useState(true);
  const [gekopieerd, setGekopieerd] = useState(false);

  useEffect(() => {
    portalFetch('/api/portal/agenda-feed/link')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setLink(d))
      .finally(() => setLaden(false));
  }, []);

  const kopieer = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      /* Clipboard geweigerd (http, of de gebruiker blokkeert het). Het veld is
         selecteerbaar, dus handmatig kopiëren blijft mogelijk. */
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:bg-black/40 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <LinkIcon className="h-4 w-4 text-brand-purple" />
              Agenda koppelen
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Je afspraken automatisch in Google Agenda of Outlook.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {laden ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : !link ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            De koppellink kon niet worden opgehaald.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">
              Deze link bevat {link.scope === 'eigen' ? 'jouw eigen afspraken' : 'alle afspraken van je bedrijf'}.
              Deel hem niet: wie hem heeft, kan je agenda lezen.
            </p>

            <div className="flex gap-2">
              <input
                readOnly
                value={link.url}
                onFocus={e => e.currentTarget.select()}
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600 outline-none"
              />
              <button
                onClick={kopieer}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink px-4 text-sm font-bold text-white"
              >
                {gekopieerd ? <CheckIcon className="h-4 w-4" /> : null}
                {gekopieerd ? 'Gekopieerd' : 'Kopieer'}
              </button>
            </div>

            <a
              href={link.webcal}
              className="mt-2 block rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Direct openen in je agenda-app
            </a>

            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <p><strong>Google Agenda:</strong> Andere agenda&apos;s, plusje, Via URL, plak de link.</p>
              <p><strong>Outlook:</strong> Agenda toevoegen, Abonneren via internet, plak de link.</p>
              <p className="text-slate-400">
                Google en Outlook verversen een abonnement op hun eigen ritme, meestal elk uur tot elke paar uur.
                Een zojuist verzette afspraak staat er dus niet meteen in.
              </p>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
