'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpOnSquareIcon, BellAlertIcon, DevicePhoneMobileIcon, EllipsisVerticalIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAdminPush } from '../_terugbellen/useAdminPush';

/**
 * Het admin-paneel als eigen webapp op de telefoon ("WL Admin", opent op /admin),
 * los van de klantapp. Op een iPhone kan alleen zo een pushmelding binnenkomen.
 *
 * De root-layout linkt naar /manifest.json (klantportaal); in het admin-paneel
 * wisselen we die om naar /manifest-admin.json, zodat "Zet op beginscherm" en
 * "App installeren" de admin-app maken.
 */

const ADMIN_MANIFEST = '/manifest-admin.json';
const ADMIN_TITEL = 'WL Admin';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function useAdminManifest() {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const maakte = !link;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    const oudLink = link.getAttribute('href');
    link.setAttribute('href', ADMIN_MANIFEST);
    const titel = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const oudTitel = titel?.getAttribute('content') ?? null;
    titel?.setAttribute('content', ADMIN_TITEL);
    return () => {
      if (maakte) link!.remove();
      else if (oudLink) link!.setAttribute('href', oudLink);
      if (titel && oudTitel) titel.setAttribute('content', oudTitel);
    };
  }, []);
}

type Apparaat = 'ios' | 'android' | 'anders';

function apparaat(): Apparaat {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'anders';
}

const isGeinstalleerd = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Onthoudt de installatievraag van Chrome, die maar één keer langskomt. */
let bewaardePrompt: InstallPrompt | null = null;
const luisteraars = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    bewaardePrompt = e as InstallPrompt;
    luisteraars.forEach(f => f());
  });
  window.addEventListener('appinstalled', () => {
    bewaardePrompt = null;
    luisteraars.forEach(f => f());
  });
}

/**
 * Knop in de mobiele kopbalk: "App" zolang het paneel in de browser draait,
 * en in de app zelf "Meldingen" zolang die nog niet aanstaan.
 */
export function AdminAppKnop() {
  const [klaar, setKlaar] = useState(false);
  const [geinstalleerd, setGeinstalleerd] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [uitleg, setUitleg] = useState(false);
  const push = useAdminPush();

  useEffect(() => {
    setGeinstalleerd(isGeinstalleerd());
    setPrompt(bewaardePrompt);
    setKlaar(true);
    const bij = () => { setPrompt(bewaardePrompt); setGeinstalleerd(isGeinstalleerd()); };
    luisteraars.add(bij);
    return () => { luisteraars.delete(bij); };
  }, []);

  if (!klaar) return null;

  if (geinstalleerd) {
    if (push.state !== 'disabled') return null;
    return (
      <button
        type="button"
        onClick={() => void push.zetAan()}
        disabled={push.bezig}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 active:bg-sky-100 disabled:opacity-50"
      >
        <BellAlertIcon className="h-4 w-4" />
        {push.bezig ? 'Aanzetten…' : 'Meldingen'}
      </button>
    );
  }

  const installeer = async () => {
    if (prompt) {
      await prompt.prompt();
      const keuze = await prompt.userChoice.catch(() => null);
      bewaardePrompt = null;
      setPrompt(null);
      if (keuze?.outcome === 'accepted') return;
    }
    setUitleg(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void installeer()}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-3 text-xs font-semibold text-brand-purple active:bg-brand-purple/10"
      >
        <DevicePhoneMobileIcon className="h-4 w-4" />
        App
      </button>
      <AnimatePresence>{uitleg && <Uitleg onSluit={() => setUitleg(false)} />}</AnimatePresence>
    </>
  );
}

function Stap({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-xs font-bold text-brand-purple">{n}</span>
      <span className="pt-0.5 text-sm text-slate-700">{children}</span>
    </li>
  );
}

function Uitleg({ onSluit }: { onSluit: () => void }) {
  const soort = apparaat();
  const isSafari = soort === 'ios' && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
  return createPortal(
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/40" onClick={onSluit} aria-hidden />
      <div className="pointer-events-none fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'tween', duration: 0.2 }}
          role="dialog" aria-modal="true" aria-labelledby="admin-app-titel"
          className="pointer-events-auto w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-2xl"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple"><DevicePhoneMobileIcon className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 id="admin-app-titel" className="text-base font-semibold text-slate-900">WL Admin op je telefoon</h2>
              <p className="text-sm text-slate-500">Eén keer instellen, daarna open je het paneel met een icoon en krijg je meldingen, zoals bij terugbelafspraken.</p>
            </div>
            <button type="button" onClick={onSluit} aria-label="Sluiten" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
          {soort === 'ios' && !isSafari && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Open deze pagina het liefst in <strong>Safari</strong>; daar werkt het het best.</p>
          )}
          <ol className="mt-4 space-y-3">
            {soort === 'ios' ? (
              <>
                <Stap n={1}>Tik onderin op de deelknop <ArrowUpOnSquareIcon className="inline h-4 w-4 align-text-bottom" />.</Stap>
                <Stap n={2}>Kies <strong>Zet op beginscherm</strong> en tik op <strong>Voeg toe</strong>.</Stap>
                <Stap n={3}>Open <strong>WL Admin</strong> vanaf je beginscherm, log in en tik op <strong>Meldingen</strong> bovenin.</Stap>
              </>
            ) : soort === 'android' ? (
              <>
                <Stap n={1}>Tik in Chrome rechtsboven op het menu <EllipsisVerticalIcon className="inline h-4 w-4 align-text-bottom" />.</Stap>
                <Stap n={2}>Kies <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong>.</Stap>
                <Stap n={3}>Open <strong>WL Admin</strong>, log in en tik op <strong>Meldingen</strong> bovenin.</Stap>
              </>
            ) : (
              <>
                <Stap n={1}>Open <strong>warmeleads.eu/admin</strong> op je telefoon.</Stap>
                <Stap n={2}>Tik daar op de knop <strong>App</strong> bovenin en volg de stappen.</Stap>
              </>
            )}
          </ol>
          <button type="button" onClick={onSluit} className="mt-5 min-h-[44px] w-full rounded-lg bg-brand-purple px-4 text-sm font-semibold text-white hover:bg-brand-purple/90">Begrepen</button>
        </motion.div>
      </div>
    </>,
    document.body,
  );
}
