'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { PARTNERS } from '@/lib/integrations/partners/registry';
import { useAdminConfirm } from '@/components/admin/ui/AdminConfirmProvider';
import PartnerLogo from '@/components/integrations/PartnerLogo';
import PartnerKoppelingKaart, { type PartnerApi, type PartnerStatusData } from '@/components/integrations/PartnerKoppelingKaart';

/**
 * Automatische opvolging (zoals Snelraak via WhatsApp) in de klantkaart: in
 * één oogopslag of het aan staat, en met één klik aan of uit. Koppelen en
 * beheren kan hier ook, met dezelfde kaart als op de pagina
 * Partnerkoppelingen. Niet zichtbaar voor accountmanagers (de API weigert hen).
 */

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
  if (!iso) return 'nog geen';
  const d = new Date(iso);
  const tijd = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `vandaag ${tijd}`;
  return `${d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ${tijd}`;
}

function Schakelaar({ aan, bezig, onClick, label }: { aan: boolean; bezig: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aan}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={bezig}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${aan ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${aan ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

function EenPartner({ customerId, klantNaam, partnerId }: { customerId: string; klantNaam: string; partnerId: string }) {
  const { confirm } = useAdminConfirm();
  const [s, setS] = useState<PartnerStatusData | null>(null);
  const [geenToegang, setGeenToegang] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [open, setOpen] = useState(false);
  const [melding, setMelding] = useState<{ ok: boolean; tekst: string } | null>(null);
  const api = apiVoor(customerId, partnerId);

  const laad = useCallback(async () => {
    const res = await adminFetch(`/api/admin/partnerkoppelingen/${customerId}/${partnerId}`, { cache: 'no-store' });
    if (res.status === 403) { setGeenToegang(true); return; }
    if (res.ok) setS(await res.json());
  }, [customerId, partnerId]);

  useEffect(() => { setS(null); setOpen(false); setMelding(null); void laad(); }, [laad]);

  if (geenToegang) return null;
  if (!s) return <div className="h-[92px] animate-pulse rounded-lg border border-slate-100 bg-slate-50/70" />;

  const naam = s.partner.naam;

  const wissel = async () => {
    const nieuw = !s.aan;
    if (!nieuw) {
      const zeker = await confirm({
        title: `${naam} uitzetten?`,
        message: `Nieuwe leads van ${klantNaam} gaan dan niet meer naar ${naam}, en worden ook later niet nagestuurd. Je kunt het altijd weer aanzetten.`,
        confirmLabel: 'Uitzetten',
        destructive: true,
      });
      if (!zeker) return;
    }
    setBezig(true);
    setMelding(null);
    const vorige = s;
    setS({ ...s, aan: nieuw });
    try {
      const r = await api.opslaan({ enabled: nieuw });
      if (!r.ok || !r.status) throw new Error(r.fout ?? 'Opslaan mislukt');
      setS(r.status);
      setMelding({
        ok: true,
        tekst: nieuw ? `Aan: nieuwe leads gaan vanaf nu binnen seconden naar ${naam}.` : `Uit: nieuwe leads gaan niet meer naar ${naam}.`,
      });
    } catch (err) {
      setS(vorige);
      setMelding({ ok: false, tekst: err instanceof Error ? err.message : 'Opslaan mislukt' });
    } finally {
      setBezig(false);
    }
  };

  const [pilKleur, pilTekst] = !s.gekoppeld
    ? ['bg-slate-100 text-slate-500', 'Niet gekoppeld']
    : s.actie_nodig
      ? ['bg-red-100 text-red-700', 'Actie nodig']
      : s.aan
        ? ['bg-emerald-100 text-emerald-700', 'Aan']
        : ['bg-amber-100 text-amber-700', 'Uit'];

  return (
    <div className={`rounded-lg border p-4 transition-colors ${s.actie_nodig ? 'border-red-200 bg-red-50/40' : s.aan ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/70'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PartnerLogo naam={naam} logo={s.partner.logo} grootte={32} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">{s.partner.tagline}</p>
            <p className="text-[11px] text-slate-400">via {naam}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pilKleur}`}>{pilTekst}</span>
          {s.gekoppeld && (
            <Schakelaar
              aan={s.aan}
              bezig={bezig}
              onClick={() => void wissel()}
              label={s.aan ? `${naam} uitzetten` : `${naam} aanzetten`}
            />
          )}
        </div>
      </div>

      {s.gekoppeld ? (
        <div className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Laatste lead afgeleverd</span>
            <span className="font-medium text-slate-600">{wanneer(s.laatste_succes)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Laatste 7 dagen</span>
            <span className="font-medium text-slate-600">
              {s.zeven_dagen.gelukt} afgeleverd
              {s.zeven_dagen.mislukt > 0 && <span className="text-red-600"> · {s.zeven_dagen.mislukt} mislukt</span>}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Plak het afleveradres dat {naam} voor deze klant aanleverde. Elke nieuwe lead gaat dan binnen seconden door.
        </p>
      )}

      {s.actie_nodig && s.laatste_fout && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700">
          <ExclamationTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{s.laatste_fout.melding}</span>
        </div>
      )}

      {melding && (
        <p className={`mt-3 text-xs ${melding.ok ? 'text-emerald-700' : 'text-red-600'}`}>{melding.tekst}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          {s.gekoppeld ? 'Beheren' : 'Koppelen'}
        </button>
        <Link
          href="/admin/partnerkoppelingen"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-600"
        >
          Alle koppelingen <ArrowTopRightOnSquareIcon className="h-3 w-3" />
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <PartnerKoppelingKaart
                status={s}
                api={api}
                admin
                onBijgewerkt={nieuw => { if (nieuw) setS(nieuw); else void laad(); setMelding(null); }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PartnerOpvolgingBlok({ customerId, klantNaam }: { customerId: string; klantNaam: string }) {
  return (
    <div className="space-y-2">
      {PARTNERS.map(p => (
        <EenPartner key={`${customerId}-${p.id}`} customerId={customerId} klantNaam={klantNaam} partnerId={p.id} />
      ))}
    </div>
  );
}
