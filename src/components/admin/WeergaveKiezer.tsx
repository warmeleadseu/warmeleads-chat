'use client';

import { useState, useEffect, useCallback } from 'react';
import { TableCellsIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import {
  WEERGAVEN,
  WEERGAVE_LABELS,
  leesVoorkeur,
  bewaarVoorkeur,
  type Weergave,
} from '@/lib/weergaveVoorkeur';

const ICONEN: Record<Weergave, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  tabel: TableCellsIcon,
  kaarten: Squares2X2Icon,
  compact: ListBulletIcon,
};

/**
 * Onthoudt de weergavekeuze per pagina.
 *
 * Bewust in twee stappen: eerst de standaard renderen, daarna pas de opgeslagen
 * keuze toepassen. Meteen uit localStorage lezen zou server- en clientrender uit
 * elkaar laten lopen en React laten klagen over een mismatch.
 */
export function useWeergave(pagina: string, standaard: Weergave = 'tabel') {
  const [weergave, setWeergaveState] = useState<Weergave>(standaard);

  useEffect(() => {
    setWeergaveState(leesVoorkeur(pagina, standaard));
  }, [pagina, standaard]);

  const setWeergave = useCallback((w: Weergave) => {
    setWeergaveState(w);
    bewaarVoorkeur(pagina, w);
  }, [pagina]);

  return [weergave, setWeergave] as const;
}

export function WeergaveKiezer({
  waarde,
  onKies,
  opties = WEERGAVEN,
}: {
  waarde: Weergave;
  onKies: (w: Weergave) => void;
  opties?: readonly Weergave[];
}) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
      role="group"
      aria-label="Weergave"
    >
      {opties.map(w => {
        const Icoon = ICONEN[w];
        const actief = waarde === w;
        return (
          <button
            key={w}
            onClick={() => onKies(w)}
            aria-pressed={actief}
            title={WEERGAVE_LABELS[w]}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${
              actief ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icoon className="h-4 w-4" />
            <span className="hidden sm:inline">{WEERGAVE_LABELS[w]}</span>
          </button>
        );
      })}
    </div>
  );
}
