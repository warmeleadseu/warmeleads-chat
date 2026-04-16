import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
  SunIcon,
  FireIcon,
  CloudIcon,
  BriefcaseIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon,
  ArrowRightIcon,
  ChartBarIcon,
  RocketLaunchIcon,
  ServerStackIcon,
  WrenchScrewdriverIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";
import { Car } from "@phosphor-icons/react/ssr";

export const metadata: Metadata = {
  title: "Leadgeneratie Gids 2026 | Leads Kopen vs Zelf Genereren | WarmeLeads",
  description: "Complete gids voor leadgeneratie in Nederland 2026. Vergelijk leads kopen vs zelf genereren voor thuisbatterijen, zonnepanelen, warmtepompen en meer. Expert tips van WarmeLeads.",
  keywords: "leadgeneratie gids, leads kopen, leadgeneratie strategie, Nederlandse leadgeneratie, B2B leadgeneratie, lead generation Nederland",
};

export default function LeadgeneratieGidsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white text-slate-900">

      <div className="sr-only">
        <h1>Leadgeneratie Gids Nederland 2026 - Complete Strategie voor Leads Kopen</h1>
        <p>Complete gids voor leadgeneratie in Nederland. Vergelijk leads kopen vs zelf genereren voor thuisbatterijen, zonnepanelen, warmtepompen en meer.</p>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-navy py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-purple/20 blur-[120px]" />
          <div className="absolute -right-20 top-0 h-[300px] w-[300px] rounded-full bg-brand-pink/15 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-5 text-center text-white lg:px-8">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:text-[12px]">
            Complete strategie
          </p>
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
            Leadgeneratie Gids
          </h1>
          <p className="mb-4 text-xl text-white/90 md:text-2xl">
            Complete strategie voor leads kopen in Nederland 2026
          </p>
          <p className="mx-auto max-w-3xl text-base text-white/70 md:text-lg">
            Ontdek waarom leads kopen effectiever is dan zelf genereren, en hoe je maximale ROI
            behaalt uit je leadgeneratie investering.
          </p>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            Leads Kopen vs Zelf Genereren
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange/10">
                  <CheckCircleIcon className="h-7 w-7 text-brand-orange" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Leads Kopen</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Directe resultaten na campagne launch</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Geen setup tijd of expertise vereist</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Profiteer van onze campagne-ervaring</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Schaalbaarheid naar behoefte</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">ROI focus - betaal alleen voor kwaliteit</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple/10">
                  <XCircleIcon className="h-7 w-7 text-brand-purple" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Zelf Genereren</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <XCircleIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="text-slate-700">Maanden setup voor eerste resultaten</span>
                </li>
                <li className="flex items-center gap-2">
                  <XCircleIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="text-slate-700">Google Ads &amp; Facebook expertise vereist</span>
                </li>
                <li className="flex items-center gap-2">
                  <XCircleIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="text-slate-700">Hoog budget risico zonder garantie</span>
                </li>
                <li className="flex items-center gap-2">
                  <XCircleIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="text-slate-700">Constante optimalisatie nodig</span>
                </li>
                <li className="flex items-center gap-2">
                  <XCircleIcon className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="text-slate-700">Fulltime aandacht vereist</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Branche Expertise */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-bold text-slate-900">
            Onze Branche Expertise
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-slate-500">
            Gespecialiseerde campagnes voor elke sector
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <BoltIcon className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Thuisbatterijen</h4>
              <p className="text-sm text-slate-500">Huiseigenaren met zonnepanelen die energie-onafhankelijkheid zoeken</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <SunIcon className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Zonnepanelen</h4>
              <p className="text-sm text-slate-500">Huiseigenaren met hoge energierekeningen en duurzaamheidsfocus</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <FireIcon className="mx-auto mb-4 h-10 w-10 text-brand-purple" />
              <h4 className="mb-2 font-bold text-slate-900">Warmtepompen</h4>
              <p className="text-sm text-slate-500">Huiseigenaren die willen verduurzamen en besparen</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <CloudIcon className="mx-auto mb-4 h-10 w-10 text-brand-purple" />
              <h4 className="mb-2 font-bold text-slate-900">Airco&apos;s</h4>
              <p className="text-sm text-slate-500">Comfort en klimaatbeheersing voor Nederlandse huishoudens</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <ServerStackIcon className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Zakelijke Batterij</h4>
              <p className="text-sm text-slate-500">Grootschalige energieopslag voor bedrijven en commercieel vastgoed</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <Car className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Financial Lease</h4>
              <p className="text-sm text-slate-500">MKB bedrijven die financiering zoeken voor investeringen</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <WrenchScrewdriverIcon className="mx-auto mb-4 h-10 w-10 text-brand-purple" />
              <h4 className="mb-2 font-bold text-slate-900">Maatwerk</h4>
              <p className="text-sm text-slate-500">Custom campagnes voor jouw specifieke branche</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why WarmeLeads */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            Waarom WarmeLeads de Beste Keuze is
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h4 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900">
                <SparklesIcon className="h-5 w-5 text-brand-orange" />
                Onze Voordelen
              </h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">24/7 draaiende campagnes</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Verse Nederlandse prospects</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Realtime dashboard updates</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Branche-specifieke targeting</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                  <span className="text-slate-700">Kwaliteitsgarantie en support</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <h4 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900">
                <ChartBarIcon className="h-5 w-5 text-brand-purple" />
                Jouw Resultaat
              </h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                  <span className="text-slate-700">Meer tijd voor verkopen</span>
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                  <span className="text-slate-700">Hogere conversiekansen</span>
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                  <span className="text-slate-700">Voorspelbare leadflow</span>
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                  <span className="text-slate-700">Snellere business groei</span>
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                  <span className="text-slate-700">Betere ROI op marketing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Gratis Account CTA */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-5 text-center lg:px-8">
          <div className="rounded-2xl border border-brand-orange/20 bg-white p-8 shadow-lg md:p-12">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange/10">
              <GiftIcon className="h-7 w-7 text-brand-orange" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-slate-900 md:text-3xl">
              Probeer ons portaal gratis
            </h2>
            <p className="mx-auto mb-6 max-w-xl text-slate-600">
              Maak een gratis account aan en ontdek hoe ons klantportaal werkt. Als welkomstcadeau
              ontvang je <strong className="text-brand-orange">20% korting</strong> op je eerste batch leads.
            </p>
            <Link
              href="/gratis-account"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
            >
              <RocketLaunchIcon className="h-5 w-5" />
              Maak gratis een account aan
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-4 text-sm text-slate-400">Geen verplichtingen &bull; Direct toegang &bull; 20% welkomstkorting</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-brand-navy py-16 md:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-0 h-[300px] w-[300px] rounded-full bg-brand-purple/20 blur-[120px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-5 text-center text-white lg:px-8">
          <h2 className="mb-4 text-3xl font-bold">Klaar om te Starten?</h2>
          <p className="mb-8 text-lg text-white/70">
            Begin vandaag nog met verse Nederlandse prospects uit onze campagnes
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/gratis-account"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
            >
              <RocketLaunchIcon className="h-5 w-5" />
              Start met Verse Leads
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/plan-gesprek"
              className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 px-6 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Plan een gesprek
            </Link>
          </div>
        </div>
      </section>

      {/* Internal Links */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-bold text-slate-900">
            Bekijk onze branches
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-slate-500">
            Gespecialiseerde leads per sector
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/leads-thuisbatterijen"
              className="group rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <BoltIcon className="mx-auto mb-3 h-8 w-8 text-brand-orange" />
              <h3 className="mb-2 font-bold text-slate-900 group-hover:text-brand-purple">Thuisbatterij Leads</h3>
              <p className="text-sm text-slate-500">Verse prospects voor battery storage installateurs</p>
            </Link>
            <Link
              href="/leads-zonnepanelen"
              className="group rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <SunIcon className="mx-auto mb-3 h-8 w-8 text-brand-orange" />
              <h3 className="mb-2 font-bold text-slate-900 group-hover:text-brand-purple">Zonnepanelen Leads</h3>
              <p className="text-sm text-slate-500">Nederlandse solar prospects uit campagnes</p>
            </Link>
            <Link
              href="/leads-warmtepompen"
              className="group rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <FireIcon className="mx-auto mb-3 h-8 w-8 text-brand-purple" />
              <h3 className="mb-2 font-bold text-slate-900 group-hover:text-brand-purple">Warmtepomp Leads</h3>
              <p className="text-sm text-slate-500">HVAC leads voor warmtepomp installateurs</p>
            </Link>
            <Link
              href="/leads-airco"
              className="group rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <CloudIcon className="mx-auto mb-3 h-8 w-8 text-brand-purple" />
              <h3 className="mb-2 font-bold text-slate-900 group-hover:text-brand-purple">Airco Leads</h3>
              <p className="text-sm text-slate-500">Prospects voor airconditioning installateurs</p>
            </Link>
            <Link
              href="/leads-financial-lease"
              className="group rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <BriefcaseIcon className="mx-auto mb-3 h-8 w-8 text-brand-orange" />
              <h3 className="mb-2 font-bold text-slate-900 group-hover:text-brand-purple">Financial Lease Leads</h3>
              <p className="text-sm text-slate-500">B2B leads voor financial lease</p>
            </Link>
            <Link
              href="/maatwerk-leads"
              className="group rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-md"
            >
              <AdjustmentsHorizontalIcon className="mx-auto mb-3 h-8 w-8 text-brand-purple" />
              <h3 className="mb-2 font-bold text-slate-900 group-hover:text-brand-purple">Maatwerk Leads</h3>
              <p className="text-sm text-slate-500">Custom campagnes voor jouw specifieke branche</p>
            </Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </>
  );
}
