'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  DevicePhoneMobileIcon,
  BellAlertIcon,
  ShieldCheckIcon,
  PhoneIcon,
  BoltIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  RocketLaunchIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  UserIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
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

export default function HoeHetWerktPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen overflow-x-hidden bg-white text-slate-900">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-purple/20 blur-[120px]" />
          <div className="absolute right-1/4 top-0 h-[300px] w-[300px] rounded-full bg-brand-orange/10 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-14 pt-14 md:pb-20 md:pt-24 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="max-w-3xl"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur md:mb-5 md:text-[12px]"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-brand-orange" />
              Ons proces
            </motion.p>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.5rem] md:text-[3.75rem]"
            >
              Hoe WarmeLeads werkt.{' '}
              <span className="gradient-text">Van begin tot eind.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70 md:mt-6 md:text-lg"
            >
              We bouwen een voorspelbare instroom van gekwalificeerde leads die
              precies passen bij jouw regio, niche en salesteam. Hier zie je
              stap voor stap hoe.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ── 4-Step Process ── */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="space-y-12 md:space-y-16">
            {[
              {
                step: '01',
                title: 'Strategiegesprek & intake',
                icon: ClipboardDocumentListIcon,
                accent: 'bg-brand-purple',
                accentLight: 'bg-brand-purple/10',
                accentText: 'text-brand-purple',
                description: 'We starten met een persoonlijk strategiegesprek. Telefonisch, online of op locatie bij jou. Samen bepalen we:',
                bullets: [
                  'Jouw doelgroep, regio en postcodegebied',
                  'Gewenst lead volume en budget per lead',
                  'Specifieke kwalificatie-eisen en filters',
                  'Planning en verwachte doorlooptijd',
                ],
                footer: 'Je ontvangt een helder plan met concrete verwachtingen over volume, kostprijs en timing.',
              },
              {
                step: '02',
                title: 'Campagne op maat',
                icon: AdjustmentsHorizontalIcon,
                accent: 'bg-brand-pink',
                accentLight: 'bg-brand-pink/10',
                accentText: 'text-brand-pink',
                description: 'Op basis van de intake bouwen we campagnes volledig afgestemd op jouw situatie:',
                bullets: [
                  'Targeting op exacte postcodes, gemeentes of provincies',
                  'Advertenties die de juiste doelgroep aanspreken',
                  'Grondige A/B testen voor optimale conversie',
                  'Campagnes live binnen 24 tot 72 uur na goedkeuring',
                ],
                footer: 'We optimaliseren continu op data. Je hebt altijd inzicht in performance via je accountmanager.',
              },
              {
                step: '03',
                title: 'Automatische quality checks',
                icon: ShieldCheckIcon,
                accent: 'bg-brand-orange',
                accentLight: 'bg-brand-orange/10',
                accentText: 'text-brand-orange',
                description: 'Elke lead doorloopt automatisch meerdere kwaliteitscontroles voordat deze in jouw portaal verschijnt:',
                bullets: [
                  'Verificatie van telefoonnummer en e-mailadres',
                  'Automatische adresverrijking (postcode, plaats, provincie)',
                  'Kwaliteitsscore op basis van data-compleetheid',
                  'Filtering op jouw specifieke eisen (bijv. budget, woningtype)',
                ],
                footer: 'Alleen leads die aan al jouw criteria voldoen worden doorgestuurd. De rest filteren we eruit.',
              },
              {
                step: '04',
                title: 'Realtime in jouw portaal',
                icon: RocketLaunchIcon,
                accent: 'bg-brand-navy',
                accentLight: 'bg-brand-navy/10',
                accentText: 'text-brand-navy',
                description: 'Gekwalificeerde leads verschijnen direct in je persoonlijke klantportaal:',
                bullets: [
                  'Alle details: naam, telefoon, e-mail, adres, interesse, budget',
                  'Met één klik bellen, WhatsAppen of mailen',
                  'Notities toevoegen, status bijhouden, feedback geven',
                  'Installeerbaar als app op je telefoon (iOS & Android)',
                ],
                footer: 'Je ontvangt een notificatie bij elke nieuwe lead, per e-mail en als pushmelding op je telefoon.',
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="grid items-start gap-6 md:grid-cols-[auto_1fr] md:gap-10"
              >
                <div className="flex items-start gap-4 md:flex-col md:items-center md:gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.accent} md:h-14 md:w-14`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  {idx < 3 && (
                    <div className="hidden h-full min-h-[80px] w-px bg-gradient-to-b from-slate-200 to-transparent md:block" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${item.accentLight} ${item.accentText}`}>
                      Stap {item.step}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">{item.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600 md:text-[15px]">{item.description}</p>

                  <ul className="mt-4 space-y-2">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5">
                        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
                        <span className="text-[13px] text-slate-700 md:text-sm">{b}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-medium text-slate-600 md:text-[13px]">
                    {item.footer}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal Demo ── */}
      <section className="relative overflow-hidden bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
              Jouw portaal
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Alles wat je nodig hebt, op één plek.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-slate-500 md:mt-4 md:text-[16px]">
              Een modern, overzichtelijk portaal dat je ook als app op je telefoon kunt installeren.
              <Link href="/gratis-account" className="mt-1 block font-semibold text-brand-purple hover:text-brand-orange transition-colors">
                Maak gratis een account aan en ontdek het zelf &rarr;
              </Link>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              {
                icon: BoltIcon,
                accent: 'bg-brand-purple',
                title: 'Realtime levering',
                desc: 'Zodra een lead door alle checks komt, verschijnt deze direct in je portaal. Geen vertraging, geen batch-downloads.',
              },
              {
                icon: BellAlertIcon,
                accent: 'bg-brand-pink',
                title: 'Notificaties',
                desc: 'Ontvang een pushnotificatie op je telefoon en een e-mail bij elke nieuwe lead. Kies zelf welke meldingen je wilt.',
              },
              {
                icon: DevicePhoneMobileIcon,
                accent: 'bg-brand-orange',
                title: 'App op je telefoon',
                desc: 'Installeer het portaal als Progressive Web App (PWA) op je telefoon. Werkt als een echte app, geen download nodig.',
              },
              {
                icon: PhoneIcon,
                accent: 'bg-brand-navy',
                title: 'Direct contact',
                desc: 'Bel, WhatsApp of mail je leads met één klik vanuit het portaal. Snel opvolgen = hogere conversie.',
              },
              {
                icon: ChatBubbleLeftRightIcon,
                accent: 'bg-brand-purple',
                title: 'Feedback & notities',
                desc: 'Voeg notities toe, geef feedback per lead en houd de status bij. Wij gebruiken jouw feedback om campagnes te optimaliseren.',
              },
              {
                icon: ChartBarIcon,
                accent: 'bg-brand-pink',
                title: 'Inzicht & overzicht',
                desc: 'Bekijk al je leads, filter op status, en houd je batch-voortgang bij. Alles transparant en real-time.',
              },
            ].map((item) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5 }}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg md:p-6"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${item.accent}`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[15px] font-bold text-slate-900 md:text-[16px]">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:text-sm">{item.desc}</p>
                <div className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Exclusivity + Quality ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-purple">
                <ShieldCheckIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold tracking-tight md:text-2xl">Exclusief = echt exclusief</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 md:mt-3 md:text-sm">
                Als we zeggen dat een lead exclusief is, dan bedoelen we dat ook. We starten
                campagnes specifiek afgestemd op jouw targetgebied. Leads worden niet doorverkocht
                of verdubbeld. Jouw lead = jouw prospect.
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  'Leads worden exclusief voor jou gegenereerd',
                  'Geen doorverkoop aan andere partijen',
                  'Campagnes op jouw postcodegebied afgestemd',
                  'Volledige transparantie over herkomst',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                    <span className="text-[13px] text-slate-700 md:text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-orange">
                <ExclamationTriangleIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold tracking-tight md:text-2xl">Reclamatiebeleid</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 md:mt-3 md:text-sm">
                We streven naar de hoogste kwaliteit, maar een enkele keer kan een lead niet
                aan de verwachtingen voldoen. Daar hebben we een eerlijk reclamatiebeleid voor:
              </p>
              <ul className="mt-4 space-y-2">
                {[
                  'Meld een lead eenvoudig via je portaal',
                  'We beoordelen elke reclamatie individueel',
                  'Bij gegronde klachten: vervanging of compensatie',
                  'Volledige voorwaarden in onze Algemene Voorwaarden',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-brand-orange" />
                    <span className="text-[13px] text-slate-700 md:text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Link
                  href="/algemene-voorwaarden"
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-orange hover:text-brand-purple md:text-[13px]"
                >
                  Bekijk Algemene Voorwaarden
                  <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── New Niche Research ── */}
      <section className="border-y border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
                Nieuwe branches
              </p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Werk je in een niche waar we<br className="hidden md:block" />
                <span className="text-slate-500">nog niet actief zijn?</span>
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600 md:mt-4 md:text-[15px]">
                We zijn gespecialiseerd in verduurzaming (zonnepanelen, warmtepompen, thuisbatterijen,
                airco, financial lease), maar genereren leads in vrijwel elke branche.
                Werk je in een niche waarin we nog geen ervaring hebben? We investeren graag
                in onderzoek.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  { icon: BeakerIcon, text: 'We doen grondig markt- en haalbaarheidsonderzoek' },
                  { icon: AdjustmentsHorizontalIcon, text: 'We testen campagnes tot we de juiste strategie vinden' },
                  { icon: MagnifyingGlassIcon, text: 'We bepalen realistische tarieven en volumes' },
                  { icon: ChartBarIcon, text: 'Je ontvangt een concreet plan na het onderzoek' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pink/10">
                      <item.icon className="h-4 w-4 text-brand-pink" />
                    </div>
                    <p className="text-[13px] font-medium text-slate-700 md:text-sm">{item.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="rounded-2xl border border-brand-orange/20 bg-brand-orange/5 p-6 md:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-orange">
                    <BeakerIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 md:text-xl">Onderzoekskosten: €750</p>
                    <p className="text-[12px] text-slate-500">Eenmalig, volledig terug in leads</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-white/80 bg-white/60 p-4">
                    <p className="text-[13px] font-semibold text-slate-900 md:text-[14px]">Wat houdt het in?</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600 md:text-[13px]">
                      We investeren €750 in marktonderzoek, campagne-testen en strategie-ontwikkeling
                      specifiek voor jouw branche en doelgroep.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white/60 p-4">
                    <p className="text-[13px] font-semibold text-slate-900 md:text-[14px]">Wat krijg je terug?</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600 md:text-[13px]">
                      Je krijgt het volledige bedrag terug in leads zodra de campagnes draaien.
                      Het kost je uiteindelijk niets extra. Alleen de tijd om samen het onderzoek te doorlopen.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { value: '€750', label: 'Investering' },
                    { value: '100%', label: 'Terug in leads' },
                    { value: '2-4 wk', label: 'Doorlooptijd' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-brand-navy p-3 text-center text-white">
                      <p className="text-lg font-bold md:text-xl">{item.value}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/70 md:text-[11px]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Personal Approach ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
              Persoonlijke aanpak
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Geen callcenter. Een echt team.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-slate-500 md:mt-4 md:text-[16px]">
              Bij WarmeLeads geloven we dat de beste resultaten ontstaan uit échte samenwerking.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              {
                icon: UserIcon,
                accent: 'bg-brand-purple',
                title: 'Vaste accountmanager',
                desc: 'Je krijgt een vast aanspreekpunt dat jouw business, doelgroep en markt door en door kent. Geen willekeurig persoon per keer.',
              },
              {
                icon: PhoneIcon,
                accent: 'bg-brand-pink',
                title: 'Altijd bereikbaar',
                desc: 'Via telefoon, e-mail of WhatsApp. Vragen? Feedback? Ideeën? Je accountmanager staat altijd voor je klaar.',
              },
              {
                icon: ChartBarIcon,
                accent: 'bg-brand-orange',
                title: 'Op locatie bij jou',
                desc: 'We komen langs op jouw locatie voor strategiegesprekken, evaluaties en om je team te leren kennen. Persoonlijk contact is de basis.',
              },
            ].map((item) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5 }}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg md:p-7"
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg md:mb-5 md:h-11 md:w-11 ${item.accent}`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:mt-2 md:text-sm">{item.desc}</p>
                <div className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
              </motion.article>
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
              Klaar om te starten?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70 md:mt-4 md:text-lg">
              Plan een gratis strategiegesprek en ontvang een concreet plan op maat.
              Geen verplichtingen, geen kleine lettertjes.
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
                className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bekijk gratis ons portaal
              </Link>
            </div>
            <p className="mt-5 text-[12px] font-medium text-white/40 md:mt-6">
              Geen abonnement &bull; Geen lock-in &bull; 20% welkomstkorting op eerste batch
            </p>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </>
  );
}
