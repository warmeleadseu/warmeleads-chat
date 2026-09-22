'use client';

import { useMemo } from 'react';
import { berekenStatistiek, berekenPerSleutel, topRedenen, type StatistiekAfspraak } from '@/lib/afspraakStatistiek';
import { NO_DEAL_REASONS } from '@/lib/appointmentOutcome';

/**
 * Conversiecijfers over de afspraken die nu in beeld zijn.
 *
 * Rekent over dezelfde gefilterde lijst als de agenda zelf, zodat de cijfers
 * niet iets anders kunnen zeggen dan wat eronder staat.
 */
export function ResultatenPaneel({
  afspraken,
  branchNames,
  teamNamen,
}: {
  afspraken: StatistiekAfspraak[];
  branchNames: Record<string, string>;
  teamNamen: Record<string, string>;
}) {
  const stat = useMemo(() => berekenStatistiek(afspraken), [afspraken]);
  const perBranche = useMemo(() => berekenPerSleutel(afspraken, 'branch'), [afspraken]);
  const perAdviseur = useMemo(() => berekenPerSleutel(afspraken, 'portal_user_id'), [afspraken]);
  const redenen = useMemo(() => topRedenen(afspraken), [afspraken]);

  const afgeboekt = stat.bezocht + stat.nietVerschenen + stat.geannuleerd + stat.verzet;

  if (stat.totaal === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tegel label="Afspraken" waarde={String(stat.totaal)} sub={`${stat.ingepland} ingepland`} />
        <Tegel
          label="Deals"
          waarde={String(stat.deals)}
          sub={stat.bezocht > 0 ? `${stat.conversiePct}% van bezocht` : 'nog niets bezocht'}
          kleur="emerald"
        />
        <Tegel
          label="Omzet"
          waarde={stat.omzet > 0 ? `€ ${stat.omzet.toLocaleString('nl-NL')}` : '-'}
          sub={stat.gemiddeldeDeal > 0 ? `gem. € ${stat.gemiddeldeDeal.toLocaleString('nl-NL')}` : 'geen bedragen ingevuld'}
          kleur="emerald"
        />
        <Tegel
          label="Niet verschenen"
          waarde={String(stat.nietVerschenen)}
          sub={stat.bezocht + stat.nietVerschenen > 0 ? `${stat.noShowPct}% no-show` : '-'}
          kleur={stat.noShowPct > 20 ? 'rose' : 'slate'}
        />
      </div>

      {afgeboekt === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Er is in deze periode nog niets afgeboekt, dus conversie en omzet zijn nog leeg.
          Boek je afspraken af na het bezoek, dan vullen deze cijfers zichzelf.
        </p>
      )}

      {(perBranche.length > 1 || perAdviseur.length > 1 || redenen.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {perBranche.length > 1 && (
            <Blok titel="Per branche">
              {perBranche.map(r => (
                <Regel
                  key={r.waarde}
                  naam={branchNames[r.waarde] || r.waarde}
                  rechts={`${r.stat.deals}/${r.stat.bezocht}`}
                  hint={r.stat.bezocht > 0 ? `${r.stat.conversiePct}%` : ''}
                />
              ))}
            </Blok>
          )}

          {perAdviseur.length > 1 && (
            <Blok titel="Per adviseur">
              {perAdviseur.map(r => (
                <Regel
                  key={r.waarde}
                  naam={teamNamen[r.waarde] || (r.waarde === '(onbekend)' ? 'Niet toegewezen' : r.waarde)}
                  rechts={`${r.stat.deals}/${r.stat.bezocht}`}
                  hint={r.stat.bezocht > 0 ? `${r.stat.conversiePct}%` : ''}
                />
              ))}
            </Blok>
          )}

          {redenen.length > 0 && (
            <Blok titel="Waarom geen deal">
              {redenen.map(r => (
                <Regel
                  key={r.reden}
                  naam={NO_DEAL_REASONS.find(x => x.value === r.reden)?.label ?? r.reden}
                  rechts={String(r.aantal)}
                />
              ))}
            </Blok>
          )}
        </div>
      )}
    </div>
  );
}

function Tegel({ label, waarde, sub, kleur = 'slate' }: { label: string; waarde: string; sub?: string; kleur?: 'slate' | 'emerald' | 'rose' }) {
  const tekst = { slate: 'text-slate-900', emerald: 'text-emerald-700', rose: 'text-rose-600' }[kleur];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${tekst}`}>{waarde}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}

function Blok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{titel}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Regel({ naam, rechts, hint }: { naam: string; rechts: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-slate-600">{naam}</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-800">
        {rechts}
        {hint && <span className="ml-1.5 font-normal text-slate-400">{hint}</span>}
      </span>
    </div>
  );
}
