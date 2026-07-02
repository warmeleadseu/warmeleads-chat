'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/** Zelfde vorm als API; los van server-module om zware imports te vermijden. */
interface BatchLeveringDag {
  datum: string;
  label: string;
  aantal: number;
}

interface BatchLeveringRij {
  batch_id: string;
  customer_id: string;
  customer_name: string;
  branch: string;
  branch_label: string;
  leads_per_day: number;
  leads_delivered: number;
  batch_size: number;
  dagen: BatchLeveringDag[];
  badge: 'goed' | 'let_op' | 'actie';
  kop: string;
  uitleg: string;
  tips: string[];
}

interface Summary {
  goed: number;
  let_op: number;
  actie: number;
  totaal: number;
}

const BADGE_STIJL: Record<string, { ring: string; bg: string; label: string }> = {
  actie: {
    ring: 'ring-red-200',
    bg: 'bg-red-50',
    label: 'Actie nodig',
  },
  let_op: {
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
    label: 'Houd in de gaten',
  },
  goed: {
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50/80',
    label: 'Op schema',
  },
};

export default function BatchLeveringPage() {
  const [items, setItems] = useState<BatchLeveringRij[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dagen, setDagen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (withRefresh: boolean) => {
    if (withRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const q = withRefresh ? '?refresh=1' : '';
      const res = await adminFetch(`/api/admin/delivery-health${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Laden mislukt');
        setItems([]);
        setSummary(null);
        return;
      }
      setItems((data as { items?: BatchLeveringRij[] }).items || []);
      setSummary((data as { summary?: Summary }).summary || null);
      setDagen((data as { dagen?: string[] }).dagen || []);
    } catch {
      setError('Netwerkfout');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Levering batches</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Hier zie je of actieve betaalde batches hun <strong>afgesproken maximum per dag</strong> halen. Meetperiode: de
            laatste drie <strong>afgelopen</strong> kalenderdagen (Nederlandse tijd), niet vandaag — zodat een halve dag
            je beeld niet scheef trekt. De zachte opstartperiode telt vanaf de <strong>eerste betaling</strong> (factuur of
            bestelling); ontbreekt die datum, dan vanaf aanmaak.
          </p>
          {dagen.length > 0 && (
            <p className="mt-2 break-words text-xs text-slate-500">
              Gecontroleerde dagen (datavenster): {dagen.map(d => d.replace(/-/g, '/')).join(' → ')}. Per kaart tellen
              alleen voltooide dagen mee vanaf eerste betaling (of aanmaak als die ontbreekt).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Statistiek nu verversen
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {summary && !loading && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{summary.goed}</p>
            <p className="text-xs font-medium text-emerald-900">Op schema</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-amber-800">{summary.let_op}</p>
            <p className="text-xs font-medium text-amber-950">Houd in de gaten</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-red-700">{summary.actie}</p>
            <p className="text-xs font-medium text-red-950">Actie nodig</p>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <div className="flex gap-2">
          <InformationCircleIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="font-medium text-slate-800">Waarom wijkt het soms af?</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
              <li>Er zijn niet genoeg verse leads in de branche (o.a. Meta en andere bronnen).</li>
              <li>De kaart-targets van de klant sluiten niet goed aan bij waar leads binnenkomen.</li>
              <li>Meerdere klanten in dezelfde regio: we verdelen eerlijk, dus niet iedereen raakt elke dag het maximum.</li>
            </ul>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center text-slate-500">
          <p className="font-medium">Geen batches om te tonen</p>
          <p className="mt-1 text-sm">Er zijn geen actieve betaalde lead-batches met een maximum per dag voor jouw filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(row => {
            const st = BADGE_STIJL[row.badge] || BADGE_STIJL.goed;
            const Icon = row.badge === 'actie' ? ExclamationTriangleIcon : row.badge === 'let_op' ? ExclamationTriangleIcon : CheckCircleIcon;
            return (
              <article
                key={row.batch_id}
                className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-2 ${st.ring} ${st.bg}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${row.badge === 'goed' ? 'text-emerald-600' : row.badge === 'let_op' ? 'text-amber-600' : 'text-red-600'}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{row.kop}</p>
                      <p className="mt-0.5 text-sm text-slate-700">
                        <Link
                          href={`/admin/customers?open=${row.customer_id}`}
                          className="font-medium text-brand-purple hover:underline"
                        >
                          {row.customer_name}
                        </Link>
                        <span className="text-slate-400"> · </span>
                        <span>{row.branch_label}</span>
                        <span className="text-slate-400"> · </span>
                        <span>
                          {row.leads_delivered}/{row.batch_size} geleverd
                        </span>
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      row.badge === 'actie'
                        ? 'bg-red-600 text-white'
                        : row.badge === 'let_op'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{row.uitleg}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {row.dagen.map(d => (
                    <span key={d.datum} className="rounded-lg bg-white/80 px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                      {d.label}: <strong>{d.aantal}</strong> / max {row.leads_per_day}
                    </span>
                  ))}
                </div>
                {row.tips.length > 0 && (
                  <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
                    {row.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/batches`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-purple hover:underline"
                  >
                    Open batches-overzicht
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </Link>
                  <span className="text-slate-300">|</span>
                  <Link
                    href={`/admin/customers?open=${row.customer_id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-purple hover:underline"
                  >
                    Klantgegevens
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
