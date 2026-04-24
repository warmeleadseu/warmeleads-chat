'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  ClockIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  DevicePhoneMobileIcon,
  BellAlertIcon,
  EnvelopeIcon,
  UserIcon,
  MapPinIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { IPhoneMockup } from '@/components/IPhoneMockup';
import { SoftGlow } from '@/components/ui/SoftGlow';
import { FadeOnView } from '@/components/ui/FadeOnView';
import { useInViewport } from '@/hooks/useInViewport';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

function HeroPhone() {
  const { ref, isInView } = useInViewport<HTMLDivElement>({ rootMargin: '300px 0px' });
  return (
    <div ref={ref} style={{ perspective: '1200px' }}>
      <div
        className="animate-phone-float"
        style={{
          transform: 'rotateY(-8deg) rotateX(3deg)',
          animationPlayState: isInView ? 'running' : 'paused',
        }}
      >
        <IPhoneMockup />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen overflow-x-hidden bg-white text-slate-900">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-install.jpg"
            alt="Salesteam in overleg over leadstrategie"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-brand-navy/90 md:bg-transparent">
          <div className="hidden h-full w-full md:block" style={{
            background: 'linear-gradient(105deg, #1A1A2E 0%, #1A1A2E 45%, rgba(26,26,46,0.92) 58%, rgba(26,26,46,0.75) 72%, rgba(26,26,46,0.6) 85%, rgba(26,26,46,0.5) 100%)',
          }} />
        </div>

        <div className="pointer-events-none absolute inset-0">
          <SoftGlow color="purple" className="-left-20 bottom-0" size="420px" intensity={0.22} />
          <SoftGlow color="orange" className="-right-20 top-1/4 hidden lg:block" size="380px" intensity={0.14} showOnMobile />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-14 pt-12 md:pb-20 md:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
            >
              <motion.p
                variants={fadeUp}
                custom={0}
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 md:mb-5 md:px-4 md:text-[12px]"
              >
                <SparklesIcon className="h-3.5 w-3.5 text-brand-orange" />
                Exclusieve leadgeneratie
              </motion.p>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.5rem] md:text-[3.25rem] lg:text-[3.75rem]"
              >
                Meer kwalitatieve leads.{' '}
                <span className="gradient-text">Minder verspilde salesuren.</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70 md:mt-6 md:text-lg"
              >
WarmeLeads genereert exclusieve, verse leads voor jouw bedrijf.
              Realtime in jouw portaal, automatisch gekwalificeerd,
              met een persoonlijke accountmanager die met je meedenkt.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
                <Link
                  href="/plan-gesprek"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
                >
                  Plan gratis strategiegesprek
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/gratis-account"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                >
                  Bekijk gratis ons leadportaal
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUp}
                custom={4}
                className="mt-8 grid grid-cols-3 gap-3 md:mt-10 md:gap-4 lg:max-w-lg"
              >
                {[
                  { value: '100%', label: 'Exclusieve leads', icon: ShieldCheckIcon },
                  { value: '<24u', label: 'Eerste levering', icon: ClockIcon },
                  { value: '4.8★', label: 'Klantwaardering', icon: ChartBarIcon },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 rounded-xl bg-white/[0.09] px-3 py-2.5 md:gap-3 md:px-4 md:py-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 md:h-9 md:w-9">
                      <item.icon className="h-4 w-4 text-brand-orange" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-white md:text-lg">{item.value}</p>
                      <p className="text-[10px] text-white/60 md:text-[11px]">{item.label}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40, rotateY: -5 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
              className="hidden lg:block"
            >
              <HeroPhone />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex justify-center lg:hidden"
          >
            <IPhoneMockup />
          </motion.div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-center md:gap-0">
            {[
              { label: '750+ batches geleverd', first: true },
              { label: 'NL & BE dekking' },
              { label: 'Actief in 25+ niches' },
              { label: 'Geen lock-in', last: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 md:rounded-none md:bg-transparent md:px-5 md:py-0">
                <CheckBadgeIcon className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
                <span className="text-[12px] font-semibold text-slate-500 md:text-[13px]">{item.label}</span>
                {!item.last && <div className="ml-3 hidden h-4 w-px bg-slate-200 md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value blocks ── */}
      <section className="bg-gradient-to-b from-white to-orange-50/40">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
              Waarom WarmeLeads
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Gebouwd voor performance.<br />
              <span className="text-slate-500">En voor volume.</span>
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500 md:mt-4 md:text-[16px]">
              We combineren slimme targeting, automatische kwaliteitscontroles en transparante
              data zodat jouw salesteam alleen tijd besteedt aan leads die ertoe doen.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              {
                title: 'Exclusieve aanvragen',
                description: 'Geen doorverkoop of bulk lijsten. Elke lead is van jou, in de afgesproken regio en niche. Op het moment dat jij een batch afneemt, starten wij de campagnes afgestemd op jouw targetgebied.',
                icon: ShieldCheckIcon,
                accent: 'bg-brand-purple',
              },
              {
                title: 'Automatisch gekwalificeerd',
                description: 'Elke lead doorloopt automatisch meerdere quality checks voordat deze in jouw portaal verschijnt. Alleen leads die aan jouw eisen voldoen, worden doorgestuurd.',
                icon: BoltIcon,
                accent: 'bg-brand-pink',
              },
              {
                title: 'Schaalbaar lead volume',
                description: 'Start gecontroleerd in één regio, bewijs rendement, en schaal uit naar meerdere gebieden. Van 10 tot 500+ leads per week. Wij schalen mee.',
                icon: ArrowTrendingUpIcon,
                accent: 'bg-brand-orange',
              },
            ].map((item) => (
              <FadeOnView
                key={item.title}
                as="article"
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg md:p-7"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg md:mb-5 md:h-11 md:w-11 ${item.accent}`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:mt-2 md:text-sm">{item.description}</p>
                <div className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
              </FadeOnView>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal Showcase ── */}
      <section className="relative overflow-hidden border-y border-slate-100 bg-slate-50">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-brand-purple/[0.03] to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
            <FadeOnView>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
                Jouw eigen klantportaal
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl">
                Alle leads direct in je<br />
                <span className="text-slate-500">eigen portaal.</span>
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600 md:mt-4 md:text-[15px]">
                Zodra een lead door alle quality checks komt, verschijnt deze realtime in jouw
                persoonlijke portaal. Een moderne webapp die je ook als app op je telefoon kunt
                installeren, zodat je altijd en overal je leads kunt opvolgen.
              </p>

              <div className="mt-6 space-y-3 md:mt-8">
                {[
                  { icon: BoltIcon, title: 'Realtime levering', desc: 'Leads verschijnen direct in je portaal op het moment dat ze binnenkomen.' },
                  { icon: BellAlertIcon, title: 'Pushnotificaties & e-mail', desc: 'Ontvang een melding op je telefoon of per e-mail bij elke nieuwe lead.' },
                  { icon: DevicePhoneMobileIcon, title: 'Installeerbaar als app', desc: 'Installeer het portaal als app op je telefoon. Geen download nodig.' },
                  { icon: PhoneIcon, title: 'Direct bellen of appen', desc: 'Bel, WhatsApp of mail je leads met één klik vanuit het portaal.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white p-3 shadow-sm md:p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10">
                      <item.icon className="h-4 w-4 text-brand-purple" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500 md:text-[13px]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 md:mt-8">
                <Link
                  href="/gratis-account"
                  className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-purple/20 transition hover:shadow-brand-purple/30 hover:brightness-110"
                >
                  Maak gratis een account aan
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </FadeOnView>

            <FadeOnView className="flex justify-center" delay={100}>
              <IPhoneMockup />
            </FadeOnView>
          </div>
        </div>
      </section>

      {/* ── Process (4 steps) ── */}
      <section id="proces" className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">
              Hoe het werkt
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Van intake naar voorspelbare leadstroom.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-white/50 md:mt-4 md:text-[16px]">
              Vier stappen. Geen verrassingen. Vanaf dag één transparant over
              volume, kosten en kwaliteit.
            </p>
          </div>

          <div className="relative grid gap-4 md:grid-cols-4 md:gap-0">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 hidden -translate-y-1/2 md:block">
              <div className="mx-auto h-px w-[calc(100%-120px)] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {[
              { step: '01', title: 'Strategiegesprek', description: 'We bepalen samen doelgroep, regio, volume en gewenste kostprijs per lead. Je krijgt een helder plan met concrete verwachtingen.' },
              { step: '02', title: 'Campagne op maat', description: 'We bouwen campagnes die we vooraf grondig testen, afgestemd op jouw targetgebied en propositie. Klaar binnen 24–72 uur.' },
              { step: '03', title: 'Automatische quality checks', description: 'Elke lead doorloopt automatisch meerdere kwaliteitscontroles. Contactgegevens, interesse en geschiktheid worden geverifieerd.' },
              { step: '04', title: 'Realtime in jouw portaal', description: 'Leads die aan al jouw eisen voldoen worden direct in je portaal geplaatst. Bel, app of mail ze met één klik.' },
            ].map((item, i) => (
              <FadeOnView
                key={item.step}
                as="article"
                delay={i * 80}
                className="group relative z-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:bg-white/[0.08] md:mx-1.5 md:p-6"
              >
                <p className="absolute -right-2 -top-4 text-[60px] font-black leading-none text-white/[0.04] select-none md:text-[70px]">{item.step}</p>
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-3 md:mb-5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange text-[13px] font-bold text-slate-950">{item.step}</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <h3 className="text-[16px] font-bold md:text-lg">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 md:mt-2 md:text-sm">{item.description}</p>
                </div>
              </FadeOnView>
            ))}
          </div>

          <div className="mt-8 text-center md:mt-12">
            <Link
              href="/hoe-het-werkt"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-orange transition hover:text-white md:text-sm"
            >
              Bekijk het volledige proces
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Results strip ── */}
      <section className="bg-brand-purple">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
          {[
            { value: '500+', label: 'Leads per maand' },
            { value: '40+', label: 'Actieve klanten' },
            { value: '<24u', label: 'Eerste levering' },
            { value: '4.8★', label: 'Klantwaardering' },
          ].map((item, i) => (
            <FadeOnView
              key={item.label}
              delay={i * 50}
              className="bg-brand-purple px-5 py-6 text-center md:py-8"
            >
              <p className="text-2xl font-extrabold text-white md:text-3xl">{item.value}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/60 md:text-[12px]">{item.label}</p>
            </FadeOnView>
          ))}
        </div>
      </section>

      {/* ── Personal approach ── */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
            <FadeOnView className="order-2 md:order-1">
              <div className="relative overflow-hidden rounded-2xl">
                <Image
                  src="/images/team-meeting.jpg"
                  alt="Persoonlijk strategiegesprek met accountmanager"
                  width={600}
                  height={400}
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="h-auto w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-navy/20 to-transparent" />
              </div>
            </FadeOnView>

            <FadeOnView className="order-1 md:order-2">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
                Persoonlijke aanpak
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl lg:text-4xl">
                Geen callcenter.<br />
                <span className="text-slate-500">Een persoonlijke accountmanager.</span>
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600 md:mt-4 md:text-[15px]">
                Bij WarmeLeads geloven we in échte samenwerking. Daarom krijg je een vaste
                accountmanager die jouw business begrijpt, meedenkt over strategie en altijd
                bereikbaar is. Telefonisch, per mail én persoonlijk op locatie.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  { icon: UserIcon, text: 'Vaste accountmanager die jouw business kent' },
                  { icon: MapPinIcon, text: 'Persoonlijke bezoeken op jouw locatie' },
                  { icon: PhoneIcon, text: 'Altijd bereikbaar voor vragen en advies' },
                  { icon: ChartBarIcon, text: 'Proactief meedenken over groei en optimalisatie' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pink/10">
                      <item.icon className="h-4 w-4 text-brand-pink" />
                    </div>
                    <p className="text-[13px] font-medium text-slate-700 md:text-sm">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 md:mt-8">
                <Link
                  href="/plan-gesprek"
                  className="group inline-flex items-center gap-2 text-[13px] font-semibold text-brand-pink transition hover:text-brand-purple md:text-sm"
                >
                  Maak kennis met ons team
                  <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </FadeOnView>
          </div>
        </div>
      </section>

      {/* ── Testimonial / Social proof ── */}
      <section className="relative overflow-hidden border-y border-slate-100 bg-slate-50 [content-visibility:auto] [contain-intrinsic-size:700px]">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-orange-50/60 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_1.2fr] md:gap-16">
            <FadeOnView>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
                Wat klanten zeggen
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Resultaten spreken<br />
                <span className="text-slate-500">voor zich.</span>
              </h2>

              <div className="mt-6 flex items-center gap-6 md:mt-8">
                <div>
                  <p className="text-3xl font-extrabold text-brand-navy md:text-4xl">4.8</p>
                  <div className="mt-1 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <StarIconSolid key={i} className="h-4 w-4 text-brand-orange" />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">Gemiddelde score</p>
                </div>
                <div className="h-12 w-px bg-slate-200" />
                <div>
                  <p className="text-3xl font-extrabold text-brand-navy md:text-4xl">92%</p>
                  <p className="mt-1 text-[11px] text-slate-400">Klantretentie na 6 maanden</p>
                </div>
              </div>
            </FadeOnView>

            <FadeOnView className="space-y-4" delay={100}>
              {[
                {
                  quote: 'Binnen 3 weken hadden we een stabiele instroom van 15+ leads per week. De kwaliteit is consistent en ons salesteam kan eindelijk plannen.',
                  name: 'Dennis V.',
                  role: 'Directeur, SolarInstall BV',
                },
                {
                  quote: 'Eindelijk een partij die snapt dat het niet om aantallen gaat maar om conversie. Onze CPL is met 30% gedaald terwijl het volume steeg.',
                  name: 'Marieke T.',
                  role: 'Sales Manager, KlimaatComfort',
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
                >
                  <div className="mb-3 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <StarIconSolid key={i} className="h-3.5 w-3.5 text-brand-orange" />
                    ))}
                  </div>
                  <p className="text-[13px] leading-relaxed text-slate-700 md:text-sm">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                      {item.name.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </FadeOnView>
          </div>
        </div>
      </section>

      {/* ── Verticals + New branches ── */}
      <section className="bg-gradient-to-b from-white to-slate-50 [content-visibility:auto] [contain-intrinsic-size:1000px]">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <FadeOnView className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
                Onze markten
              </p>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                Gespecialiseerd in verduurzaming
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 md:mt-3 md:text-sm">
                We zijn gespecialiseerd in leadgeneratie voor de verduurzamingsbranche, maar
                genereren leads in vrijwel elke branche.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 md:mt-6 md:grid-cols-3">
                {[
                  { label: 'Zonnepanelen', href: '/leads-zonnepanelen' },
                  { label: 'Warmtepompen', href: '/leads-warmtepompen' },
                  { label: 'Thuisbatterijen', href: '/leads-thuisbatterijen' },
                  { label: 'Financial Lease', href: '/leads-financial-lease' },
                  { label: 'Airco', href: '/leads-airco' },
                  { label: 'Isolatie', href: '/maatwerk-leads' },
                  { label: 'Laadpalen', href: '/maatwerk-leads' },
                  { label: 'B2B Energie', href: '/maatwerk-leads' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-center text-[12px] font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:bg-brand-purple/5 hover:text-brand-purple md:px-3 md:py-2.5 md:text-[13px]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </FadeOnView>

            <FadeOnView className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
                Nieuwe branche?
              </p>
              <h3 className="text-xl font-bold tracking-tight md:text-2xl">
                Wij onderzoeken het voor je
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 md:mt-3 md:text-sm">
                Werkt u in een branche waarin we nog niet eerder leads hebben gegenereerd?
                Geen probleem. We investeren eerst in onderzoek om de beste strategie
                en tarieven te bepalen.
              </p>

              <div className="mt-5 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-4 md:mt-6 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange">
                    <BeakerIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-900 md:text-[15px]">Onderzoekskosten: €750</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600 md:text-[13px]">
                      Dit bedrag investeren we in marktonderzoek, campagne-testen en strategie-ontwikkeling
                      voor jouw branche. Je krijgt dit bedrag volledig terug in leads, dus het kost je
                      uiteindelijk niets extra.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 md:mt-6 md:gap-3">
                {[
                  { value: '€750', label: 'Onderzoek', bg: 'bg-brand-navy' },
                  { value: '100%', label: 'Terug in leads', bg: 'bg-brand-purple' },
                  { value: '2-4 wk', label: 'Onderzoekstijd', bg: 'bg-brand-orange' },
                ].map((item) => (
                  <div key={item.label} className={`${item.bg} rounded-lg p-3 text-center text-white md:p-4`}>
                    <p className="text-xl font-bold md:text-2xl">{item.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/80 md:mt-1 md:text-[11px]">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto pt-5 md:pt-6">
                <Link
                  href="/plan-gesprek"
                  className="group flex items-center gap-2 text-[13px] font-semibold text-brand-pink transition hover:text-brand-purple md:text-sm"
                >
                  Bespreek jouw branche
                  <ArrowRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
            </FadeOnView>
          </div>
        </div>
      </section>

      {/* ── Photo break ── */}
      <section className="relative h-[240px] overflow-hidden md:h-[360px]">
        <Image
          src="/images/hero-sales-alt.jpg"
          alt="Team werkt aan groeistrategie"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-brand-navy/75" />
        <div className="relative z-10 flex h-full items-center justify-center px-5">
          <FadeOnView className="text-center">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:text-[12px]">
              Voor groeiende teams
            </p>
            <h2 className="text-2xl font-bold text-white md:text-4xl">
              Wij leveren de leads. Jij sluit de deals.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-white/70 md:text-[16px]">
              Van installatiebedrijven tot energiepartners. Wij zorgen voor een
              voorspelbare instroom door heel Nederland en België.
            </p>
          </FadeOnView>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative overflow-hidden bg-brand-navy [content-visibility:auto] [contain-intrinsic-size:800px]">
        <div className="pointer-events-none absolute inset-0">
          <SoftGlow color="purple" className="-left-40 top-1/4" size="420px" intensity={0.18} />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">
              FAQ
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Veelgestelde vragen
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/50 md:text-[15px]">
              Alles wat je wilt weten voordat je begint.
            </p>
          </div>

          <div className="space-y-2.5 md:space-y-3">
            {[
              { q: 'Zijn de leads exclusief of gedeeld?', a: 'Primair werken we met exclusieve leads. Elke aanvraag is enkel voor jou, in jouw regio. Zodra je een batch afneemt starten wij campagnes specifiek voor jouw targetgebied. Indien gewenst bespreken we een gedeeld model voor schaal en kostprijs.' },
              { q: 'Hoe snel kunnen we live?', a: 'In de meeste gevallen binnen 24 tot 72 uur na intake, afhankelijk van niche en regio. We starten zodra de campagnes staan. Geen wekenlange aanlooptijd.' },
              { q: 'Hoe werkt het klantportaal?', a: 'Je krijgt toegang tot een modern portaal op warmeleads.eu/portal. Hier zie je al je leads realtime binnenkomen met alle details. Je kunt leads direct bellen, WhatsAppen of mailen. Het portaal is installeerbaar als app op je telefoon, inclusief pushnotificaties bij elke nieuwe lead.' },
              { q: 'Hoe worden leads gekwalificeerd?', a: 'Elke lead doorloopt automatisch meerdere quality checks aan onze achterkant. Contactgegevens worden geverifieerd, interesse en geschiktheid worden gecontroleerd. Alleen leads die aan al jouw specifieke eisen voldoen komen in je portaal terecht.' },
              { q: 'Krijg ik een vast aanspreekpunt?', a: 'Ja. Elke klant krijgt een persoonlijke accountmanager die jouw business kent, meedenkt over strategie en altijd bereikbaar is. Niet alleen telefonisch, onze accountmanagers komen ook bij je langs op locatie.' },
              { q: 'Wat als jullie nog niet in mijn branche actief zijn?', a: 'Geen probleem. Voor €750 onderzoekskosten ontdekken we de beste strategie en tarieven voor jouw branche. Dit bedrag krijg je volledig terug in leads, dus het kost je uiteindelijk niets extra.' },
              { q: 'Kunnen jullie koppelen met ons CRM?', a: 'Ja. We ondersteunen directe koppelingen via webhooks, API of handmatige exports zodat je salesflow direct doorloopt zonder extra administratie.' },
              { q: 'Wat is een realistisch startvolume?', a: 'Dat hangt af van jouw niche en postcodegebied. Tijdens het strategiegesprek krijg je een concreet startschema met verwacht volume en kostprijs.' },
              { q: 'Zit ik vast aan een contract?', a: 'Nee. We werken zonder lock-in. Je kunt maandelijks opschalen, afschalen of stoppen. Ons verdienmodel is gebaseerd op resultaat, niet op binding.' },
            ].map((item, i) => (
              <details key={item.q} className="group rounded-xl border border-white/[0.08] bg-white/[0.06] transition-colors open:border-brand-purple/30 open:bg-white/[0.1]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-purple/20 text-[12px] font-bold text-brand-purple md:h-8 md:w-8 md:text-[13px]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[14px] font-semibold text-white/90 md:text-[15px]">{item.q}</span>
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 transition-[transform,background-color,border-color] duration-200 group-open:rotate-45 group-open:border-brand-orange/40 group-open:bg-brand-orange/10">
                    <svg className="h-3 w-3 text-white/50 transition-colors group-open:text-brand-orange" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2">
                      <path d="M6 1v10M1 6h10" />
                    </svg>
                  </span>
                </summary>
                <div className="border-t border-white/[0.06] px-4 pb-4 pt-3.5 text-[13px] leading-relaxed text-white/55 md:px-6 md:pb-5 md:pt-4 md:text-sm md:pl-[4.25rem]">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <SoftGlow color="purple" className="-right-32 top-0" size="420px" intensity={0.3} showOnMobile />
          <SoftGlow color="orange" className="-left-20 bottom-0 hidden md:block" size="320px" intensity={0.22} showOnMobile />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-5 py-14 text-white md:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Klaar om structureel meer klanten te winnen?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70 md:mt-4 md:text-lg">
              Plan een gratis strategiegesprek en ontvang een concreet plan voor
              volume, regio en leadkwaliteit. Zonder verplichtingen.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/plan-gesprek"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Plan gratis strategiegesprek
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/gratis-account"
                className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
              >
                Bekijk gratis ons leadportaal
              </Link>
            </div>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </>
  );
}
