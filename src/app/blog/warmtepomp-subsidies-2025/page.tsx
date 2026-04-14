import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  FireIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title:
    "Warmtepomp Subsidies 2026: Impact op Leadgeneratie | WarmeLeads Blog",
  description:
    "Ontdek hoe nieuwe warmtepomp subsidies in 2026 de leadgeneratie beïnvloeden. Tips voor HVAC installateurs om hierop in te spelen en meer leads te genereren.",
  keywords:
    "warmtepomp subsidies 2026, ISDE subsidie, warmtepomp leads, HVAC subsidies Nederland, warmtepomp installateur marketing",
};

export default function WarmtepompSubsidiesPage() {
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
              Trends
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight md:text-5xl">
              Warmtepomp Subsidies 2026
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Impact op leadgeneratie en kansen voor installateurs
            </p>
            <div className="mt-4 text-sm text-white/60">
              23 september 2026 • 6 min leestijd
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <div className="prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-600">
              <h2>ISDE Subsidie 2026: Wat Verandert Er?</h2>
              <p>
                De Investeringssubsidie Duurzame Energie (ISDE) voor 2026 brengt
                belangrijke veranderingen. Voor warmtepomp installateurs betekent
                dit nieuwe kansen en uitdagingen in leadgeneratie.
              </p>

              <h3 className="not-prose flex items-center gap-2">
                <BanknotesIcon className="h-6 w-6 text-green-500" />
                <span className="text-xl font-bold text-slate-900">Nieuwe Subsidiebedragen</span>
              </h3>
              <div className="not-prose grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">€2.500</div>
                  <div className="text-sm text-slate-500">Lucht/water warmtepomp</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">€4.000</div>
                  <div className="text-sm text-slate-500">Bodem/water warmtepomp</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">€1.500</div>
                  <div className="text-sm text-slate-500">Hybride warmtepomp</div>
                </div>
              </div>

              <h3 className="not-prose flex items-center gap-2">
                <FireIcon className="h-6 w-6 text-orange-500" />
                <span className="text-xl font-bold text-slate-900">Impact op Leadgeneratie</span>
              </h3>
              <div className="not-prose rounded-xl border border-green-200 bg-green-50 p-6">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-green-700">
                  <CheckCircleIcon className="h-5 w-5" />
                  Positieve Effecten
                </h4>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-slate-900">Hogere interesse:</strong> Subsidies maken investering aantrekkelijker</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-slate-900">Snellere beslissingen:</strong> Beperkte subsidie periode creëert urgentie</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-slate-900">Bredere doelgroep:</strong> Meer huishoudens kunnen zich warmtepomp veroorloven</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-slate-900">Betere conversie:</strong> Financiële ondersteuning verhoogt commitment</span>
                  </li>
                </ul>
              </div>

              <h3 className="not-prose flex items-center gap-2">
                <ArrowTrendingUpIcon className="h-6 w-6 text-blue-500" />
                <span className="text-xl font-bold text-slate-900">Leadgeneratie Strategieën</span>
              </h3>
              <p>
                Slimme HVAC bedrijven spelen in op deze subsidie trends. Door
                subsidie-gerichte messaging in uw leadgeneratie campagnes kunt u
                de conversiekans significant verhogen.
              </p>

              <div className="not-prose rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-amber-700">
                  <LightBulbIcon className="h-5 w-5" />
                  Pro Tip
                </h4>
                <p className="text-slate-600">
                  Gebruik &quot;€4.000 subsidie nog beschikbaar&quot; in uw advertenties.
                  Dit creëert urgentie en verhoogt de klik-through rate met
                  gemiddeld 35%. Timing is alles in de subsidie periode.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">
              Profiteer van Subsidie Trends
            </h2>
            <p className="mb-6 text-slate-600">
              Onze warmtepomp leads zijn subsidie-bewust en klaar om te investeren
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/leads-warmtepompen"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:brightness-110"
              >
                <FireIcon className="h-5 w-5" />
                Warmtepomp Leads
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
