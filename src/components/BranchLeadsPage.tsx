'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  SparklesIcon,
  UserGroupIcon,
  BoltIcon,
  GlobeEuropeAfricaIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ArrowRightIcon,
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

      {/* SEO Hidden Content */}
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
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Exclusieve Leads Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition hover:shadow-md">
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
                    <span className="text-slate-700">100% exclusief voor uw bedrijf</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Geen concurrentie</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Maximale conversiekans</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Realtime uit campagnes</span>
                  </li>
                </ul>
                <a
                  href="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 hover:brightness-110"
                >
                  Start met exclusieve leads
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Gedeelde Leads Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition hover:shadow-md">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple/10">
                  <UserGroupIcon className="h-7 w-7 text-brand-purple" />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Gedeelde leads</h3>
                <div className="mb-1 text-4xl font-bold text-brand-purple">{metadata.sharedPrice}</div>
                <div className="mb-6 text-sm text-slate-500">per lead (min. 100)</div>
                <ul className="mb-8 space-y-3 text-left">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Gedeeld met max 2 anderen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Zeer kosteneffectief</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Perfect om te starten</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-brand-orange" />
                    <span className="text-slate-700">Hoge kwaliteit prospects</span>
                  </li>
                </ul>
                <a
                  href="/"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30 hover:brightness-110"
                >
                  Start met gedeelde leads
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
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
            Wij leveren verse, kwalitatieve leads uit eigen campagnes
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <BoltIcon className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Verse leads</h4>
              <p className="text-sm text-slate-500">Direct uit campagnes</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <GlobeEuropeAfricaIcon className="mx-auto mb-4 h-10 w-10 text-brand-purple" />
              <h4 className="mb-2 font-bold text-slate-900">Nederlandse markt</h4>
              <p className="text-sm text-slate-500">100% Nederlandse prospects</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <ChartBarIcon className="mx-auto mb-4 h-10 w-10 text-brand-orange" />
              <h4 className="mb-2 font-bold text-slate-900">Realtime dashboard</h4>
              <p className="text-sm text-slate-500">Live updates</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <ShieldCheckIcon className="mx-auto mb-4 h-10 w-10 text-brand-purple" />
              <h4 className="mb-2 font-bold text-slate-900">Kwaliteitsgarantie</h4>
              <p className="text-sm text-slate-500">30 dagen geld terug</p>
            </div>
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
            Ontvang vandaag nog uw eerste verse prospects
          </p>
          <a
            href="/"
            className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
          >
            <RocketLaunchIcon className="h-5 w-5" />
            Start direct met leads
            <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
        </div>
      </section>

      </div>
      <Footer />
    </>
  );
}
