'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CalendarDaysIcon,
  XMarkIcon,
  MapPinIcon,
  UserIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

type LeadSummary = {
  id: string;
  naam_klant: string;
  branch: string;
  plaatsnaam?: string;
};

export default function LeadAppointmentSchedulePrompt({
  lead,
  branchLabel,
  canSchedule,
  onSchedule,
  onDismiss,
}: {
  lead: LeadSummary;
  branchLabel: string;
  /** Mag de ingelogde gebruiker afspraken aanmaken? */
  canSchedule: boolean;
  onSchedule: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  if (typeof window === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onDismiss}
      role="presentation"
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="schedule-prompt-title"
        aria-describedby="schedule-prompt-desc"
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <div className="relative bg-gradient-to-br from-brand-purple via-brand-purple/95 to-brand-pink px-5 pb-5 pt-5 text-white sm:rounded-t-2xl">
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 rounded-full p-2 text-white/90 transition hover:bg-white/15"
            aria-label="Sluiten"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <CalendarDaysIcon className="h-6 w-6" />
          </div>
          <h2 id="schedule-prompt-title" className="mt-3 pr-10 text-lg font-bold leading-snug">
            Status opgeslagen als Afspraak
          </h2>
          <p id="schedule-prompt-desc" className="mt-1 text-sm text-white/85">
            Wil je meteen een moment in de agenda zetten? Dat mag — het is optioneel.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                <UserIcon className="h-5 w-5 text-brand-purple" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{lead.naam_klant}</p>
                <p className="mt-0.5 text-xs text-slate-500">{branchLabel}</p>
                {lead.plaatsnaam ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{lead.plaatsnaam}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {canSchedule ? (
            <>
              <button
                type="button"
                onClick={onSchedule}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-orange to-brand-pink px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-orange/25 transition hover:brightness-105"
              >
                <CalendarDaysIcon className="h-5 w-5" />
                Afspraak inplannen in agenda
                <ArrowRightIcon className="h-4 w-4 opacity-90" />
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Later — geen afspraak nu
              </button>
              <p className="text-center text-[11px] leading-relaxed text-slate-400">
                Je kunt dit altijd nog doen via{' '}
                <Link href="/portal/agenda" className="font-medium text-brand-purple hover:underline" onClick={onDismiss}>
                  Agenda
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                De status is opgeslagen. Voor het inplannen van afspraken heb je rechten op de agenda nodig — vraag
                je beheerder of open de agenda als je daar toegang toe hebt.
              </p>
              <Link
                href="/portal/agenda"
                onClick={onDismiss}
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Naar agenda
              </Link>
              <button
                type="button"
                onClick={onDismiss}
                className="min-h-11 w-full rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                Sluiten
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
