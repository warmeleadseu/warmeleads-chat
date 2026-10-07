'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, ShieldExclamationIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdminConfirm } from '@/components/admin/ui/AdminConfirmProvider';

/**
 * Leads die de scheldwoordfilter tegenhield. Vroeger verdwenen ze zonder
 * spoor; de woordenlijst raakt ook gewone achternamen ("Pik", "Van Reet").
 * Vrijgeven zet de lead terug en verdeelt hem; afwijzen bewaart hem als spoor.
 */

type Status = 'open' | 'vrijgegeven' | 'afgewezen';

type Item = {
  id: string;
  created_at: string;
  route: string;
  reden: string;
  lead: Record<string, unknown>;
  status: Status;
  beoordeeld_op: string | null;
  beoordeeld_door: string | null;
  vrijgegeven_lead_id: string | null;
};

const ROUTE_LABEL: Record<string, string> = {
  webhook: 'binnenkomst',
  verdeel_cron: 'verdeelronde',
  meta_inhaalslag: 'Meta-inhaalslag',
};

function tekst(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v);
}

function moment(iso: string): string {
  return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** De antwoorden uit custom_fields, alleen de tekst. */
function antwoorden(lead: Record<string, unknown>): [string, string][] {
  const cf = lead.custom_fields;
  if (!cf || typeof cf !== 'object') return [];
  return Object.entries(cf as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .map(([k, v]) => [k, String(v)]);
}

export default function QuarantaineLijst({ onAantalOpen }: { onAantalOpen: (n: number) => void }) {
  const { confirm } = useAdminConfirm();
  const [status, setStatus] = useState<Status>('open');
  const [items, setItems] = useState<Item[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await adminFetch(`/api/admin/quarantaine?status=${status}`, { cache: 'no-store' });
      const d = (await res.json().catch(() => ({}))) as { items?: Item[]; open?: number; error?: string };
      if (!res.ok) { setFout(d.error ?? 'Quarantaine kon niet worden geladen.'); return; }
      setItems(d.items ?? []);
      onAantalOpen(d.open ?? 0);
    } finally {
      setLaden(false);
    }
  }, [status, onAantalOpen]);

  useEffect(() => { void laad(); }, [laad]);

  const beoordeel = async (item: Item, actie: 'vrijgeven' | 'afwijzen') => {
    const naam = tekst(item.lead.naam_klant) || 'deze lead';
    if (actie === 'afwijzen') {
      const zeker = await confirm({
        title: 'Lead afwijzen?',
        message: `${naam} gaat naar geen enkele klant. De lead blijft hier bewaard onder "Afgewezen".`,
        confirmLabel: 'Afwijzen',
        destructive: true,
      });
      if (!zeker) return;
    }
    setBezig(item.id);
    setMelding(null);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/quarantaine', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, actie }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; toegewezen?: number };
      if (!res.ok) { setFout(d.error ?? 'Opslaan mislukt'); return; }
      setMelding(
        actie === 'afwijzen'
          ? `${naam} is afgewezen.`
          : d.toegewezen
            ? `${naam} is vrijgegeven en meteen geleverd aan ${d.toegewezen === 1 ? '1 klant' : `${d.toegewezen} klanten`}.`
            : `${naam} is vrijgegeven en staat weer in de leads. Is er nu geen klant, dan pakt de verdeelronde hem op of vind je hem bij de restleads.`,
      );
      await laad();
    } finally {
      setBezig(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {(['open', 'vrijgegeven', 'afgewezen'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${status === s ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {s === 'open' ? 'Te beoordelen' : s}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Tegengehouden door de scheldwoordfilter. Controleer of het een echte lead is (bijvoorbeeld een achternaam als &ldquo;Pik&rdquo;).
        </p>
      </div>

      {melding && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{melding}</div>}
      {fout && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fout}</div>}

      {laden && items.length === 0 ? (
        <div className="space-y-2">{[0, 1].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <ShieldExclamationIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium text-slate-600">
            {status === 'open' ? 'Niets te beoordelen' : status === 'vrijgegeven' ? 'Nog niets vrijgegeven' : 'Nog niets afgewezen'}
          </p>
          {status === 'open' && (
            <p className="mt-1 text-sm text-slate-400">Houdt de filter een lead tegen, dan komt hij hier te staan in plaats van te verdwijnen.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const l = item.lead;
            const adres = [tekst(l.postcode), tekst(l.huisnummer), tekst(l.plaatsnaam)].filter(Boolean).join(' ');
            const extra = antwoorden(l);
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {tekst(l.naam_klant) || 'Naamloos'}
                      <span className="ml-2 text-xs font-normal text-slate-400">{tekst(l.branch)}</span>
                    </p>
                    <p className="mt-0.5 break-words text-xs text-slate-500">
                      {[tekst(l.telefoonnummer), tekst(l.email), adres].filter(Boolean).join(' · ') || 'Geen contactgegevens'}
                    </p>
                    <p className="mt-1.5 text-xs">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{item.reden}</span>
                      <span className="ml-2 text-slate-400">
                        {moment(item.created_at)} · via {ROUTE_LABEL[item.route] ?? item.route}
                      </span>
                    </p>
                    {(tekst(l.notities) || extra.length > 0) && (
                      <div className="mt-2 space-y-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {tekst(l.notities) && <p className="break-words"><span className="text-slate-400">Notities:</span> {tekst(l.notities)}</p>}
                        {extra.map(([k, v]) => (
                          <p key={k} className="break-words"><span className="text-slate-400">{k}:</span> {v}</p>
                        ))}
                      </div>
                    )}
                    {item.status !== 'open' && (
                      <p className="mt-2 text-xs text-slate-400">
                        {item.status === 'vrijgegeven' ? 'Vrijgegeven' : 'Afgewezen'}
                        {item.beoordeeld_door && ` door ${item.beoordeeld_door}`}
                        {item.beoordeeld_op && ` op ${moment(item.beoordeeld_op)}`}
                      </p>
                    )}
                  </div>
                  {item.status === 'open' && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => void beoordeel(item, 'afwijzen')}
                        disabled={bezig !== null}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <XMarkIcon className="h-4 w-4" /> Afwijzen
                      </button>
                      <button
                        onClick={() => void beoordeel(item, 'vrijgeven')}
                        disabled={bezig !== null}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        <CheckIcon className="h-4 w-4" /> {bezig === item.id ? 'Bezig...' : 'Vrijgeven'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
