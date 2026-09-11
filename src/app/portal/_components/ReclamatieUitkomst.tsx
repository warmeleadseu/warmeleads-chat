'use client';

import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { isAfgehandeld } from '../_constants/reclamaties';

/**
 * De uitkomst van een beoordeelde reclamatie, met de motivatie die de
 * beheerder erbij heeft getypt.
 *
 * Eén component voor zowel het leadpaneel als het reclamatieoverzicht, zodat de
 * klant op beide plekken hetzelfde antwoord op dezelfde manier leest.
 */
export function ReclamatieUitkomst({
  status,
  adminNotes,
  resolvedAt,
  compact = false,
}: {
  status: string;
  adminNotes?: string | null;
  resolvedAt?: string | null;
  compact?: boolean;
}) {
  if (!isAfgehandeld(status)) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
        <ClockIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>We beoordelen je reclamatie binnen 2 werkdagen.</span>
      </div>
    );
  }

  const goed = status === 'approved';
  const Icoon = goed ? CheckCircleIcon : XCircleIcon;
  const notitie = adminNotes?.trim();

  const kleur = goed
    ? 'bg-emerald-50/70 text-emerald-900 ring-emerald-100'
    : 'bg-red-50/60 text-red-900 ring-red-100';
  const icoonKleur = goed ? 'text-emerald-600' : 'text-red-500';

  return (
    <div className={`rounded-lg px-3 py-2.5 text-xs ring-1 ${kleur}`}>
      <div className="flex items-start gap-2">
        <Icoon className={`mt-px h-3.5 w-3.5 shrink-0 ${icoonKleur}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {goed ? 'Reclamatie goedgekeurd' : 'Reclamatie afgewezen'}
            {resolvedAt && (
              <span className="ml-1.5 font-normal opacity-60">
                op {new Date(resolvedAt).toLocaleDateString('nl-NL', {
                  day: 'numeric',
                  month: compact ? 'short' : 'long',
                  year: 'numeric',
                })}
              </span>
            )}
          </p>
          {notitie ? (
            /* whitespace-pre-line: beheerders typen soms een aanhef en een
               witregel; die opmaak hoort bij de klant net zo aan te komen. */
            <p className="mt-1 whitespace-pre-line leading-relaxed opacity-90">{notitie}</p>
          ) : (
            <p className="mt-1 leading-relaxed opacity-70">
              Er is geen toelichting bij deze beoordeling gegeven. Vragen? Neem gerust contact met ons op.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
