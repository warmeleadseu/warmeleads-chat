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
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.4, 0.25, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen overflow-x-hidden bg-white text-slate-900">

      {/* ── Hero ── */}
      <section className="relative min-h-[520px] overflow-hidden bg-brand-navy md:min-h-[600px] lg:min-h-[640px]">
        {/* Background photo — fills right side on desktop, full background on mobile */}
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

        {/* Diagonal gradient overlay — blends navy from left into photo on right */}
        <div className="pointer-events-none absolute inset-0 bg-brand-navy/90 md:bg-transparent">
          {/* Mobile: heavy overlay for readability */}
          {/* Desktop: diagonal blend from solid navy to semi-transparent */}
          <div className="hidden h-full w-full md:block" style={{
            background: 'linear-gradient(105deg, #1A1A2E 0%, #1A1A2E 42%, rgba(26,26,46,0.85) 55%, rgba(26,26,46,0.5) 70%, rgba(26,26,46,0.25) 85%, rgba(26,26,46,0.15) 100%)',
          }} />
        </div>

        {/* Subtle brand color accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-purple/20 blur-[120px]" />
          <div className="absolute left-1/4 top-0 h-[300px] w-[300px] rounded-full bg-brand-pink/10 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-14 pt-12 md:pb-24 md:pt-24 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-2xl"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur md:mb-5 md:px-4 md:text-[12px]"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-brand-orange" />
              Performance leadgeneratie
            </motion.p>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.5rem] md:text-[3.75rem] lg:text-[4.25rem]"
            >
              Meer kwalitatieve leads.{' '}
              <span className="gradient-text">Minder verspilde salesuren.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70 md:mt-6 md:text-lg"
            >
              WarmeLeads bouwt een voorspelbare leadmachine voor installatiebedrijven
              en commerciële teams die willen groeien op kwaliteit, niet op geluk.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/meer-klanten-nodig"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Plan gratis strategiegesprek
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/maatwerk-leads"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bekijk aanpak en pricing
              </Link>
            </motion.div>
          </motion.div>

          {/* Hero metrics */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mt-14 md:gap-4 lg:max-w-3xl"
          >
            {[
              { value: '24u', label: 'Gemiddelde eerste levering', icon: ClockIcon },
              { value: '98%', label: 'Lead bereikbaarheid', icon: PhoneIcon },
              { value: '30+', label: 'Actieve niche campagnes', icon: ChartBarIcon },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                variants={fadeUp}
                custom={i + 4}
                className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-4 py-3 backdrop-blur md:gap-4 md:px-5 md:py-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 md:h-10 md:w-10">
                  <item.icon className="h-4 w-4 text-brand-orange md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white md:text-xl">{item.value}</p>
                  <p className="text-[11px] text-white/60 md:text-[12px]">{item.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-center md:gap-0">
            {[
              { label: '40+ klanten', first: true },
              { label: 'NL & BE dekking' },
              { label: '8+ niches actief' },
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
              We combineren slimme targeting, snelle opvolging en transparante data
              zodat jouw salesteam alleen tijd besteedt aan leads die ertoe doen.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              {
                title: 'Exclusieve aanvragen',
                description: 'Geen doorverkoop of bulk lijsten. Elke lead is van jou — in de afgesproken regio en niche. Gegarandeerd.',
                icon: ShieldCheckIcon,
                accent: 'bg-brand-purple',
              },
              {
                title: 'Snelle sales opvolging',
                description: 'Realtime levering op het piekmoment van intentie. Direct bellen, appen of inplannen via jouw eigen flow.',
                icon: BoltIcon,
                accent: 'bg-brand-pink',
              },
              {
                title: 'Schaalbaar lead volume',
                description: 'Start gecontroleerd in één regio, bewijs rendement, en schaal uit naar meerdere gebieden met stabiliteit.',
                icon: ArrowTrendingUpIcon,
                accent: 'bg-brand-orange',
              },
            ].map((item) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5 }}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-7"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg md:mb-5 md:h-11 md:w-11 ${item.accent}`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:mt-2 md:text-sm">{item.description}</p>
                <div className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial / Social proof ── */}
      <section className="relative overflow-hidden border-y border-slate-100 bg-slate-50">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-orange-50/60 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_1.2fr] md:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
                Wat klanten zeggen
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Resultaten spreken<br />
                <span className="text-slate-500">voor zich.</span>
              </h2>

              {/* Team photo */}
              <div className="relative mt-6 overflow-hidden rounded-xl md:mt-8">
                <Image
                  src="/images/team-meeting.jpg"
                  alt="Salesteam in overleg"
                  width={500}
                  height={300}
                  className="h-auto w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-navy/30 to-transparent" />
              </div>

              <div className="mt-5 flex items-center gap-6 md:mt-6">
                <div>
                  <p className="text-3xl font-extrabold text-brand-navy md:text-4xl">4.8</p>
                  <div className="mt-1 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <StarIconSolid key={i} className={`h-4 w-4 ${i < 5 ? 'text-brand-orange' : 'text-slate-300'}`} />
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
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-4"
            >
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
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Process ── */}
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
              Drie stappen. Geen verrassingen. Vanaf dag één transparant over
              volume, kosten en kwaliteit.
            </p>
          </div>

          <div className="relative grid gap-4 md:grid-cols-3 md:gap-0">
            {/* Connector line (desktop only) */}
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 hidden -translate-y-1/2 md:block">
              <div className="mx-auto h-px w-[calc(100%-120px)] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {[
              { step: '01', title: 'Strategiegesprek', description: 'We bepalen samen doelgroep, regio, volume en gewenste kostprijs per lead. Je krijgt een helder plan.' },
              { step: '02', title: 'Campagne setup', description: 'We bouwen targeting, funnel en leadkwalificatie op basis van jouw propositie en markt. Klaar in 24–72 uur.' },
              { step: '03', title: 'Live + optimalisatie', description: 'Je ontvangt leads direct. We sturen wekelijks bij op data, kwaliteit en omzetimpact. Jij stuurt mee.' },
            ].map((item, i) => (
              <motion.article
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative z-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.08] md:mx-2 md:p-7"
              >
                <p className="absolute -right-2 -top-4 text-[60px] font-black leading-none text-white/[0.04] select-none md:text-[80px]">{item.step}</p>
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-3 md:mb-5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange text-[13px] font-bold text-slate-950">{item.step}</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <h3 className="text-[16px] font-bold md:text-lg">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 md:mt-2 md:text-sm">{item.description}</p>
                </div>
              </motion.article>
            ))}
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
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-brand-purple px-5 py-6 text-center md:py-8"
            >
              <p className="text-2xl font-extrabold text-white md:text-3xl">{item.value}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/60 md:text-[12px]">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Photo break — strategy visual ── */}
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:text-[12px]">
              Voor groeiende teams
            </p>
            <h2 className="text-2xl font-bold text-white md:text-4xl">
              Wij leveren de leads. Jij sluit de deals.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-white/70 md:text-[16px]">
              Van installatiebedrijven tot energiepartners — wij zorgen voor een
              voorspelbare instroom door heel Nederland en België.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Verticals + Case snapshot ── */}
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
                Markten
              </p>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                Focus op niches met hoge intentie
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 md:mt-3 md:text-sm">
                We werken in bewezen segmenten waar opvolgbaarheid en orderkans hoog zijn.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2 md:mt-6 md:grid-cols-3">
                {['Zonnepanelen', 'Warmtepompen', 'Thuisbatterijen', 'Financial Lease', 'Airco', 'Isolatie', 'Laadpalen', 'B2B Energie'].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-center text-[12px] font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:bg-brand-purple/5 hover:text-brand-purple md:px-3 md:py-2.5 md:text-[13px]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
                Case Snapshot
              </p>
              <h3 className="text-xl font-bold tracking-tight md:text-2xl">
                Van onvoorspelbaar naar stabiele pijplijn
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 md:mt-3 md:text-sm">
                Een regionaal installatieteam ging van onregelmatige instroom naar
                een stabiele wekelijkse pijplijn met duidelijk volume en conversie.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 md:mt-6 md:gap-3">
                {[
                  { value: '+41%', label: 'Meer afspraken', bg: 'bg-brand-navy' },
                  { value: '-23%', label: 'Lagere CPL', bg: 'bg-brand-purple' },
                  { value: '7 wkn', label: 'Naar stabiliteit', bg: 'bg-brand-orange' },
                ].map((item) => (
                  <div key={item.label} className={`${item.bg} rounded-lg p-3 text-center text-white md:p-4`}>
                    <p className="text-xl font-bold md:text-2xl">{item.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/80 md:mt-1 md:text-[11px]">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-5 md:pt-6">
                <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
                  <ChatBubbleLeftRightIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink" />
                  <div>
                    <p className="text-[12px] italic leading-relaxed text-slate-600 md:text-[13px]">
                      &ldquo;We dachten dat het te mooi was om waar te zijn. Na 7 weken draaiden we stabiel 20 afspraken per week.&rdquo;
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">— Klant in zonnepanelen, regio Zuid-Holland</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-1/4 h-[400px] w-[400px] rounded-full bg-brand-purple/15 blur-[120px]" />
          <div className="absolute -right-20 bottom-0 h-[300px] w-[300px] rounded-full bg-brand-pink/10 blur-[100px]" />
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
              { q: 'Zijn de leads exclusief of gedeeld?', a: 'Primair werken we met exclusieve leads. Elke aanvraag is enkel voor jou, in jouw regio. Indien gewenst bespreken we een gedeeld model voor schaal en kostprijs.' },
              { q: 'Hoe snel kunnen we live?', a: 'In de meeste gevallen binnen 24 tot 72 uur na intake, afhankelijk van niche en regio. We starten zodra de funnel staat — geen wekenlange aanlooptijd.' },
              { q: 'Kunnen jullie koppelen met ons CRM?', a: 'Ja. We ondersteunen directe koppelingen via webhooks, API of handmatige exports zodat je salesflow direct doorloopt zonder extra administratie.' },
              { q: 'Wat is een realistisch startvolume?', a: 'Dat hangt af van jouw niche en postcodegebied. Tijdens het strategiegesprek krijg je een concreet startschema met verwacht volume en kostprijs.' },
              { q: 'Zit ik vast aan een contract?', a: 'Nee. We werken zonder lock-in. Je kunt maandelijks opschalen, afschalen of stoppen. Ons verdienmodel is gebaseerd op resultaat, niet op binding.' },
              { q: 'Hoe meten jullie leadkwaliteit?', a: 'We tracken bereikbaarheid, afspraakratio en conversie. Wekelijks rapporteren we transparant zodat je precies weet wat elke lead oplevert.' },
            ].map((item, i) => (
              <details key={item.q} className="group rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm transition-colors open:border-brand-purple/30 open:bg-white/[0.07]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-purple/20 text-[12px] font-bold text-brand-purple md:h-8 md:w-8 md:text-[13px]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[14px] font-semibold text-white/90 md:text-[15px]">{item.q}</span>
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 transition-all duration-200 group-open:rotate-45 group-open:border-brand-orange/40 group-open:bg-brand-orange/10">
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
          <div className="absolute -right-32 top-0 h-[300px] w-[300px] rounded-full bg-brand-purple/30 blur-[100px] md:h-[400px] md:w-[400px]" />
          <div className="absolute -left-20 bottom-0 h-[200px] w-[200px] rounded-full bg-brand-orange/20 blur-[80px] md:h-[300px] md:w-[300px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-5 py-14 text-white md:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Klaar om structureel meer klanten te winnen?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70 md:mt-4 md:text-lg">
              Plan een gratis strategiegesprek en ontvang een concreet plan voor
              volume, regio en leadkwaliteit — zonder verplichtingen.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/meer-klanten-nodig"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Plan gratis strategiegesprek
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/meer-klanten-nodig"
                className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bekijk onze oplossingen
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
