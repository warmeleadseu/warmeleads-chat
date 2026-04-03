'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  SparklesIcon,
  BoltIcon,
  GlobeEuropeAfricaIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PhoneIcon,
  DevicePhoneMobileIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

interface BranchLeadsPageProps {
  metadata: {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    heroDescription: string;
    exclusivePrice: string;
    sharedPrice: string;
  };
}

export function BranchLeadsPageContent({ metadata }: BranchLeadsPageProps) {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-white text-slate-900">

      <div className="sr-only">
        <h1>{metadata.title}</h1>
        <p>{metadata.heroDescription}</p>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-brand-navy py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-purple/20 blur-[120px]" />
          <div className="absolute -right-20 top-0 h-[300px] w-[300px] rounded-full bg-brand-pink/15 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-5 text-center text-white lg:px-8">
          <h1 className="mb-4 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
            {metadata.heroTitle}
          </h1>
          <p className="mb-4 text-xl text-white/90 md:text-2xl">
            {metadata.heroSubtitle}
          </p>
          <p className="mx-auto max-w-3xl text-base text-white/70 md:text-lg">
            {metadata.heroDescription}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/meer-klanten-nodig"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
            >
              Plan gratis strategiegesprek
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/hoe-het-werkt"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Bekijk hoe het werkt
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:text-[12px]">Tarieven</p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">Transparante prijzen, geen verrassingen</h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] text-slate-500 md:text-[15px]">Betaal per lead. Geen abonnement, geen vaste kosten, geen lock-in.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <div className="relative overflow-hidden rounded-xl border-2 border-brand-purple/20 bg-white p-6 shadow-sm md:p-8">
              <div className="absolute right-4 top-4 rounded-full bg-brand-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-purple">Aanbevolen</div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange/10">
                  <SparklesIcon className="h-7 w-7 text-brand-orange" />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Exclusieve leads</h3>
                <div className="mb-1 text-4xl font-bold text-brand-purple">{metadata.exclusivePrice}</div>
                <div className="mb-6 text-sm text-slate-500">per lead</div>
                <ul className="mb-8 space-y-3 text-left">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">100% exclusief, alleen voor jou</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Campagnes op jouw postcodegebied</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Automatische quality checks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Realtime in je portaal</span>
                  </li>
                </ul>
                <Link
                  href="/meer-klanten-nodig"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 hover:brightness-110"
                >
                  Plan strategiegesprek
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple/10">
                  <ChartBarIcon className="h-7 w-7 text-brand-purple" />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Volume deal</h3>
                <div className="mb-1 text-4xl font-bold text-brand-purple">{metadata.sharedPrice}</div>
                <div className="mb-6 text-sm text-slate-500">per lead (bij hogere volumes)</div>
                <ul className="mb-8 space-y-3 text-left">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Aantrekkelijk tarief bij volume</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Dezelfde kwaliteitsgarantie</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Ideaal voor grotere batches</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Tarief op maat na overleg</span>
                  </li>
                </ul>
                <Link
                  href="/meer-klanten-nodig"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  Bespreek volume deal
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-bold text-slate-900">Waarom WarmeLeads?</h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-slate-500">
            Verse, gekwalificeerde leads uit eigen campagnes. Realtime in je portaal.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <BoltIcon className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Verse leads</h4>
              <p className="text-sm text-slate-500">Realtime uit eigen campagnes</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <GlobeEuropeAfricaIcon className="mx-auto mb-4 h-10 w-10 text-brand-purple" />
              <h4 className="mb-2 font-bold text-slate-900">NL & BE dekking</h4>
              <p className="text-sm text-slate-500">Heel Nederland en België</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <DevicePhoneMobileIcon className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Eigen portaal</h4>
              <p className="text-sm text-slate-500">Bel, app of mail met één klik</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <ShieldCheckIcon className="mx-auto mb-4 h-10 w-10 text-brand-purple" />
              <h4 className="mb-2 font-bold text-slate-900">Quality checks</h4>
              <p className="text-sm text-slate-500">Automatische kwaliteitscontroles</p>
            </div>
          </div>
        </div>
      </section>

      {/* Portal highlights */}
      <section className="border-y border-slate-100 bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:text-[12px]">Jouw portaal</p>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Leads opvolgen was nog nooit zo makkelijk</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
            {[
              { icon: BoltIcon, accent: 'bg-brand-purple', title: 'Realtime levering', desc: 'Leads verschijnen direct in je portaal zodra ze door alle quality checks zijn.' },
              { icon: BellAlertIcon, accent: 'bg-brand-pink', title: 'Notificaties', desc: 'E-mailmeldingen en pushnotificaties bij elke nieuwe lead.' },
              { icon: PhoneIcon, accent: 'bg-brand-orange', title: 'Direct opvolgen', desc: 'Bel, WhatsApp of mail je leads met één klik vanuit het portaal.' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 md:p-6">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${item.accent}`}>
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h4 className="text-[15px] font-bold text-slate-900">{item.title}</h4>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-brand-navy py-16 md:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 top-0 h-[300px] w-[300px] rounded-full bg-brand-purple/20 blur-[120px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-5 text-center text-white lg:px-8">
          <h2 className="mb-4 text-3xl font-bold">Klaar om te starten?</h2>
          <p className="mb-8 text-lg text-white/70">
            Plan een gratis strategiegesprek en ontvang een concreet plan op maat
          </p>
          <Link
            href="/meer-klanten-nodig"
            className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
          >
            <RocketLaunchIcon className="h-5 w-5" />
            Plan strategiegesprek
            <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-5 text-[12px] font-medium text-white/40">
            Geen abonnement &bull; Geen vaste kosten &bull; Geen lock-in
          </p>
        </div>
      </section>

      </div>
      <Footer />
    </>
  );
}
