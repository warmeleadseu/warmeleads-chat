'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

interface Branch {
  slug: string;
  name: string;
  color: string;
  description: string;
}

const NL_PROVINCES = [
  'Groningen', 'Friesland', 'Drenthe', 'Overijssel', 'Flevoland',
  'Gelderland', 'Utrecht', 'Noord-Holland', 'Zuid-Holland', 'Zeeland',
  'Noord-Brabant', 'Limburg',
];

const BE_PROVINCES = [
  'Antwerpen', 'Limburg (BE)', 'Oost-Vlaanderen', 'Vlaams-Brabant', 'West-Vlaanderen',
];

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
    if (type === 'nl') setSelectedProvinces([...NL_PROVINCES]);
    else if (type === 'be') setSelectedProvinces([...BE_PROVINCES]);
    else setSelectedProvinces([]);
  };

  const canNext = (): boolean => {
    if (step === 1) return !!name && !!contactPerson && !!email && !!phone && emailAvailable !== false;
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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Account aanmaken mislukt');
        return;
      }

      localStorage.setItem(
        'warmeleads-portal-auth',
        JSON.stringify({ customer: data.customer, token: data.token, timestamp: Date.now() }),
      );
      router.push('/portal?welcome=true');
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  const strength = passwordStrength();

  return (
    <>
      <Header />
      <main className="min-h-screen bg-brand-navy">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-brand-purple/15 blur-[150px]" />
          <div className="absolute -right-40 bottom-1/4 h-[400px] w-[400px] rounded-full bg-brand-pink/10 blur-[120px]" />
          <div className="absolute left-1/3 top-0 h-[300px] w-[300px] rounded-full bg-brand-orange/8 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
          {/* Logo + title */}
          <div className="mb-8 text-center">
            <Link href="/">
              <Image src="/logo-wit.png" alt="WarmeLeads" width={160} height={48} className="mx-auto h-9 w-auto" />
            </Link>
            <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Gratis account aanmaken</h1>
            <p className="mt-2 text-sm text-white/50">
              Ontdek ons leadportaal en ontvang <span className="font-semibold text-brand-orange">20% welkomstkorting</span> op je eerste batch
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((s, i) => {
                const isActive = step === s.num;
                const isDone = step > s.num;
                return (
                  <div key={s.num} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                          isDone
                            ? 'border-emerald-500 bg-emerald-500'
                            : isActive
                            ? 'border-brand-orange bg-brand-orange/20'
                            : 'border-white/15 bg-white/5'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircleSolid className="h-5 w-5 text-white" />
                        ) : (
                          <s.icon className={`h-5 w-5 ${isActive ? 'text-brand-orange' : 'text-white/30'}`} />
                        )}
                      </div>
                      <span
                        className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                          isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-white/25'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="mx-2 h-px flex-1 bg-white/10">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-500"
                          style={{ width: isDone ? '100%' : '0%' }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-purple via-brand-pink to-brand-orange"
                animate={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                <ExclamationCircleIcon className="h-5 w-5 shrink-0" />
                {error}
                <button onClick={() => setError('')} className="ml-auto">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
            <AnimatePresence mode="wait">
              {/* ── Step 1: Bedrijfsgegevens ── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white">Bedrijfsgegevens</h2>
                    <p className="mt-1 text-sm text-white/40">Vertel ons over je bedrijf zodat we je account kunnen aanmaken.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/50">Bedrijfsnaam *</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Bijv. Zonnekracht BV"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/50">Contactpersoon *</label>
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Volledige naam"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/50">E-mailadres *</label>
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="uw@bedrijf.nl"
                          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 pr-10 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                        />
                        {email && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {emailChecking ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-brand-purple" />
                            ) : emailAvailable === true ? (
                              <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                            ) : emailAvailable === false ? (
                              <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                            ) : null}
                          </div>
                        )}
                      </div>
                      {emailAvailable === false && (
                        <p className="mt-1 text-xs text-red-400">Dit e-mailadres is al in gebruik. <Link href="/portal" className="underline">Inloggen?</Link></p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/50">Telefoonnummer *</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="06 12345678"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/50">KVK-nummer <span className="text-white/25">(optioneel)</span></label>
                      <input
                        type="text"
                        value={kvkNummer}
                        onChange={(e) => setKvkNummer(e.target.value)}
                        placeholder="12345678"
                        autoComplete="off"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Branche selectie ── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white">In welke branche(s) ben je actief?</h2>
                    <p className="mt-1 text-sm text-white/40">Selecteer één of meer branches. Je kunt dit later altijd aanpassen.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {branches.map((b) => {
                      const selected = selectedBranches.includes(b.slug);
                      return (
                        <button
                          key={b.slug}
                          onClick={() => toggleBranch(b.slug)}
                          className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                            selected
                              ? 'border-brand-purple bg-brand-purple/10 shadow-lg shadow-brand-purple/10'
                              : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                          }`}
                        >
                          {selected && (
                            <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-purple" />
                          )}
                          <div
                            className="mb-2 h-2 w-8 rounded-full"
                            style={{ backgroundColor: b.color || '#6366f1' }}
                          />
                          <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-white/70'}`}>
                            {b.name}
                          </p>
                          {b.description && (
                            <p className="mt-0.5 text-[11px] leading-snug text-white/30">{b.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedBranches.length > 0 && (
                    <p className="text-center text-xs text-emerald-400">
                      <CheckCircleIcon className="mr-1 inline h-3.5 w-3.5" />
                      {selectedBranches.length} {selectedBranches.length === 1 ? 'branche' : 'branches'} geselecteerd
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Step 3: Doelgebieden ── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white">Waar wil je leads ontvangen?</h2>
                    <p className="mt-1 text-sm text-white/40">Kies je dekking. Je kunt dit later altijd aanpassen in je portaal.</p>
                  </div>

                  {/* Quick selection cards */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      onClick={() => handleRegionType('nl')}
                      className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                        regionType === 'nl'
                          ? 'border-brand-orange bg-brand-orange/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      {regionType === 'nl' && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-orange" />}
                      <GlobeEuropeAfricaIcon className={`mb-2 h-6 w-6 ${regionType === 'nl' ? 'text-brand-orange' : 'text-white/40'}`} />
                      <p className={`text-sm font-semibold ${regionType === 'nl' ? 'text-white' : 'text-white/70'}`}>Heel Nederland</p>
                      <p className="mt-0.5 text-[11px] text-white/30">Alle 12 provincies</p>
                    </button>
                    <button
                      onClick={() => handleRegionType('be')}
                      className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                        regionType === 'be'
                          ? 'border-brand-orange bg-brand-orange/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      {regionType === 'be' && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-orange" />}
                      <GlobeEuropeAfricaIcon className={`mb-2 h-6 w-6 ${regionType === 'be' ? 'text-brand-orange' : 'text-white/40'}`} />
                      <p className={`text-sm font-semibold ${regionType === 'be' ? 'text-white' : 'text-white/70'}`}>Heel Vlaanderen</p>
                      <p className="mt-0.5 text-[11px] text-white/30">5 Vlaamse provincies</p>
                    </button>
                    <button
                      onClick={() => handleRegionType('specific')}
                      className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                        regionType === 'specific'
                          ? 'border-brand-orange bg-brand-orange/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      {regionType === 'specific' && <CheckCircleSolid className="absolute right-2 top-2 h-5 w-5 text-brand-orange" />}
                      <MapIcon className={`mb-2 h-6 w-6 ${regionType === 'specific' ? 'text-brand-orange' : 'text-white/40'}`} />
                      <p className={`text-sm font-semibold ${regionType === 'specific' ? 'text-white' : 'text-white/70'}`}>Specifieke regio&apos;s</p>
                      <p className="mt-0.5 text-[11px] text-white/30">Kies provincies</p>
                    </button>
                  </div>

                  {/* Province grid (for specific selection) */}
                  <AnimatePresence>
                    {regionType === 'specific' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 pt-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Nederland</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {NL_PROVINCES.map((p) => {
                                const selected = selectedProvinces.includes(p);
                                return (
                                  <button
                                    key={p}
                                    onClick={() => toggleProvince(p)}
                                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                                      selected
                                        ? 'border-brand-purple bg-brand-purple/15 font-semibold text-white'
                                        : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20'
                                    }`}
                                  >
                                    {selected && <CheckCircleSolid className="mr-1.5 inline h-3.5 w-3.5 text-brand-purple" />}
                                    {p}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Vlaanderen</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {BE_PROVINCES.map((p) => {
                                const selected = selectedProvinces.includes(p);
                                return (
                                  <button
                                    key={p}
                                    onClick={() => toggleProvince(p)}
                                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                                      selected
                                        ? 'border-brand-purple bg-brand-purple/15 font-semibold text-white'
                                        : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20'
                                    }`}
                                  >
                                    {selected && <CheckCircleSolid className="mr-1.5 inline h-3.5 w-3.5 text-brand-purple" />}
                                    {p}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {selectedProvinces.length > 0 && (
                    <p className="text-center text-xs text-emerald-400">
                      <CheckCircleIcon className="mr-1 inline h-3.5 w-3.5" />
                      {selectedProvinces.length} {selectedProvinces.length === 1 ? 'provincie' : 'provincies'} geselecteerd
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── Step 4: Account aanmaken ── */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-lg font-bold text-white">Maak je account aan</h2>
                    <p className="mt-1 text-sm text-white/40">Kies een wachtwoord om je portaal te beveiligen.</p>
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">Samenvatting</p>
                    <div className="space-y-1.5 text-sm text-white/60">
                      <p><span className="text-white/30">Bedrijf:</span> <span className="text-white">{name}</span></p>
                      <p><span className="text-white/30">Contact:</span> <span className="text-white">{contactPerson}</span></p>
                      <p><span className="text-white/30">E-mail:</span> <span className="text-white">{email}</span></p>
                      <p>
                        <span className="text-white/30">Branches:</span>{' '}
                        <span className="text-white">
                          {selectedBranches.map((s) => branches.find((b) => b.slug === s)?.name || s).join(', ')}
                        </span>
                      </p>
                      <p><span className="text-white/30">Regio:</span> <span className="text-white">{selectedProvinces.length} provincies</span></p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/50">Wachtwoord *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimaal 8 tekens"
                          className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 pr-10 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                          {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                        </button>
                      </div>
                      {password.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                              <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                            </div>
                            <span className="text-[11px] text-white/40">{strength.label}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/50">Bevestig wachtwoord *</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="Herhaal wachtwoord"
                        className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
                      />
                      {passwordConfirm && password !== passwordConfirm && (
                        <p className="mt-1 text-xs text-red-400">Wachtwoorden komen niet overeen</p>
                      )}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-brand-purple focus:ring-brand-purple/30"
                    />
                    <span className="text-sm text-white/50">
                      Ik ga akkoord met de{' '}
                      <Link href="/voorwaarden" target="_blank" className="text-brand-purple underline decoration-brand-purple/30 hover:text-brand-purple/80">
                        algemene voorwaarden
                      </Link>
                    </span>
                  </label>

                  {/* Incentive reminder */}
                  <div className="rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange/20">
                        <span className="text-lg">🎉</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">20% welkomstkorting</p>
                        <p className="mt-0.5 text-xs text-white/50">
                          Automatisch toegepast op je eerste bestelling. 14 dagen geldig na registratie.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  onClick={() => { setStep(step - 1); setError(''); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.08]"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Vorige
                </button>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-sm text-white/30 transition hover:text-white/50"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Terug
                </Link>
              )}

              {step < 4 ? (
                <button
                  onClick={() => { if (canNext()) { setStep(step + 1); setError(''); } }}
                  disabled={!canNext()}
                  className="group inline-flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 disabled:opacity-40 disabled:shadow-none"
                >
                  Volgende
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canNext() || submitting}
                  className="group inline-flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 disabled:opacity-40 disabled:shadow-none"
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
          </div>

          {/* Already have an account */}
          <p className="mt-6 text-center text-sm text-white/30">
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
