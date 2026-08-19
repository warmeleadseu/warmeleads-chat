'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BuildingOfficeIcon,
  PuzzlePieceIcon,
  MapPinIcon,
  KeyIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
  GlobeEuropeAfricaIcon,
  MapIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  SunIcon,
  FireIcon,
  WrenchScrewdriverIcon,
  AdjustmentsVerticalIcon,
  ServerStackIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SoftGlow } from '@/components/ui/SoftGlow';
import { PROVINCE_OPTIONS_BE, PROVINCE_OPTIONS_NL } from '@/data/provinces';
import { validatePhone } from '@/lib/phoneValidation';

interface Branch {
  slug: string;
  name: string;
  color: string;
  description: string;
}

interface KvkResult {
  kvkNummer: string;
  vestigingsnummer: string;
  naam: string;
  type: string;
  actief: boolean;
  straatnaam: string;
  huisnummer: string;
  postcode: string;
  plaats: string;
}

const BRANCH_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  thuisbatterij: BoltIcon,
  zakelijke_batterij: ServerStackIcon,
  zonnepanelen: SunIcon,
  airco: AdjustmentsVerticalIcon,
  warmtepomp: FireIcon,
  financial_lease: TruckIcon,
  maatwerk: WrenchScrewdriverIcon,
};

const STEPS = [
  { num: 1, label: 'Bedrijf', icon: BuildingOfficeIcon },
  { num: 2, label: 'Branche', icon: PuzzlePieceIcon },
  { num: 3, label: 'Regio', icon: MapPinIcon },
  { num: 4, label: 'Account', icon: KeyIcon },
];

export default function GratisAccountPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [kvkNummer, setKvkNummer] = useState('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  const [regionType, setRegionType] = useState<'nl' | 'be' | 'specific' | null>(null);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const emailCheckTimer = useRef<NodeJS.Timeout | null>(null);

  const [kvkQuery, setKvkQuery] = useState('');
  const [kvkResults, setKvkResults] = useState<KvkResult[]>([]);
  const [kvkOpen, setKvkOpen] = useState(false);
  const [kvkLoading, setKvkLoading] = useState(false);
  const [kvkLinked, setKvkLinked] = useState(false);
  const [kvkAddress, setKvkAddress] = useState<{ street: string; house_number: string; postcode: string; city: string } | null>(null);
  const kvkRef = useRef<HTMLDivElement>(null);
  const kvkTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (kvkRef.current && !kvkRef.current.contains(e.target as Node)) {
        setKvkOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchKvk = useCallback((q: string) => {
    if (kvkTimer.current) clearTimeout(kvkTimer.current);
    setKvkResults([]);
    if (q.length < 2) { setKvkOpen(false); return; }
    setKvkLoading(true);
    setKvkOpen(true);
    kvkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kvk?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setKvkResults(data.resultaten || []);
        }
      } catch { /* ignore */ }
      setKvkLoading(false);
    }, 500);
  }, []);

  const handleKvkQueryChange = (val: string) => {
    setKvkQuery(val);
    if (!kvkLinked) {
      setName(val);
      searchKvk(val);
    }
  };

  const fmtPc = (pc: string) => {
    const raw = pc.replace(/\s/g, '');
    return /^\d{4}[A-Za-z]{2}$/.test(raw) ? `${raw.slice(0, 4)} ${raw.slice(4).toUpperCase()}` : pc;
  };

  const selectKvkResult = useCallback((r: KvkResult) => {
    setName(r.naam);
    setKvkNummer(r.kvkNummer);
    setKvkLinked(true);
    setKvkQuery('');
    setKvkOpen(false);
    setKvkResults([]);
    if (r.straatnaam || r.postcode || r.plaats) {
      setKvkAddress({
        street: String(r.straatnaam || ''),
        house_number: String(r.huisnummer || ''),
        postcode: fmtPc(String(r.postcode || '')),
        city: String(r.plaats || ''),
      });
    }
  }, []);

  const unlinkKvk = useCallback(() => {
    setKvkLinked(false);
    setKvkNummer('');
    setKvkAddress(null);
    setKvkQuery(name);
  }, [name]);

  useEffect(() => {
    fetch('/api/branches')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBranches(data);
      })
      .catch(() => {});
  }, []);

  const checkEmail = useCallback((val: string) => {
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    setEmailAvailable(null);
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
    setEmailChecking(true);
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/portal/auth/check-email?email=${encodeURIComponent(val)}`);
        const data = await res.json();
        setEmailAvailable(data.available);
      } catch { /* ignore */ }
      setEmailChecking(false);
    }, 500);
  }, []);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    checkEmail(val);
  };

  const toggleBranch = (slug: string) => {
    setSelectedBranches((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const toggleProvince = (p: string) => {
    setSelectedProvinces((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleRegionType = (type: 'nl' | 'be' | 'specific') => {
    if (regionType === type) {
      setRegionType(null);
      setSelectedProvinces([]);
      return;
    }
    setRegionType(type);
    if (type === 'nl') setSelectedProvinces(PROVINCE_OPTIONS_NL.map(o => o.value));
    else if (type === 'be') setSelectedProvinces(PROVINCE_OPTIONS_BE.map(o => o.value));
    else setSelectedProvinces([]);
  };

  const canNext = (): boolean => {
    if (step === 1) return !!name && !!contactPerson && !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!phone && validatePhone(phone).valid && emailAvailable !== false;
    if (step === 2) return selectedBranches.length > 0;
    if (step === 3) return selectedProvinces.length > 0;
    if (step === 4) return password.length >= 8 && password === passwordConfirm && agreedToTerms;
    return false;
  };

  const passwordStrength = (): { label: string; color: string; width: string } => {
    if (password.length === 0) return { label: '', color: '', width: '0%' };
    if (password.length < 8) return { label: 'Te kort', color: 'bg-red-500', width: '25%' };
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasNumber, hasSpecial, password.length >= 12].filter(Boolean).length;
    if (score <= 1) return { label: 'Zwak', color: 'bg-orange-500', width: '50%' };
    if (score <= 2) return { label: 'Redelijk', color: 'bg-amber-500', width: '70%' };
    return { label: 'Sterk', color: 'bg-emerald-500', width: '100%' };
  };

  const handleSubmit = async () => {
    if (!canNext()) return;
    setSubmitting(true);
    setError('');

    try {
      const targets: { type: string; provinces: string[] }[] = [];
      if (selectedProvinces.length > 0) {
        targets.push({ type: 'province', provinces: selectedProvinces });
      }

      const res = await fetch('/api/portal/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contact_person: contactPerson,
          email,
          phone,
          password,
          branches: selectedBranches,
          kvk_nummer: kvkNummer || undefined,
          targets,
          ...(kvkAddress ? {
            street: kvkAddress.street,
            house_number: kvkAddress.house_number,
            postcode: kvkAddress.postcode,
            city: kvkAddress.city,
          } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Account aanmaken mislukt');
        return;
      }

      // De sessie zit in een httpOnly-cookie (door de register-route gezet); we
      // bewaren alleen het klantobject voor snelle UI-hydratie, geen token.
      localStorage.setItem(
        'warmeleads-portal-auth',
        JSON.stringify({ customer: data.customer, timestamp: Date.now() }),
      );
      router.push('/portal?welcome=true');
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  const strength = passwordStrength();
  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20';

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-navy">
          <div className="pointer-events-none absolute inset-0">
            <SoftGlow color="purple" className="-left-20 bottom-0" size="320px" intensity={0.22} />
            <SoftGlow color="pink" className="right-0 top-0" size="260px" intensity={0.14} />
          </div>
          <div className="relative z-10 mx-auto max-w-4xl px-5 py-12 text-center md:py-16 lg:px-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-4xl">
              Gratis account aanmaken
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-white/60 md:text-lg">
              Ontdek ons leadportaal en ontvang <span className="font-semibold text-brand-orange">20% welkomstkorting</span> op je eerste batch
            </p>
          </div>
        </section>

        {/* Step indicator */}
        <div className="mx-auto max-w-2xl px-5 py-6 md:py-8 lg:px-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-[background-color,border-color,box-shadow,color] duration-300 md:h-11 md:w-11 ${
                      step > s.num
                        ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                        : step === s.num
                          ? 'border-brand-purple bg-brand-purple text-white shadow-lg shadow-brand-purple/25'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {step > s.num ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <s.icon className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                  </div>
                  <span
                    className={`mt-1.5 hidden text-[10px] font-semibold min-[375px]:block md:text-[11px] ${
                      step >= s.num ? 'text-brand-purple' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-2 h-0.5 w-8 rounded-full transition-colors duration-300 md:mx-4 md:w-16 ${step > s.num ? 'bg-brand-purple' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-2xl px-5 pb-20 sm:pb-16 md:pb-24 lg:px-8">
          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
                {error}
                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canNext()) return;
              if (step < 4) { setStep(step + 1); setError(''); }
              else handleSubmit();
            }}
          >
            <AnimatePresence mode="wait">
              {/* Step 1: Bedrijfsgegevens */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
                    <h2 className="mb-1 text-lg font-bold text-slate-900 md:text-xl">Bedrijfsgegevens</h2>
                    <p className="mb-6 text-sm text-slate-500">Vertel ons over je bedrijf zodat we je account kunnen aanmaken.</p>

                    <div className="space-y-4">
                      {/* Bedrijfsnaam + KVK zoeken */}
                      <div ref={kvkRef} className="relative">
                        {kvkLinked ? (
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Bedrijfsnaam *</label>
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                                <p className="text-[11px] text-slate-500">KVK {kvkNummer}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <CheckCircleSolid className="h-5 w-5 text-emerald-500" />
                                <button
                                  type="button"
                                  onClick={unlinkKvk}
                                  className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-white hover:text-slate-600"
                                >
                                  Wijzig
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Bedrijfsnaam *</label>
                            <div className="relative">
                              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={kvkQuery || name}
                                onChange={(e) => handleKvkQueryChange(e.target.value)}
                                placeholder="Zoek op bedrijfsnaam of KVK-nummer..."
                                autoComplete="off"
                                className={`${inputClass} pl-9 pr-10`}
                              />
                              {kvkLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-purple" />
                                </div>
                              )}
                            </div>
                            {kvkOpen && !kvkLoading && (
                              <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                {kvkResults.length > 0 ? kvkResults.map((r) => (
                                  <button
                                    key={`${r.kvkNummer}-${r.vestigingsnummer}`}
                                    type="button"
                                    onClick={() => selectKvkResult(r)}
                                    className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-3.5 py-2.5 text-left transition last:border-0 hover:bg-slate-50"
                                  >
                                    <span className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-slate-800">{r.naam}</span>
                                      {r.type === 'hoofdvestiging' && (
                                        <span className="rounded-full bg-brand-purple/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-purple">Hoofdvestiging</span>
                                      )}
                                      {r.type === 'nevenvestiging' && (
                                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Nevenvestiging</span>
                                      )}
                                      {!r.actief && (
                                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-500">Uitgeschreven</span>
                                      )}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      KVK {r.kvkNummer}{r.plaats ? ` · ${r.plaats}` : ''}{r.straatnaam ? ` · ${r.straatnaam} ${r.huisnummer}` : ''}
                                    </span>
                                  </button>
                                )) : (
                                  <p className="px-3.5 py-2.5 text-xs text-slate-400">
                                    Geen bedrijven gevonden voor &ldquo;{kvkQuery || name}&rdquo;
                                  </p>
                                )}
                              </div>
                            )}
                            <p className="mt-1 text-[11px] text-slate-400">
                              Typ je bedrijfsnaam om automatisch KVK-gegevens op te halen, of vul handmatig in.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* KVK-nummer (handmatig, alleen zichtbaar als niet gekoppeld) */}
                      {!kvkLinked && (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-slate-600">KVK-nummer <span className="font-normal text-slate-400">(optioneel)</span></label>
                          <input type="text" value={kvkNummer} onChange={(e) => setKvkNummer(e.target.value)} placeholder="12345678" autoComplete="off" className={inputClass} />
                        </div>
                      )}

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Contactpersoon *</label>
                        <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Volledige naam" className={inputClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">E-mailadres *</label>
                        <div className="relative">
                          <input type="email" value={email} onChange={(e) => handleEmailChange(e.target.value)} placeholder="naam@bedrijf.nl" className={`${inputClass} pr-10`} />
                          {email && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {emailChecking ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-purple" />
                              ) : emailAvailable === true ? (
                                <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                              ) : emailAvailable === false ? (
                                <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                              ) : null}
                            </div>
                          )}
                        </div>
                        {emailAvailable === false && (
                          <p className="mt-1 text-xs text-red-500">Dit e-mailadres is al in gebruik. <Link href="/portal" className="font-medium text-brand-purple underline">Inloggen?</Link></p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Telefoonnummer *</label>
                        <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12345678" className={inputClass} />
                        {phone.length > 0 && !validatePhone(phone).valid && (
                          <p className="mt-1 text-xs text-red-500">Vul een geldig telefoonnummer in (NL of BE).</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Branche selectie */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
                    <h2 className="mb-1 text-lg font-bold text-slate-900 md:text-xl">In welke branche(s) ben je actief?</h2>
                    <p className="mb-6 text-sm text-slate-500">Selecteer een of meer branches. Je kunt dit later altijd aanpassen.</p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {branches.map((b) => {
                        const selected = selectedBranches.includes(b.slug);
                        const BranchIcon = BRANCH_ICONS[b.slug] || BoltIcon;
                        return (
                          <button
                            type="button"
                            key={b.slug}
                            onClick={() => toggleBranch(b.slug)}
                            className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-[background-color,border-color,box-shadow] ${
                              selected
                                ? 'border-brand-purple bg-brand-purple/5 shadow-sm shadow-brand-purple/10'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {selected && (
                              <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />
                            )}
                            <BranchIcon className={`mb-2 h-6 w-6 ${selected ? 'text-brand-purple' : 'text-slate-400'}`} />
                            <p className={`text-sm font-semibold ${selected ? 'text-brand-purple' : 'text-slate-700'}`}>
                              {b.name}
                            </p>
                            {b.description && (
                              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{b.description}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedBranches.length > 0 && (
                      <p className="mt-5 text-center text-xs font-medium text-brand-purple">
                        <CheckCircleIcon className="mr-1 inline h-3.5 w-3.5" />
                        {selectedBranches.length} {selectedBranches.length === 1 ? 'branche' : 'branches'} geselecteerd
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Doelgebieden */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
                    <h2 className="mb-1 text-lg font-bold text-slate-900 md:text-xl">Waar wil je leads ontvangen?</h2>
                    <p className="mb-6 text-sm text-slate-500">Kies je dekking. Je kunt dit later altijd aanpassen in je portaal.</p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => handleRegionType('nl')}
                        className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-[background-color,border-color,box-shadow] ${
                          regionType === 'nl'
                            ? 'border-brand-purple bg-brand-purple/5'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {regionType === 'nl' && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />}
                        <GlobeEuropeAfricaIcon className={`mb-2 h-6 w-6 ${regionType === 'nl' ? 'text-brand-purple' : 'text-slate-400'}`} />
                        <p className={`text-sm font-semibold ${regionType === 'nl' ? 'text-brand-purple' : 'text-slate-700'}`}>Heel Nederland</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Alle 12 provincies</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegionType('be')}
                        className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-[background-color,border-color,box-shadow] ${
                          regionType === 'be'
                            ? 'border-brand-purple bg-brand-purple/5'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {regionType === 'be' && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />}
                        <GlobeEuropeAfricaIcon className={`mb-2 h-6 w-6 ${regionType === 'be' ? 'text-brand-purple' : 'text-slate-400'}`} />
                        <p className={`text-sm font-semibold ${regionType === 'be' ? 'text-brand-purple' : 'text-slate-700'}`}>Heel Vlaanderen</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">5 Vlaamse provincies</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegionType('specific')}
                        className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-[background-color,border-color,box-shadow] ${
                          regionType === 'specific'
                            ? 'border-brand-purple bg-brand-purple/5'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        {regionType === 'specific' && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />}
                        <MapIcon className={`mb-2 h-6 w-6 ${regionType === 'specific' ? 'text-brand-purple' : 'text-slate-400'}`} />
                        <p className={`text-sm font-semibold ${regionType === 'specific' ? 'text-brand-purple' : 'text-slate-700'}`}>Specifieke regio&apos;s</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Kies provincies</p>
                      </button>
                    </div>

                    <div
                      className="grid transition-[grid-template-rows,opacity] duration-300"
                      style={{
                        gridTemplateRows: regionType === 'specific' ? '1fr' : '0fr',
                        opacity: regionType === 'specific' ? 1 : 0,
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Nederland</p>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {PROVINCE_OPTIONS_NL.map((opt) => {
                                  const selected = selectedProvinces.includes(opt.value);
                                  return (
                                    <button
                                      type="button"
                                      key={opt.value}
                                      onClick={() => toggleProvince(opt.value)}
                                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                                        selected
                                          ? 'border-brand-purple bg-brand-purple/5 font-semibold text-brand-purple'
                                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      {selected && <CheckCircleSolid className="mr-1.5 inline h-3.5 w-3.5 text-brand-purple" />}
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Vlaanderen</p>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {PROVINCE_OPTIONS_BE.map((opt) => {
                                  const selected = selectedProvinces.includes(opt.value);
                                  return (
                                    <button
                                      type="button"
                                      key={opt.value}
                                      onClick={() => toggleProvince(opt.value)}
                                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                                        selected
                                          ? 'border-brand-purple bg-brand-purple/5 font-semibold text-brand-purple'
                                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      {selected && <CheckCircleSolid className="mr-1.5 inline h-3.5 w-3.5 text-brand-purple" />}
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    {selectedProvinces.length > 0 && (
                      <p className="mt-5 text-center text-xs font-medium text-brand-purple">
                        <CheckCircleIcon className="mr-1 inline h-3.5 w-3.5" />
                        {selectedProvinces.length} {selectedProvinces.length === 1 ? 'provincie' : 'provincies'} geselecteerd
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Account aanmaken */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
                    <h2 className="mb-1 text-lg font-bold text-slate-900 md:text-xl">Maak je account aan</h2>
                    <p className="mb-6 text-sm text-slate-500">Kies een wachtwoord om je portaal te beveiligen.</p>

                    {/* Summary */}
                    <div className="mb-6 rounded-xl bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Samenvatting</p>
                      <div className="space-y-1.5 text-sm">
                        <p><span className="text-slate-400">Bedrijf:</span> <span className="font-medium text-slate-900">{name}</span></p>
                        {kvkNummer && (
                          <p><span className="text-slate-400">KVK:</span> <span className="font-medium text-slate-900">{kvkNummer}</span></p>
                        )}
                        <p><span className="text-slate-400">Contact:</span> <span className="font-medium text-slate-900">{contactPerson}</span></p>
                        <p><span className="text-slate-400">E-mail:</span> <span className="font-medium text-slate-900">{email}</span></p>
                        <p>
                          <span className="text-slate-400">Branches:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {selectedBranches.map((s) => branches.find((b) => b.slug === s)?.name || s).join(', ')}
                          </span>
                        </p>
                        <p><span className="text-slate-400">Regio:</span> <span className="font-medium text-slate-900">{selectedProvinces.length} provincies</span></p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Wachtwoord *</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimaal 8 tekens"
                            className={`${inputClass} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                          </button>
                        </div>
                        {password.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full ${strength.color} transition-[width,background-color] duration-300`} style={{ width: strength.width }} />
                              </div>
                              <span className="text-[11px] text-slate-500">{strength.label}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Bevestig wachtwoord *</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Herhaal wachtwoord"
                          className={inputClass}
                        />
                        {passwordConfirm && password !== passwordConfirm && (
                          <p className="mt-1 text-xs text-red-500">Wachtwoorden komen niet overeen</p>
                        )}
                      </div>
                    </div>

                    <label className="mt-5 flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30"
                      />
                      <span className="text-sm text-slate-600">
                        Ik ga akkoord met de{' '}
                        <Link href="/algemene-voorwaarden" target="_blank" className="font-medium text-brand-purple underline decoration-brand-purple/30 hover:text-brand-purple/80">
                          algemene voorwaarden
                        </Link>
                      </span>
                    </label>

                    {/* Incentive reminder */}
                    <div className="mt-5 rounded-xl border border-brand-purple/20 bg-gradient-to-r from-brand-purple/5 to-brand-pink/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10">
                          <SparklesIcon className="h-5 w-5 text-brand-purple" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">20% welkomstkorting</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Automatisch toegepast op je eerste bestelling. 14 dagen geldig na registratie.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => { setStep(step - 1); setError(''); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Vorige
                </button>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-slate-600"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Terug
                </Link>
              )}

              {step < 4 ? (
                <button
                  type="submit"
                  disabled={!canNext()}
                  className="group inline-flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                >
                  Volgende
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canNext() || submitting}
                  className="group inline-flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Account aanmaken...
                    </>
                  ) : (
                    <>
                      Account aanmaken
                      <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Already have an account */}
          <p className="mt-6 text-center text-sm text-slate-400">
            Al een account?{' '}
            <Link href="/portal" className="font-medium text-brand-purple hover:text-brand-purple/80">
              Inloggen
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
