'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  CurrencyEuroIcon,
  BoltIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  WrenchScrewdriverIcon,
  HandThumbDownIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  }),
};

export default function MeerKlantenNodigPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen overflow-x-hidden bg-white text-slate-900">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-purple/20 blur-[120px]" />
          <div className="absolute left-1/3 top-0 h-[300px] w-[300px] rounded-full bg-brand-pink/10 blur-[100px]" />
          <div className="absolute -right-20 top-1/4 h-[250px] w-[250px] rounded-full bg-brand-orange/10 blur-[80px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-14 md:pb-24 md:pt-24 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="max-w-3xl"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur md:mb-5 md:px-4 md:text-[12px]"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-brand-orange" />
              Voor installatiebedrijven
            </motion.p>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.5rem] md:text-[3.75rem] lg:text-[4.25rem]"
            >
              Meer klanten nodig?{' '}
              <span className="gradient-text">
                Laten we praten.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70 md:mt-6 md:text-lg"
            >
              Plan een gratis strategiegesprek en ontvang een concreet plan voor
              meer gekwalificeerde leads, afgestemd op jouw regio, niche en budget.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/plan-gesprek"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Plan strategiegesprek
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#waarom-wij"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Waarom WarmeLeads
              </a>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 md:mt-14 lg:max-w-3xl"
          >
            {[
              { value: '<24u', label: 'Eerste levering', icon: ClockIcon },
              { value: '100%', label: 'Exclusief', icon: ShieldCheckIcon },
              { value: '€0', label: 'Vaste kosten', icon: CurrencyEuroIcon },
              { value: '4.8★', label: 'Klantwaardering', icon: BoltIcon },
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

      {/* ── Problem section ── */}
      <section className="bg-gradient-to-b from-white to-orange-50/40">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
              De uitdaging
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Herken je dit?
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500 md:mt-4 md:text-[16px]">
              De grootste uitdagingen voor installateurs bij het vinden van
              nieuwe klanten.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            {[
              {
                title: 'Te weinig klanten',
                description: 'Je hebt capaciteit, je monteurs staan klaar, maar de telefoon gaat niet over. Google Ads is duur en levert weinig op.',
                icon: ExclamationTriangleIcon,
                accent: 'bg-brand-purple',
              },
              {
                title: 'Marketing is duur',
                description: '€3.000–€5.000 per maand aan Google Ads? SEO duurt maanden? Social media advertenties die niet converteren?',
                icon: MegaphoneIcon,
                accent: 'bg-brand-pink',
              },
              {
                title: 'Geen tijd voor acquisitie',
                description: 'Je bent installateur, geen marketeer. Je wilt installeren, niet urenlang campagnes opzetten en content maken.',
                icon: WrenchScrewdriverIcon,
                accent: 'bg-brand-orange',
              },
              {
                title: 'Slechte lead kwaliteit',
                description: 'Je krijgt wel leads, maar het zijn trekkers, prijsvechters of mensen die "nog even nadenken". Je wilt serieuze prospects.',
                icon: HandThumbDownIcon,
                accent: 'bg-brand-navy',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-7"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg md:mb-5 md:h-11 md:w-11 ${item.accent}`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:mt-2 md:text-sm">{item.description}</p>
                <div className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution section ── */}
      <section id="waarom-wij" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
              De oplossing
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Wij doen het zware werk.{' '}
              <span className="text-slate-500">Jij installeert en verdient.</span>
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              { title: 'Exclusieve leads', description: 'Jouw lead is jouw klant. Geen concurrentie, geen doorverkoop. We starten campagnes afgestemd op jouw regio.', icon: ShieldCheckIcon, accent: 'bg-brand-purple' },
              { title: 'Automatisch gekwalificeerd', description: 'Elke lead doorloopt meerdere quality checks. Alleen leads die aan jouw eisen voldoen komen in je portaal.', icon: BoltIcon, accent: 'bg-brand-pink' },
              { title: 'Geen vaste kosten', description: 'Betaal alleen voor leads die je afneemt. Geen abonnement, geen verrassingen, geen lock-in.', icon: CurrencyEuroIcon, accent: 'bg-brand-orange' },
            ].map((item) => (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-7"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg md:mb-5 md:h-11 md:w-11 ${item.accent}`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:mt-2 md:text-sm">{item.description}</p>
                <div className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">
              Hoe het werkt
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Van gesprek naar leads in vier stappen.
            </h2>
          </div>

          <div className="relative grid gap-4 md:grid-cols-4 md:gap-0">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 hidden -translate-y-1/2 md:block">
              <div className="mx-auto h-px w-[calc(100%-120px)] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {[
              { step: '01', title: 'Strategiegesprek', description: 'We bespreken jouw doelgroep, regio, volume en budget. Je ontvangt een helder plan.' },
              { step: '02', title: 'Campagne op maat', description: 'We bouwen campagnes afgestemd op jouw propositie. Live binnen 24-72 uur.' },
              { step: '03', title: 'Quality checks', description: 'Elke lead wordt automatisch gecheckt op kwaliteit voordat die in je portaal verschijnt.' },
              { step: '04', title: 'Leads in je portaal', description: 'Gekwalificeerde leads verschijnen realtime. Bel, app of mail ze met één klik.' },
            ].map((item) => (
              <article
                key={item.step}
                className="group relative z-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.08] md:mx-1.5 md:p-6"
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
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-slate-50">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-orange-50/60 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
              Wat klanten zeggen
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Waarom installateurs voor ons kiezen.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              { quote: 'Binnen 3 weken hadden we een stabiele instroom van 15+ leads per week. De kwaliteit is consistent en ons salesteam kan eindelijk plannen.', name: 'Dennis V.', role: 'Directeur, SolarInstall BV' },
              { quote: 'Eindelijk een partij die snapt dat het niet om aantallen gaat maar om conversie. Onze CPL is met 30% gedaald terwijl het volume steeg.', name: 'Marieke T.', role: 'Sales Manager, KlimaatComfort' },
              { quote: 'De leads zijn echt exclusief. Geen gedoe met 5 andere bedrijven die dezelfde klant bellen. Precies wat we nodig hadden.', name: 'Piet K.', role: 'Thuisbatterij Installateur' },
            ].map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="mb-3 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <StarIconSolid key={i} className="h-3.5 w-3.5 text-brand-orange" />
                  ))}
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700 md:text-sm">&ldquo;{item.quote}&rdquo;</p>
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
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:grid-cols-4 md:gap-4">
            {[
              { value: '500+', label: 'Leads per maand' },
              { value: '40+', label: 'Actieve klanten' },
              { value: '92%', label: 'Klantretentie' },
              { value: '4.8', label: 'Klantwaardering' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center shadow-sm md:py-5">
                <p className="text-2xl font-extrabold text-brand-navy md:text-3xl">{item.value}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 md:text-[12px]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact + Info ── */}
      <section id="contact" className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:gap-16">

            {/* Left: Contact info */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
                Neem contact op
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Persoonlijk advies.<br />
                <span className="text-slate-500">Geen verkooppraatje.</span>
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600 md:mt-4 md:text-[15px]">
                Bij WarmeLeads geloven we in persoonlijk contact. Bel ons, mail ons, of plan
                direct een strategiegesprek. We denken graag vrijblijvend met je mee.
              </p>

              <div className="mt-6 space-y-4 md:mt-8">
                <a href="tel:+31850477067" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-purple/30 hover:bg-brand-purple/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-purple">
                    <PhoneIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">085 – 047 7067</p>
                    <p className="text-[11px] text-slate-500">Bereikbaar ma-vr 9:00 – 17:00</p>
                  </div>
                </a>

                <a href="mailto:info@warmeleads.eu" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-pink/30 hover:bg-brand-pink/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-pink">
                    <EnvelopeIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">info@warmeleads.eu</p>
                    <p className="text-[11px] text-slate-500">We reageren binnen 24 uur</p>
                  </div>
                </a>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange">
                    <MapPinIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-slate-900">Nederland & België</p>
                    <p className="text-[11px] text-slate-500">We komen ook bij je langs op locatie</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-brand-purple/15 bg-brand-purple/5 p-4 md:mt-8">
                <div className="flex items-start gap-3">
                  <UserIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-purple" />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900 md:text-[14px]">Persoonlijke accountmanager</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600 md:text-[13px]">
                      Na het strategiegesprek krijg je een vaste accountmanager die jouw business
                      kent, meedenkt over groei en altijd bereikbaar is.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Booking CTA */}
            <div id="contact" className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm md:p-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-purple/10">
                <CalendarDaysIcon className="h-7 w-7 text-brand-purple" />
              </div>
              <h3 className="text-xl font-bold tracking-tight md:text-2xl">Plan een gratis strategiegesprek</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500 md:text-sm">
                Kies een datum en tijdstip dat jou uitkomt. We bespreken vrijblijvend hoe
                we jouw leadgeneratie kunnen optimaliseren.
              </p>

              <div className="mt-6 space-y-4">
                <div className="space-y-3 rounded-xl bg-white p-4">
                  {[
                    { icon: ClockIcon, text: 'Duurt circa 20-30 minuten' },
                    { icon: PhoneIcon, text: 'Telefonisch, online of op locatie' },
                    { icon: CheckCircleIcon, text: '100% vrijblijvend, geen verplichtingen' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <item.icon className="h-4.5 w-4.5 shrink-0 text-brand-purple" />
                      <span className="text-[13px] text-slate-700 md:text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/plan-gesprek"
                  className="group flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
                >
                  Kies een moment
                  <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>

                <p className="text-center text-[11px] text-slate-400">
                  Liever direct bellen? <a href="tel:0850477067" className="font-medium text-brand-purple hover:underline">085 047 7067</a>
                </p>
              </div>
            </div>
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
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">FAQ</p>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Veelgestelde vragen</h2>
          </div>

          <div className="space-y-2.5 md:space-y-3">
            {[
              { q: 'Wat kost een strategiegesprek?', a: 'Niets. Het strategiegesprek is volledig gratis en vrijblijvend. We bespreken samen of er een match is en maken een concreet plan.' },
              { q: 'Hoelang duurt het voordat ik leads ontvang?', a: 'In de meeste gevallen binnen 24 tot 72 uur na goedkeuring van het plan. We starten campagnes zodra alles staat.' },
              { q: 'Zijn de leads exclusief?', a: 'Ja. We starten campagnes specifiek voor jouw targetgebied. Leads worden niet doorverkocht aan andere partijen.' },
              { q: 'Zit ik vast aan een contract?', a: 'Nee. We werken zonder lock-in. Je kunt maandelijks opschalen, afschalen of stoppen.' },
              { q: 'Kan ik eerst klein beginnen?', a: 'Zeker. Start gecontroleerd in één regio, bewijs rendement, en schaal dan uit. Wij schalen mee.' },
              { q: 'Hoe meld ik een slechte lead?', a: 'Via je portaal kun je per lead feedback geven. Bij gegronde klachten zorgen we voor vervanging of compensatie.' },
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
              Klaar voor meer klanten?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70 md:mt-4 md:text-lg">
              Stop met zoeken. Start met groeien. Plan je gratis strategiegesprek
              en ontvang een concreet plan. Zonder verplichtingen.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/plan-gesprek"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Plan strategiegesprek
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/hoe-het-werkt"
                className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bekijk hoe het werkt
              </Link>
            </div>
            <p className="mt-5 text-[12px] font-medium text-white/40 md:mt-6">
              Geen abonnement &bull; Geen vaste kosten &bull; 100% exclusief
            </p>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </>
  );
}
