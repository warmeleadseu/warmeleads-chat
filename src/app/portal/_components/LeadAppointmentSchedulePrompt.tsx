'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  CalendarDaysIcon,
  XMarkIcon,
  MapPinIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { StatusBadge } from '../_ui/StatusBadge';
import { MOTION, T } from '../_ui/tokens';

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
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden
      />
      {/* Flex-centrering i.p.v. translate: framer-motion y overschrijft anders sm:-translate-* */}
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={MOTION.springSheet}
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-prompt-title"
          aria-describedby="schedule-prompt-desc"
          className="pointer-events-auto flex max-h-[min(92vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
          onClick={e => e.stopPropagation()}
        >
        <div className="h-1 bg-warmeleads-gradient sm:rounded-t-2xl" />
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />

        <header className="flex items-start gap-3 px-5 pb-2 pt-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple">
            <CalendarDaysIcon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 pr-2">
            <h2 id="schedule-prompt-title" className="text-base font-semibold text-slate-900">
              {canSchedule ? 'Afspraak inplannen?' : 'Status bijgewerkt'}
            </h2>
            <p id="schedule-prompt-desc" className="mt-0.5 text-sm leading-snug text-slate-500">
              {canSchedule
                ? 'De lead staat op Afspraak. Kies een tijdstip in je agenda of sluit dit venster.'
                : 'De lead staat op Afspraak. Voor het inplannen heb je rechten op de agenda nodig.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Sluiten"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          <div className={`${T.cardMuted} p-3.5`}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{lead.naam_klant}</p>
                  <StatusBadge status="afspraak" scope="lead" className="shrink-0" />
                </div>
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
        </div>

        <footer className="space-y-2 border-t border-slate-100 px-5 py-4">
          {canSchedule ? (
            <>
              <button type="button" onClick={onSchedule} className={`${T.btnPrimaryLg} w-full`}>
                <CalendarDaysIcon className="h-5 w-5" />
                Tijdstip kiezen
              </button>
              <button type="button" onClick={onDismiss} className={`${T.btnSecondary} w-full`}>
                Niet nu
              </button>
              <p className={T.helper + ' text-center'}>
                Later via{' '}
                <Link
                  href="/portal/agenda"
                  className="font-medium text-brand-purple hover:underline"
                  onClick={onDismiss}
                >
                  Agenda
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                Vraag je beheerder om rechten voor de agenda, of open Agenda als je daar al toegang toe hebt.
              </p>
              <Link href="/portal/agenda" onClick={onDismiss} className={`${T.btnSecondary} w-full`}>
                Naar agenda
              </Link>
              <button type="button" onClick={onDismiss} className={`${T.btnGhost} w-full`}>
                Sluiten
              </button>
            </>
          )}
        </footer>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}
