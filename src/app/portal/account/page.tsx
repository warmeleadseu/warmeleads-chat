'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePortal } from '../portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  MapPinIcon,
  ChartBarIcon,
  UserCircleIcon,
  GlobeAltIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BellIcon,
  BellSlashIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  DevicePhoneMobileIcon,
  ShoppingCartIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { usePushNotifications } from '../usePushNotifications';

/* ─── Types ────────────────────────────────────────────────── */

interface AccountData {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  branches: string[];
  created_at: string;
  email_notifications: boolean;
  notification_frequency: string;
}

interface InsightsData {
  conversionFunnel: { nieuw: number; gecontacteerd: number; offerte: number; verkocht: number; afgewezen: number; conversionRate: number };
  quality: { averageScore: number; phoneValidPct: number; totalWithScore: number };
  responseSpeed: { averageHours: number | null };
  periodComparison: { thisWeek: number; lastWeek: number; thisMonth: number; lastMonth: number };
  topLocations: { plaatsnaam: string; count: number }[];
  topProvinces: { provincie: string; count: number }[];
}

interface TargetArea {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radius_km: number;
  leads_count: number;
}

interface OrderData {
  id: string;
  branch: string;
  batch_size: number;
  price_per_lead: number;
  total_price: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

/* ─── Constants ────────────────────────────────────────────── */

const TABS = [
  { key: 'account', label: 'Mijn Account', icon: UserCircleIcon },
  { key: 'insights', label: 'Prestaties', icon: ChartBarIcon },
  { key: 'areas', label: 'Gebieden', icon: GlobeAltIcon },
  { key: 'orders', label: 'Bestellingen', icon: ShoppingCartIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ─── Helpers ──────────────────────────────────────────────── */

function formatDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function qualityLabel(score: number): { label: string; color: string } {
  if (score >= 8) return { label: 'Uitstekend', color: 'text-emerald-600' };
  if (score >= 6) return { label: 'Goed', color: 'text-blue-600' };
  if (score >= 4) return { label: 'Gemiddeld', color: 'text-amber-600' };
  return { label: 'Laag', color: 'text-red-500' };
}

function pctChange(current: number, previous: number): { pct: number; up: boolean } {
  if (previous === 0) return { pct: current > 0 ? 100 : 0, up: current > 0 };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

/* ─── Skeletons ────────────────────────────────────────────── */

function AccountSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-slate-100" />
          <div className="space-y-2">
            <div className="h-10 animate-pulse rounded-lg bg-slate-50" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 h-4 w-36 animate-pulse rounded bg-slate-100" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-50" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-8 w-16 animate-pulse rounded bg-slate-50" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AreasSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 h-4 w-40 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-60 animate-pulse rounded bg-slate-50" />
          <div className="mt-3 h-2 animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* ─── Tab 1: Mijn Account ──────────────────────────────────── */

function AccountTab({
  data,
  loading,
  showToast,
}: {
  data: AccountData | null;
  loading: boolean;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [frequency, setFrequency] = useState('instant');
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setEmailEnabled(data.email_notifications);
      setFrequency(data.notification_frequency || 'instant');
    }
  }, [data]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      showToast('Wachtwoorden komen niet overeen', 'error');
      return;
    }
    if (newPw.length < 8) {
      showToast('Wachtwoord moet minimaal 8 tekens bevatten', 'error');
      return;
    }
    setPwLoading(true);
    try {
      const res = await portalFetch('/api/portal/account', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (res.ok) {
        showToast('Wachtwoord succesvol gewijzigd');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Fout bij wijzigen wachtwoord', 'error');
      }
    } catch {
      showToast('Er ging iets mis', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const saveNotifPrefs = async (enabled: boolean, freq: string) => {
    setEmailEnabled(enabled);
    setFrequency(freq);
    setNotifSaving(true);
    try {
      const res = await portalFetch('/api/portal/account', {
        method: 'PUT',
        body: JSON.stringify({ email_notifications: enabled, notification_frequency: freq }),
      });
      if (res.ok) {
        showToast(enabled ? 'E-mailnotificaties ingeschakeld' : 'E-mailnotificaties uitgeschakeld');
      } else {
        showToast('Fout bij opslaan voorkeuren', 'error');
      }
    } catch {
      showToast('Er ging iets mis', 'error');
    } finally {
      setNotifSaving(false);
    }
  };

  if (loading) return <AccountSkeleton />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Bedrijfsgegevens */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Bedrijfsgegevens</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Bedrijfsnaam', value: data.name, icon: BuildingOfficeIcon },
            { label: 'Contactpersoon', value: data.contact_person, icon: UserCircleIcon },
            { label: 'E-mailadres', value: data.email, icon: EnvelopeIcon },
            { label: 'Telefoonnummer', value: data.phone || '-', icon: PhoneIcon },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs font-medium text-slate-500">{field.label}</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <field.icon className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-sm text-slate-700">{field.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Branches */}
      {data.branches.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Branches</h3>
          <div className="flex flex-wrap gap-2">
            {data.branches.map((b) => (
              <span
                key={b}
                className="rounded-full bg-brand-purple/10 px-3 py-1 text-xs font-medium text-brand-purple"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Wachtwoord wijzigen */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Wachtwoord wijzigen</h3>
        <form onSubmit={handlePasswordChange} className="space-y-3 sm:max-w-md">
          {[
            { label: 'Huidig wachtwoord', value: currentPw, set: setCurrentPw, show: showCurrent, toggle: setShowCurrent, placeholder: 'Voer uw huidige wachtwoord in' },
            { label: 'Nieuw wachtwoord', value: newPw, set: setNewPw, show: showNew, toggle: setShowNew, placeholder: 'Min. 8 tekens' },
            { label: 'Bevestig wachtwoord', value: confirmPw, set: setConfirmPw, show: showConfirm, toggle: setShowConfirm, placeholder: 'Herhaal nieuw wachtwoord' },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs font-medium text-slate-500">{field.label}</label>
              <div className="relative">
                <input
                  type={field.show ? 'text' : 'password'}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm text-slate-700 placeholder-slate-300 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => field.toggle(!field.show)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  {field.show ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <button
            type="submit"
            disabled={pwLoading || !currentPw || !newPw || !confirmPw}
            className="mt-1 rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
          >
            {pwLoading ? 'Bezig...' : 'Wachtwoord wijzigen'}
          </button>
        </form>
      </div>

      {/* E-mail notificaties */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">E-mail notificaties</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {emailEnabled ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-purple/10">
                <BellIcon className="h-5 w-5 text-brand-purple" />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <BellSlashIcon className="h-5 w-5 text-slate-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-slate-900">Nieuwe leads per e-mail</p>
              <p className="text-xs text-slate-500">Ontvang een melding bij nieuwe leads</p>
            </div>
          </div>
          <button
            onClick={() => saveNotifPrefs(!emailEnabled, frequency)}
            disabled={notifSaving}
            className={`relative h-6 w-11 rounded-full transition-colors ${emailEnabled ? 'bg-brand-purple' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${emailEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <AnimatePresence>
          {emailEnabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="mb-2 text-xs text-slate-500">Frequentie</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'instant', label: 'Direct' },
                    { value: 'daily', label: 'Dagelijks' },
                    { value: 'weekly', label: 'Wekelijks' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => saveNotifPrefs(true, opt.value)}
                      disabled={notifSaving}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                        frequency === opt.value
                          ? 'bg-brand-purple/10 text-brand-purple border border-brand-purple/30'
                          : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Push notificaties */}
      <AccountPushToggle showToast={showToast} />

      {/* Member since */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <SparklesIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Lid sinds</p>
            <p className="text-xs text-slate-500">{formatDate(data.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-xs text-slate-500">
          Wijzigingen aan uw bedrijfsgegevens? Neem contact op via{' '}
          <a href="mailto:info@warmeleads.eu" className="font-medium text-brand-purple hover:underline">
            info@warmeleads.eu
          </a>
        </p>
      </div>
    </div>
  );
}

/* ─── Push Toggle (Account) ───────────────────────────────── */
function AccountPushToggle({ showToast }: { showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const { state, toggling, toggle, lastError } = usePushNotifications();

  const handleToggle = async () => {
    const success = await toggle();
    if (success) showToast(state === 'enabled' ? 'Push notificaties uitgeschakeld' : 'Push notificaties ingeschakeld');
    else if (state !== 'denied') showToast(lastError || 'Kon push notificaties niet wijzigen', 'error');
  };

  if (state === 'loading' || state === 'unsupported') return null;

  const isEnabled = state === 'enabled';
  const isDenied = state === 'denied';
  const isIos = state === 'ios-not-installed';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Push notificaties</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEnabled ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-purple/10">
              <DevicePhoneMobileIcon className="h-5 w-5 text-brand-purple" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <DevicePhoneMobileIcon className="h-5 w-5 text-slate-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-900">Meldingen op dit apparaat</p>
            <p className="text-xs text-slate-500">
              {isEnabled && 'Actief'}
              {state === 'disabled' && 'Ontvang direct een melding op uw telefoon'}
              {isDenied && 'Geblokkeerd in uw browser'}
              {isIos && 'Installeer eerst de app'}
            </p>
          </div>
        </div>
        {!isDenied && !isIos && (
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${isEnabled ? 'bg-brand-purple' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        )}
      </div>
      {isDenied && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs text-amber-700">Notificaties zijn geblokkeerd in uw browser. Ga naar uw browserinstellingen om dit te wijzigen.</p>
        </div>
      )}
      {isIos && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
          <DevicePhoneMobileIcon className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
          <p className="text-xs text-blue-700">Installeer de app op uw startscherm om push notificaties te ontvangen.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Tab 2: Prestaties (Insights) ─────────────────────────── */

function InsightsTab({
  data,
  loading,
}: {
  data: InsightsData | null;
  loading: boolean;
}) {
  if (loading) return <InsightsSkeleton />;
  if (!data) return null;

  const hasData = data.conversionFunnel.nieuw + data.conversionFunnel.gecontacteerd + data.conversionFunnel.offerte + data.conversionFunnel.verkocht + data.conversionFunnel.afgewezen > 0;
  if (!hasData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
        <ChartBarIcon className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p className="font-medium text-slate-600">Nog geen prestaties</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">
          Zodra u leads ontvangt en bewerkt, verschijnen hier uw statistieken en inzichten.
        </p>
      </div>
    );
  }

  const f = data.conversionFunnel;
  const funnelSteps = [
    { key: 'nieuw', label: 'Nieuw', count: f.nieuw, color: 'bg-blue-500' },
    { key: 'gecontacteerd', label: 'Gecontacteerd', count: f.gecontacteerd, color: 'bg-amber-500' },
    { key: 'offerte', label: 'Offerte', count: f.offerte, color: 'bg-purple-500' },
    { key: 'verkocht', label: 'Verkocht', count: f.verkocht, color: 'bg-emerald-500' },
    { key: 'afgewezen', label: 'Afgewezen', count: f.afgewezen, color: 'bg-red-400' },
  ];
  const funnelMax = Math.max(...funnelSteps.map((s) => s.count), 1);
  const funnelTotal = f.nieuw + f.gecontacteerd + f.offerte + f.verkocht + f.afgewezen || 1;

  const ql = qualityLabel(data.quality.averageScore / 10);
  const weekChange = pctChange(data.periodComparison.thisWeek, data.periodComparison.lastWeek);
  const monthChange = pctChange(data.periodComparison.thisMonth, data.periodComparison.lastMonth);

  const maxCityCount = Math.max(...(data.topLocations.map((c) => c.count) || [1]), 1);
  const maxProvinceCount = Math.max(...(data.topProvinces.map((p) => p.count) || [1]), 1);

  return (
    <div className="space-y-6">
      {/* Conversie Funnel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Conversie Funnel</h3>
          {f.conversionRate > 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
              {f.conversionRate}% conversie
            </span>
          )}
        </div>
        <div className="space-y-3">
          {funnelSteps.map((step) => {
            const widthPct = Math.max((step.count / funnelMax) * 100, 4);
            const pct = Math.round((step.count / funnelTotal) * 100);
            return (
              <div key={step.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{step.label}</span>
                  <span className="text-slate-500">
                    {step.count} <span className="text-slate-400">({pct}%)</span>
                  </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-lg bg-slate-50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`flex h-full items-center rounded-lg ${step.color}`}
                  >
                    <span className="px-2 text-[11px] font-bold text-white">{step.count}</span>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead Kwaliteit + Response Snelheid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Lead Kwaliteit</h3>
          <div className="mb-3 flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${ql.color}`}>{(data.quality.averageScore / 10).toFixed(1)}</span>
            <span className={`text-sm font-medium ${ql.color}`}>{ql.label}</span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Telefoon geldig</span>
              <span className="font-semibold text-slate-700">{data.quality.phoneValidPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.quality.phoneValidPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Response Snelheid</h3>
          {data.responseSpeed.averageHours != null ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <ClockIcon className="h-5 w-5 text-slate-400" />
                <span className="text-3xl font-bold text-slate-900">
                  {data.responseSpeed.averageHours < 1
                    ? `${Math.round(data.responseSpeed.averageHours * 60)} min`
                    : `${data.responseSpeed.averageHours.toFixed(1)} uur`}
                </span>
              </div>
              <p className="text-xs text-slate-500">Gem. tijd tot eerste statuswijziging</p>
              {data.responseSpeed.averageHours < 24 ? (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700">Uitstekend! Snelle opvolging</span>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">Probeer leads binnen 24 uur op te volgen</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <ClockIcon className="mb-2 h-8 w-8 text-slate-200" />
              <span className="text-sm text-slate-400">Nog geen data</span>
              <span className="mt-0.5 text-xs text-slate-300">Wordt zichtbaar na statuswijzigingen</span>
            </div>
          )}
        </div>
      </div>

      {/* Periode Vergelijking */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: 'Deze week vs vorige week', ...weekChange, current: data.periodComparison.thisWeek, previous: data.periodComparison.lastWeek },
          { label: 'Deze maand vs vorige maand', ...monthChange, current: data.periodComparison.thisMonth, previous: data.periodComparison.lastMonth },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-medium text-slate-500">{item.label}</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-slate-900">{item.current}</span>
              {(item.current > 0 || item.previous > 0) ? (
                <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  item.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                }`}>
                  {item.up ? (
                    <ArrowTrendingUpIcon className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowTrendingDownIcon className="h-3.5 w-3.5" />
                  )}
                  {item.pct}%
                </div>
              ) : (
                <span className="text-xs text-slate-300">-</span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Vorige periode: {item.previous} leads
            </p>
          </div>
        ))}
      </div>

      {/* Top Locaties */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Top 10 Steden */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Top Steden</h3>
          {data.topLocations.length > 0 ? (
            <div className="space-y-2">
              {data.topLocations.slice(0, 10).map((city, i) => (
                <div key={city.plaatsnaam} className="flex items-center gap-3">
                  <span className="w-5 text-right text-[11px] font-semibold text-slate-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="mb-0.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{city.plaatsnaam}</span>
                      <span className="text-slate-500">{city.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-purple/60 transition-all duration-500"
                        style={{ width: `${(city.count / maxCityCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nog geen data beschikbaar</p>
          )}
        </div>

        {/* Provincies */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Provincies</h3>
          {data.topProvinces.length > 0 ? (
            <div className="space-y-2">
              {data.topProvinces.map((prov) => (
                <div key={prov.provincie}>
                  <div className="mb-0.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{prov.provincie}</span>
                    <span className="text-slate-500">{prov.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all duration-500"
                      style={{ width: `${(prov.count / maxProvinceCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nog geen data beschikbaar</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 3: Mijn Gebieden ─────────────────────────────────── */

function AreasTab({
  data,
  loading,
}: {
  data: TargetArea[];
  loading: boolean;
}) {
  if (loading) return <AreasSkeleton />;

  const maxRadius = Math.max(...data.map((a) => a.radius_km), 1);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <MapPinIcon className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p className="font-medium text-slate-600">Geen targetgebieden</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-400">
          Er zijn nog geen targetgebieden ingesteld. Neem contact op met WarmeLeads.
        </p>
        <a
          href="mailto:info@warmeleads.eu"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md"
        >
          <EnvelopeIcon className="h-4 w-4" />
          Contact opnemen
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((area) => {
        const radiusPct = (area.radius_km / maxRadius) * 100;
        return (
          <motion.div
            key={area.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10">
                  <MapPinIcon className="h-5 w-5 text-brand-purple" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    {area.label || (area.radius_km >= 500 ? 'Heel Nederland / België' : `Gebied ${area.id.slice(0, 6)}`)}
                  </p>
                  {area.radius_km < 500 && area.lat && area.lng && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {area.lat.toFixed(2)}°N, {area.lng.toFixed(2)}°E
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                  {area.radius_km >= 500 ? 'Landelijk' : `${area.radius_km} km`}
                </span>
                <span className="rounded-full bg-brand-purple/10 px-2.5 py-1 font-medium text-brand-purple">
                  {area.leads_count} leads
                </span>
              </div>
            </div>
            {area.radius_km < 500 && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Bereik</span>
                  <span>{area.radius_km} km</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${radiusPct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                  />
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */

function OrdersTab({ data, loading, onDelete }: { data: OrderData[]; loading: boolean; onDelete: (id: string) => void }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <ShoppingCartIcon className="h-7 w-7 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Geen bestellingen</p>
        <p className="mt-1 text-xs text-slate-400">U heeft nog geen batches besteld via het portaal.</p>
        <a
          href="/portal/bestellen"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-purple/10 px-3.5 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/20"
        >
          <ShoppingCartIcon className="h-3.5 w-3.5" />
          Eerste batch bestellen
        </a>
      </div>
    );
  }

  const statusConfig = (s: string) => {
    const map: Record<string, { text: string; cls: string; dot: string }> = {
      paid: { text: 'Betaald', cls: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
      pending: { text: 'In behandeling', cls: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
      failed: { text: 'Mislukt', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
      expired: { text: 'Verlopen', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
      cancelled: { text: 'Geannuleerd', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
    };
    return map[s] || { text: s, cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' };
  };

  const paidCount = data.filter(o => o.status === 'paid').length;
  const totalExBtw = data.filter(o => o.status === 'paid').reduce((sum, o) => sum + Number(o.total_price), 0);
  const totalInclBtw = Math.round(totalExBtw * 1.21 * 100) / 100;

  return (
    <div className="space-y-4">
      {paidCount > 0 && (
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Totaal besteld</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{paidCount} {paidCount === 1 ? 'batch' : 'batches'}</p>
          </div>
          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Totaal uitgegeven</p>
            <p className="mt-1 text-lg font-bold text-brand-purple">&euro;{totalInclBtw.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400">incl. BTW</p>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {data.map(order => {
          const st = statusConfig(order.status);
          return (
            <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{order.batch_size} leads</p>
                    <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-semibold text-brand-purple">{order.branch}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(order.created_at).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {order.paid_at && (
                    <p className="mt-0.5 text-[11px] text-emerald-500">
                      Betaald op {new Date(order.paid_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.text}
                    </span>
                    <p className="mt-1.5 text-sm font-bold text-slate-900">&euro;{(Number(order.total_price) * 1.21).toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400">incl. BTW &middot; &euro;{Number(order.price_per_lead).toFixed(2)} /lead excl.</p>
                  </div>
                  {order.status !== 'paid' && (
                    <button
                      onClick={() => onDelete(order.id)}
                      className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                      title="Bestelling verwijderen"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { customer } = usePortal();
  const [activeTab, setActiveTab] = useState<TabKey>('account');

  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const [areasData, setAreasData] = useState<TargetArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);

  const [ordersData, setOrdersData] = useState<OrderData[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAccount = useCallback(async () => {
    setAccountLoading(true);
    try {
      const res = await portalFetch('/api/portal/account');
      if (res.ok) {
        const d = await res.json();
        setAccountData(d.customer || d);
      }
    } catch { /* ignore */ }
    finally { setAccountLoading(false); }
  }, []);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await portalFetch('/api/portal/insights');
      if (res.ok) {
        const d = await res.json();
        setInsightsData(d);
      }
    } catch { /* ignore */ }
    finally { setInsightsLoading(false); }
  }, []);

  const fetchAreas = useCallback(async () => {
    setAreasLoading(true);
    try {
      const res = await portalFetch('/api/portal/targets');
      if (res.ok) {
        const d = await res.json();
        setAreasData(d.targets || d || []);
      }
    } catch { /* ignore */ }
    finally { setAreasLoading(false); }
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await portalFetch('/api/portal/orders');
      if (res.ok) {
        const d = await res.json();
        setOrdersData(Array.isArray(d) ? d : []);
      }
    } catch { /* ignore */ }
    finally { setOrdersLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'account' && !accountData) fetchAccount();
    if (activeTab === 'insights' && !insightsData) fetchInsights();
    if (activeTab === 'areas' && areasData.length === 0) fetchAreas();
    if (activeTab === 'orders' && ordersData.length === 0) fetchOrders();
  }, [activeTab, accountData, insightsData, areasData.length, ordersData.length, fetchAccount, fetchInsights, fetchAreas, fetchOrders]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <ExclamationTriangleIcon className="h-4 w-4 text-red-200" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              )}
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Account & Insights</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Beheer uw account, bekijk prestaties en targetgebieden
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition sm:gap-2 sm:text-sm ${
              activeTab === tab.key
                ? 'bg-brand-purple text-white shadow-sm shadow-brand-purple/20'
                : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/60 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'account' && (
            <AccountTab
              data={accountData}
              loading={accountLoading}
              showToast={showToast}
            />
          )}
          {activeTab === 'insights' && (
            <InsightsTab data={insightsData} loading={insightsLoading} />
          )}
          {activeTab === 'areas' && (
            <AreasTab data={areasData} loading={areasLoading} />
          )}
          {activeTab === 'orders' && (
            <OrdersTab
              data={ordersData}
              loading={ordersLoading}
              onDelete={async (id) => {
                if (!confirm('Weet u zeker dat u deze bestelling wilt verwijderen?')) return;
                try {
                  const res = await portalFetch('/api/portal/orders', {
                    method: 'DELETE',
                    body: JSON.stringify({ order_id: id }),
                  });
                  if (res.ok) {
                    setOrdersData(prev => prev.filter(o => o.id !== id));
                    showToast('Bestelling verwijderd');
                  } else {
                    const d = await res.json().catch(() => ({}));
                    showToast(d.error || 'Verwijderen mislukt', 'error');
                  }
                } catch {
                  showToast('Verwijderen mislukt', 'error');
                }
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
