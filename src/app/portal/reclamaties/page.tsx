'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FlagIcon, MapPinIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { EmptyState, PageHeader, Skeleton, T } from '../_ui';
import { RECLAMATION_STATUS_MAP, reclamationReasonLabel } from '../_constants/reclamaties';
import { ReclamatieUitkomst } from '../_components/ReclamatieUitkomst';

/**
 * Overzicht van alle reclamaties van deze klant.
 *
 * Tot nu toe kon een klant alleen per lead zien wat er met zijn melding was
 * gebeurd, wat betekende dat hij moest onthouden welke leads hij ooit had
 * gemeld. Hier staan ze bij elkaar, met per stuk de beoordeling en de
 * toelichting die wij erbij hebben geschreven.
 */

interface Reclamatie {
  id: string;
  lead_id: string;
  reason: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  leads: {
    naam_klant: string | null;
    plaatsnaam: string | null;
    postcode: string | null;
    branch: string | null;
  } | null;
}

const FILTERS = [
  { value: 'all', label: 'Alle' },
  { value: 'pending', label: 'In behandeling' },
  { value: 'approved', label: 'Goedgekeurd' },
  { value: 'rejected', label: 'Afgewezen' },
] as const;

type FilterWaarde = (typeof FILTERS)[number]['value'];

function datum(waarde: string | null): string {
  if (!waarde) return '';
  const d = new Date(waarde);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ReclamatiesPage() {
  const [reclamaties, setReclamaties] = useState<Reclamatie[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(false);
  const [filter, setFilter] = useState<FilterWaarde>('all');
  const [zoek, setZoek] = useState('');

  const ophalen = useCallback(async () => {
    setLaden(true);
    setFout(false);
    try {
      const res = await portalFetch('/api/portal/reclamations');
      if (!res.ok) {
        setFout(true);
        setReclamaties([]);
        return;
      }
      const d = await res.json();
      setReclamaties(Array.isArray(d.reclamations) ? d.reclamations : []);
    } catch {
      setFout(true);
      setReclamaties([]);
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { ophalen(); }, [ophalen]);

  const aantallen = useMemo(() => ({
    all: reclamaties.length,
    pending: reclamaties.filter(r => r.status === 'pending').length,
    approved: reclamaties.filter(r => r.status === 'approved').length,
    rejected: reclamaties.filter(r => r.status === 'rejected').length,
  }), [reclamaties]);

  const zichtbaar = useMemo(() => {
    let lijst = reclamaties;
    if (filter !== 'all') lijst = lijst.filter(r => r.status === filter);
    const term = zoek.trim().toLowerCase();
    if (term) {
      lijst = lijst.filter(r =>
        (r.leads?.naam_klant || '').toLowerCase().includes(term) ||
        (r.leads?.plaatsnaam || '').toLowerCase().includes(term) ||
        (r.leads?.postcode || '').toLowerCase().includes(term) ||
        reclamationReasonLabel(r.reason).toLowerCase().includes(term) ||
        (r.description || '').toLowerCase().includes(term),
      );
    }
    return lijst;
  }, [reclamaties, filter, zoek]);

  const onbeoordeeld = aantallen.pending;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reclamaties"
        subtitle={
          laden
            ? 'Je meldingen worden geladen...'
            : reclamaties.length === 0
              ? 'Je hebt nog geen reclamaties ingediend'
              : `${reclamaties.length} ${reclamaties.length === 1 ? 'melding' : 'meldingen'}${onbeoordeeld > 0 ? `, waarvan ${onbeoordeeld} in behandeling` : ''}`
        }
      />

      {laden ? (
        <Skeleton.List count={4} />
      ) : fout ? (
        <EmptyState
          icon={FlagIcon}
          title="Overzicht kon niet worden geladen"
          body="Probeer het zo nog eens. Blijft het misgaan, laat het ons dan weten."
          cta={
            <button onClick={ophalen} className={T.btnSecondary}>
              Opnieuw proberen
            </button>
          }
        />
      ) : reclamaties.length === 0 ? (
        <EmptyState
          icon={FlagIcon}
          title="Nog geen reclamaties"
          body="Klopt er iets niet aan een lead? Open de lead bij Leads en dien daar een reclamatie in. We beoordelen die binnen 2 werkdagen en je leest hier het antwoord."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className={`${T.pillGroup} overflow-x-auto hide-scrollbar`}>
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`${T.pillItem} shrink-0 ${filter === f.value ? T.pillActive : T.pillIdle}`}
                >
                  {f.label}
                  <span className="text-slate-400">{aantallen[f.value]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:w-64">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="text"
                value={zoek}
                onChange={e => setZoek(e.target.value)}
                placeholder="Zoek op lead of plaats..."
                className={`${T.input} pl-9`}
              />
            </div>
          </div>

          {zichtbaar.length === 0 ? (
            <EmptyState
              icon={FlagIcon}
              title="Niets gevonden"
              body="Er zijn geen reclamaties die aan dit filter voldoen."
            />
          ) : (
            <div className="space-y-3">
              {zichtbaar.map(r => {
                const st = RECLAMATION_STATUS_MAP[r.status] ?? RECLAMATION_STATUS_MAP.pending;
                const plaats = [r.leads?.postcode, r.leads?.plaatsnaam].filter(Boolean).join(' ');
                return (
                  <div key={r.id} className={`${T.card} ${T.cardPadding}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {r.leads?.naam_klant || 'Onbekende lead'}
                        </p>
                        {plaats && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{plaats}</span>
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-700">{reclamationReasonLabel(r.reason)}</p>
                      {r.description && (
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-500">{r.description}</p>
                      )}
                      <p className="mt-1.5 text-[10px] text-slate-400">Ingediend op {datum(r.created_at)}</p>
                    </div>

                    <div className="mt-2.5">
                      <ReclamatieUitkomst
                        status={r.status}
                        adminNotes={r.admin_notes}
                        resolvedAt={r.resolved_at}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {zichtbaar.length > 0 && (
            <p className={T.helper}>
              Bij een goedgekeurde reclamatie wordt de lead niet in rekening gebracht of krijg je een vervangende lead.
            </p>
          )}
        </>
      )}
    </div>
  );
}
