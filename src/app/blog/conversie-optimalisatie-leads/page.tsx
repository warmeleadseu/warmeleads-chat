import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  CheckCircleIcon,
  ArrowRightIcon,
  RocketLaunchIcon,
  ExclamationTriangleIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title:
    "Conversie Optimalisatie: Van Lead naar Klant | Proven Technieken | WarmeLeads Blog",
  description:
    "Leer hoe u leadconversie maximaliseert met proven technieken. Tips voor follow-up, kwalificatie en closing van leads voor maximale ROI.",
  keywords:
    "lead conversie optimalisatie, leadconversie verhogen, sales funnel optimalisatie, lead nurturing, conversie tips",
};

export default function ConversieOptimalisatiePage() {
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
              Conversie
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight md:text-5xl">
              Conversie Optimalisatie
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Van lead naar klant: proven technieken
            </p>
            <div className="mt-4 text-sm text-white/60">
              20 september 2026 • 9 min leestijd
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <h2 className="mb-4 mt-8 text-2xl font-bold text-slate-900">
              De 5-Minuten Regel
            </h2>
            <p className="mb-4 leading-relaxed text-slate-600">
              Studies tonen aan dat leads die binnen 5 minuten worden benaderd
              een 9x hogere conversiekans hebben. Snelheid is de nummer 1 factor
              voor succesvolle leadconversie.
            </p>

            {/* Conversie Killers */}
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6">
              <h4 className="mb-3 flex items-center gap-2 font-bold text-red-700">
                <ExclamationTriangleIcon className="h-5 w-5" />
                Conversie Killers
              </h4>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  Langzame opvolging (meer dan 1 uur = 60% minder conversie)
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  Generieke emails in plaats van persoonlijk contact
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  Geen kwalificatie van de lead
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  Te agressieve verkoop in eerste contact
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                  Geen follow-up systeem
                </li>
              </ul>
            </div>

            {/* Proven Conversie Framework */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <TrophyIcon className="h-6 w-6 text-brand-orange" />
              Proven Conversie Framework
            </h3>
            <div className="mb-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-green-700">
                  1. Snelle Response (0-5 min)
                </h4>
                <p className="text-sm text-slate-600">
                  Bel direct na lead ontvangst. SMS als backup. Wees de eerste
                  die contact maakt.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-blue-700">
                  2. Kwalificatie (5-10 min)
                </h4>
                <p className="text-sm text-slate-600">
                  Stel de juiste vragen: budget, tijdlijn,
                  beslissingsbevoegdheid, specifieke behoeften.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-purple-700">
                  3. Waarde Demonstratie
                </h4>
                <p className="text-sm text-slate-600">
                  Toon concrete voordelen specifiek voor hun situatie. Gebruik
                  case studies en voorbeelden.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-yellow-700">
                  4. Soft Close
                </h4>
                <p className="text-sm text-slate-600">
                  Vraag naar volgende stap: offerte, bezichtiging, demo. Maak
                  concrete afspraken.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-bold text-pink-700">
                  5. Gestructureerde Follow-up
                </h4>
                <p className="text-sm text-slate-600">
                  Automatische follow-up sequentie met waardevolle content en
                  zachte herinneringen.
                </p>
              </div>
            </div>

            {/* WarmeLeads Voordeel */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
                <ArrowRightIcon className="h-5 w-5 text-brand-orange" />
                WarmeLeads Voordeel
              </h4>
              <p className="text-slate-600">
                Onze leads komen met interesse-niveau en beste contact tijden,
                waardoor uw eerste contact al geoptimaliseerd is voor maximale
                conversiekans. Dit geeft u een voorsprong op de concurrentie.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">
              Optimaliseer Uw Conversie
            </h2>
            <p className="mb-6 text-slate-600">
              Start met kwaliteitsleads die klaar zijn om te converteren
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/gratis-account"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:brightness-110"
              >
                <RocketLaunchIcon className="h-5 w-5" />
                Start met Leads
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
