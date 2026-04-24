'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SoftGlow } from '@/components/ui/SoftGlow';

const DAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MONTHS_NL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

const BRANCHES = [
  'Zonnepanelen', 'Warmtepompen', 'Thuisbatterijen', 'Airco',
  'Financial Lease', 'Isolatie', 'Laadpalen', 'Anders',
];

const STEPS = [
  { num: 1, label: 'Datum', icon: CalendarDaysIcon },
  { num: 2, label: 'Tijd', icon: ClockIcon },
  { num: 3, label: 'Gegevens', icon: UserIcon },
  { num: 4, label: 'Bevestigd', icon: CheckCircleIcon },
];

const DAY_INDEX_TO_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

export default function PlanGesprekPage() {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', branch: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [enabledDays, setEnabledDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    fetch('/api/bookings?info=true')
      .then(r => r.json())
      .then(d => { if (d.enabledDays) setEnabledDays(d.enabledDays); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSlots([]);
    fetch(`/api/bookings?date=${selectedDate.toISOString().split('T')[0]}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setStep(2);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate.toISOString().split('T')[0], time: selectedTime, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Er is iets misgegaan');
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er is iets misgegaan');
    } finally {
      setSubmitting(false);
    }
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };
  const canGoPrev = calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth > now.getMonth());

  const totalDays = daysInMonth(calYear, calMonth);
  const firstDay = firstWeekday(calYear, calMonth);

  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">

        <section className="relative overflow-hidden bg-brand-navy">
          <div className="pointer-events-none absolute inset-0">
            <SoftGlow color="purple" className="-left-20 bottom-0" size="320px" intensity={0.22} />
            <SoftGlow color="pink" className="right-0 top-0" size="260px" intensity={0.14} />
          </div>
          <div className="relative z-10 mx-auto max-w-4xl px-5 py-12 text-center md:py-16 lg:px-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-4xl">
              Plan je gratis strategiegesprek
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-white/60 md:text-lg">
              Kies een moment dat jou uitkomt. We bespreken vrijblijvend hoe we
              jouw leadgeneratie kunnen optimaliseren.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-2xl px-5 py-6 md:py-8 lg:px-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-[background-color,border-color,box-shadow,color] duration-300 md:h-11 md:w-11 ${
                    step > s.num
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                      : step === s.num
                        ? 'border-brand-purple bg-brand-purple text-white shadow-lg shadow-brand-purple/25'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}>
                    {step > s.num
                      ? <CheckCircleIcon className="h-5 w-5" />
                      : <s.icon className="h-4 w-4 md:h-5 md:w-5" />}
                  </div>
                  <span className={`mt-1.5 text-[10px] font-semibold md:text-[11px] ${step >= s.num ? 'text-brand-purple' : 'text-slate-400'}`}>
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

        <div className="mx-auto max-w-2xl px-5 pb-28 sm:pb-16 md:pb-24 lg:px-8">
          <AnimatePresence mode="wait">

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
                  <h2 className="mb-1 text-lg font-bold text-slate-900 md:text-xl">Kies een datum</h2>
                  <p className="mb-6 text-sm text-slate-500">Selecteer een dag die jou uitkomt.</p>

                  <div className="mb-4 flex items-center justify-between">
                    <button onClick={prevMonth} disabled={!canGoPrev} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-30">
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <h3 className="text-base font-semibold text-slate-900">{MONTHS_NL[calMonth]} {calYear}</h3>
                    <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50">
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-2 grid grid-cols-7 gap-1">
                    {DAYS_NL.map(d => (
                      <div key={d} className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: totalDays }).map((_, i) => {
                      const day = i + 1;
                      const date = new Date(calYear, calMonth, day);
                      const dayKey = DAY_INDEX_TO_KEY[date.getDay()];
                      const isDayDisabled = !enabledDays.includes(dayKey);
                      const isPast = date < today;
                      const disabled = isDayDisabled || isPast;
                      const selected = selectedDate && date.toDateString() === selectedDate.toDateString();
                      const isToday = date.toDateString() === now.toDateString();

                      return (
                        <button
                          key={day}
                          onClick={() => !disabled && handleDateSelect(date)}
                          disabled={disabled}
                          className={`relative flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-[background-color,color,box-shadow] md:h-11 ${
                            selected
                              ? 'bg-brand-purple text-white shadow-md shadow-brand-purple/25'
                              : disabled
                                ? 'cursor-not-allowed text-slate-200'
                                : 'text-slate-700 hover:bg-brand-purple/5 hover:text-brand-purple'
                          }`}
                        >
                          {day}
                          {isToday && !selected && (
                            <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-orange" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-4 text-center text-xs text-slate-400">
                    Liever telefonisch plannen? Bel <a href="tel:0850477067" className="font-medium text-brand-purple hover:underline">085 047 7067</a>
                  </p>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
                  <button onClick={() => setStep(1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-purple">
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Andere datum kiezen
                  </button>
                  <h2 className="mb-1 text-lg font-bold text-slate-900 md:text-xl">Kies een tijdstip</h2>
                  <p className="mb-6 text-sm text-slate-500">
                    Beschikbare tijden voor <span className="font-semibold capitalize text-slate-700">{formattedDate}</span>
                  </p>

                  {slotsLoading ? (
                    <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 py-12 text-center">
                      <ClockIcon className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      <p className="font-medium text-slate-600">Geen beschikbare tijden</p>
                      <p className="mt-1 text-sm text-slate-400">Kies een andere datum.</p>
                      <button onClick={() => setStep(1)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
                        <ArrowLeftIcon className="h-3.5 w-3.5" /> Terug naar kalender
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                      {slots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => handleTimeSelect(slot)}
                          className={`flex h-12 items-center justify-center rounded-lg border text-sm font-semibold transition-[background-color,border-color,color] ${
                            selectedTime === slot
                              ? 'border-brand-purple bg-brand-purple text-white shadow-md shadow-brand-purple/25'
                              : 'border-slate-200 text-slate-700 hover:border-brand-purple/30 hover:bg-brand-purple/5 hover:text-brand-purple'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
                  <button onClick={() => setStep(2)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-purple">
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Ander tijdstip kiezen
                  </button>

                  <div className="mb-6 flex items-center gap-3 rounded-xl bg-brand-purple/5 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10">
                      <CalendarDaysIcon className="h-5 w-5 text-brand-purple" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize text-slate-900">{formattedDate}</p>
                      <p className="text-sm font-medium text-brand-purple">{selectedTime} uur</p>
                    </div>
                  </div>

                  <h2 className="mb-1 text-lg font-bold text-slate-900 md:text-xl">Vul je gegevens in</h2>
                  <p className="mb-6 text-sm text-slate-500">Zodat we ons gesprek goed kunnen voorbereiden.</p>

                  {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Naam *</label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jan de Vries" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Bedrijfsnaam</label>
                        <div className="relative">
                          <BuildingOfficeIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input type="text" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="SolarTech BV" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20" />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">E-mailadres *</label>
                        <div className="relative">
                          <EnvelopeIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jan@solartech.nl" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Telefoonnummer *</label>
                        <div className="relative">
                          <PhoneIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input type="tel" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="06 12345678" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">Branche / niche</label>
                      <select value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20">
                        <option value="">Selecteer een branche (optioneel)</option>
                        {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">Toelichting</label>
                      <div className="relative">
                        <ChatBubbleBottomCenterTextIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="Vertel kort waar je naar op zoek bent (optioneel)" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !form.name || !form.email || !form.phone}
                      className="group flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110 disabled:opacity-60"
                    >
                      {submitting ? (
                        <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Wordt ingepland...</>
                      ) : (
                        <>Bevestig afspraak <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" /></>
                      )}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm md:p-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 md:text-2xl">Afspraak bevestigd!</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Je strategiegesprek is ingepland. We hebben een bevestiging gestuurd naar{' '}
                    <span className="font-medium text-slate-700">{form.email}</span>.
                  </p>

                  <div className="mx-auto mt-6 max-w-sm rounded-xl bg-slate-50 p-5 text-left">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                      <CalendarDaysIcon className="h-5 w-5 shrink-0 text-brand-purple" />
                      <div>
                        <p className="text-xs text-slate-500">Datum &amp; tijd</p>
                        <p className="text-sm font-semibold capitalize text-slate-900">{formattedDate}</p>
                        <p className="text-sm font-medium text-brand-purple">{selectedTime} uur</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <UserIcon className="h-5 w-5 shrink-0 text-brand-purple" />
                      <div>
                        <p className="text-xs text-slate-500">Contactgegevens</p>
                        <p className="text-sm font-semibold text-slate-900">{form.name}</p>
                        {form.company && <p className="text-xs text-slate-500">{form.company}</p>}
                      </div>
                    </div>
                  </div>

                  <p className="mt-6 text-xs text-slate-400">
                    We nemen op het afgesproken moment telefonisch contact met je op.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                      Terug naar home
                    </Link>
                    <Link href="/hoe-het-werkt" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                      Ontdek hoe het werkt <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </>
  );
}
