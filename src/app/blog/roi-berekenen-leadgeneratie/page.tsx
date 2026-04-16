import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  CheckCircleIcon,
  ArrowRightIcon,
  RocketLaunchIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title:
    "ROI Berekenen van Leadgeneratie: Complete Formule Gids | WarmeLeads Blog",
  description:
    "Leer hoe je de ROI van leadgeneratie correct berekent. Complete gids met formules, voorbeelden en tips voor optimalisatie van je marketing investeringen.",
  keywords:
    "ROI leadgeneratie berekenen, lead generation ROI, marketing ROI formule, leadgeneratie rendement, ROI optimalisatie",
};

export default function ROIBerekeningPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white text-slate-900">
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-navy py-16 md:py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-purple/20 blur-[120px]" />
            <div className="absolute -right-20 top-0 h-[300px] w-[300px] rounded-full bg-brand-pink/15 blur-[100px]" />
          </div>
          <div className="relative z-10 mx-auto max-w-4xl px-5 text-center text-white lg:px-8">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:text-[12px]">
              Strategie
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight md:text-5xl">
              ROI Berekenen van Leadgeneratie
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Complete gids met formules en voorbeelden
            </p>
            <div className="mt-4 text-sm text-white/60">
              22 september 2026 • 8 min leestijd
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <h2 className="mb-4 mt-8 text-2xl font-bold text-slate-900">
              De ROI Formule
            </h2>
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <div className="mb-2 text-2xl font-bold text-green-700">
                ROI = (Omzet - Kosten) / Kosten × 100%
              </div>
              <div className="text-sm text-slate-500">
                Basis formule voor leadgeneratie ROI
              </div>
            </div>

            {/* Praktijk Voorbeeld */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <ChartBarIcon className="h-6 w-6 text-brand-orange" />
              Praktijk Voorbeeld
            </h3>
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
              <h4 className="mb-3 font-bold text-blue-700">
                Zonnepanelen Installateur
              </h4>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h5 className="mb-2 font-semibold text-green-700">
                    Investering:
                  </h5>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      50 leads × €42,50 = €2.125
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      Verkoopkosten = €500
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <strong>Totaal: €2.625</strong>
                    </li>
                  </ul>
                </div>
                <div>
                  <h5 className="mb-2 font-semibold text-blue-700">
                    Resultaat:
                  </h5>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      9 verkopen (18% conversie)
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      €12.000 gem. projectwaarde
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      <strong>Omzet: €108.000</strong>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                <div className="text-2xl font-bold text-green-700">
                  ROI: 4.014%
                </div>
                <div className="text-sm text-slate-500">
                  €40,14 return per €1 geïnvesteerd
                </div>
              </div>
            </div>

            {/* ROI Optimalisatie Tips */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <ArrowTrendingUpIcon className="h-6 w-6 text-brand-orange" />
              ROI Optimalisatie Tips
            </h3>
            <div className="mb-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-yellow-700">
                  1. Verhoog Conversiekans
                </h4>
                <p className="text-sm text-slate-600">
                  Snelle opvolging, professionele presentatie, en goede
                  kwalificatie verhogen conversie van 15% naar 25%.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-blue-700">
                  2. Optimaliseer Lead Kosten
                </h4>
                <p className="text-sm text-slate-600">
                  Kies de juiste mix van exclusieve en gedeelde leads voor je
                  situatie en budget.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-purple-700">
                  3. Verhoog Projectwaarde
                </h4>
                <p className="text-sm text-slate-600">
                  Up-sell en cross-sell mogelijkheden kunnen gemiddelde
                  projectwaarde met 30% verhogen.
                </p>
              </div>
            </div>

            {/* WarmeLeads ROI */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
                <ArrowRightIcon className="h-5 w-5 text-brand-orange" />
                WarmeLeads ROI
              </h4>
              <p className="text-slate-600">
                Onze klanten behalen gemiddeld 300-500% ROI op hun leadgeneratie
                investering. Door onze kwaliteitsgarantie en verse leads uit
                campagnes minimaliseren we je risico en maximaliseren je return.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">
              Bereken Je ROI met Onze Leads
            </h2>
            <p className="mb-6 text-slate-600">
              Start vandaag en zie je ROI groeien
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/gratis-account"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:brightness-110"
              >
                <RocketLaunchIcon className="h-5 w-5" />
                Start met leads
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Alle artikelen
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
