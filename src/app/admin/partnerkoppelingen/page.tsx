'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowPathIcon, ChatBubbleLeftRightIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PartnerKoppelingKaart, { type PartnerApi, type PartnerStatusData } from '@/components/integrations/PartnerKoppelingKaart';

/**
 * Partnerkoppelingen: klanten koppelen aan partners als Snelraak, en in één
 * oogopslag zien waar iets misgaat. Koppelingen die aandacht nodig hebben
 * staan bovenaan.
 */

type Partner = { id: string; naam: string; tagline: string; urlUitleg: string };
type Rij = PartnerStatusData & { customer_id: string; klant: string };

async function lees<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

function apiVoor(customerId: string, partnerId: string): PartnerApi {
  const basis = `/api/admin/partnerkoppelingen/${customerId}/${partnerId}`;
  return {
    opslaan: async body => {
      const res = await adminFetch(basis, { method: 'PUT', body: JSON.stringify(body) });
      const d = await lees<PartnerStatusData & { nagestuurd?: { gelukt: number; mislukt: number; resterend: number } | null }>(res);
      return res.ok ? { ok: true, status: d, nagestuurd: d.nagestuurd ?? null } : { ok: false, fout: d.error };
    },
    testen: async body => {
      const res = await adminFetch(`${basis}/test`, { method: 'POST', body: JSON.stringify(body) });
      const d = await lees<{ ok: boolean; melding: string; ms: number }>(res);
      return res.ok ? d : { ok: false, melding: d.error ?? 'Testen mislukt', ms: 0 };
    },
    opnieuw: async () => {
      const res = await adminFetch(`${basis}/opnieuw`, { method: 'POST' });
      const d = await lees<{ gelukt: number; mislukt: number; resterend: number }>(res);
      return res.ok ? { ok: true, ...d } : { ok: false, fout: d.error };
    },
    ontkoppelen: async () => {
      const res = await adminFetch(basis, { method: 'DELETE' });
      const d = await lees<object>(res);
      return res.ok ? { ok: true } : { ok: false, fout: d.error };
    },
  };
}

function wanneer(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const vandaag = d.toDateString() === new Date().toDateString();
  return vandaag
    ? `vandaag ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusPil({ r }: { r: Rij }) {
  const [kleur, tekst] = r.actie_nodig
    ? ['bg-red-100 text-red-700', 'Actie nodig']
    : r.aan
      ? ['bg-emerald-100 text-emerald-700', 'Actief']
      : ['bg-amber-100 text-amber-700', 'Gepauzeerd'];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kleur}`}>{tekst}</span>;
}

export default function PartnerkoppelingenPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [klanten, setKlanten] = useState<{ id: string; name: string }[]>([]);
  const [nieuwKlant, setNieuwKlant] = useState('');
  const [nieuwPartner, setNieuwPartner] = useState('');
  const [nieuwStatus, setNieuwStatus] = useState<PartnerStatusData | null>(null);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      const res = await adminFetch('/api/admin/partnerkoppelingen', { cache: 'no-store' });
      const d = await lees<{ partners: Partner[]; koppelingen: Rij[] }>(res);
      if (!res.ok) { setFout(d.error ?? 'Partnerkoppelingen konden niet worden geladen.'); return; }
      setPartners(d.partners);
      setRijen(d.koppelingen);
      setNieuwPartner(p => p || d.partners[0]?.id || '');
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => { void laad(); }, [laad]);

  useEffect(() => {
    if (!nieuwOpen || klanten.length > 0) return;
    void adminFetch('/api/admin/customers/options').then(async res => {
      if (res.ok) setKlanten((await res.json()).customers || []);
    });
  }, [nieuwOpen, klanten.length]);

  /* Klant gekozen: status ophalen; bestaat er al een koppeling, dan die tonen. */
  const herlaadNieuw = useCallback(async () => {
    if (!nieuwKlant || !nieuwPartner) return;
    const res = await adminFetch(`/api/admin/partnerkoppelingen/${nieuwKlant}/${nieuwPartner}`, { cache: 'no-store' });
    if (res.ok) setNieuwStatus(await res.json());
  }, [nieuwKlant, nieuwPartner]);
  useEffect(() => { setNieuwStatus(null); void herlaadNieuw(); }, [herlaadNieuw]);

  const partnerNaam = useMemo(() => Object.fromEntries(partners.map(p => [p.id, p.naam])), [partners]);
  const aandacht = rijen.filter(r => r.actie_nodig).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-brand-purple" />
            Partnerkoppelingen
          </h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
            Leads van een klant automatisch doorleveren aan een partner die de opvolging start, zoals Snelraak
            (WhatsApp binnen een minuut). Plak het adres dat de partner aanlevert, test, klaar.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => void laad()} disabled={laden} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${laden ? 'animate-spin' : ''}`} /> Vernieuwen
          </button>
          <button onClick={() => setNieuwOpen(v => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink px-3.5 text-sm font-bold text-white">
            <PlusIcon className="h-4 w-4" /> Klant koppelen
          </button>
        </div>
      </div>

      {fout && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fout}</div>}

      {aandacht > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {aandacht === 1 ? '1 koppeling heeft' : `${aandacht} koppelingen hebben`} aandacht nodig. Ze staan hieronder bovenaan.
        </div>
      )}

      {nieuwOpen && (
        <div className="space-y-4 rounded-2xl border border-brand-purple/20 bg-brand-purple/[0.03] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Klant</label>
              <SearchableSelect
                value={nieuwKlant}
                onChange={setNieuwKlant}
                options={klanten.map(k => ({ value: k.id, label: k.name }))}
                placeholder="Kies een klant…"
                searchPlaceholder="Zoek klant…"
              />
            </div>
            {partners.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Partner</label>
                <select value={nieuwPartner} onChange={e => setNieuwPartner(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm">
                  {partners.map(p => <option key={p.id} value={p.id}>{p.naam}</option>)}
                </select>
              </div>
            )}
          </div>
          {nieuwStatus && (
            <PartnerKoppelingKaart
              key={`${nieuwKlant}-${nieuwPartner}`}
              status={nieuwStatus}
              api={apiVoor(nieuwKlant, nieuwPartner)}
              admin
              onBijgewerkt={s => { if (s) setNieuwStatus(s); else void herlaadNieuw(); void laad(); }}
            />
          )}
        </div>
      )}

      {laden && rijen.length === 0 ? (
        <div className="space-y-2">{[0, 1].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : rijen.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <ChatBubbleLeftRightIcon className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          <p className="font-medium text-slate-600">Nog geen partnerkoppelingen</p>
          <p className="mt-1 text-sm text-slate-400">Klik op &ldquo;Klant koppelen&rdquo; en plak het adres dat de partner aanleverde.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {rijen.map(r => {
            const sleutel = `${r.customer_id}:${r.partner.id}`;
            const isOpen = open === sleutel;
            return (
              <div key={sleutel}>
                <button onClick={() => setOpen(isOpen ? null : sleutel)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{r.klant}</span>
                  <span className="text-xs text-slate-500">{partnerNaam[r.partner.id] ?? r.partner.naam}</span>
                  <StatusPil r={r} />
                  <span className="w-36 text-xs text-slate-500">Laatste: {wanneer(r.laatste_succes)}</span>
                  <span className="w-32 text-xs text-slate-500">
                    7d: {r.zeven_dagen.gelukt} ok{r.zeven_dagen.mislukt > 0 && <span className="text-red-600"> · {r.zeven_dagen.mislukt} mislukt</span>}
                  </span>
                  <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="bg-slate-50/60 px-4 pb-4">
                    <PartnerKoppelingKaart
                      key={sleutel}
                      status={r}
                      api={apiVoor(r.customer_id, r.partner.id)}
                      admin
                      onBijgewerkt={() => void laad()}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
