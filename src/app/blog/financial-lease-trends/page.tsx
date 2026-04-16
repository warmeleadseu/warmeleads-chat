import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  BriefcaseIcon,
  ChartBarIcon,
  FireIcon,
  BanknotesIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title:
    "Financial Lease Trends 2026: Nieuwe Kansen voor Adviseurs | WarmeLeads Blog",
  description:
    "Ontdek de financial lease trends voor 2026. Nieuwe kansen voor lease adviseurs, marktveranderingen en effectieve B2B leadgeneratie strategieën.",
  keywords:
    "financial lease trends 2026, lease adviseur leads, B2B financial lease, lease markt Nederland, financial lease leadgeneratie",
};

export default function FinancialLeaseTrendsPage() {
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
              B2B
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight md:text-5xl">
              Financial Lease Trends 2026
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Nieuwe kansen en uitdagingen voor lease adviseurs
            </p>
            <div className="mt-4 text-sm text-white/60">
              21 september 2026 • 6 min leestijd
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <div className="prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-600">
              <h2>MKB Financieringsbehoefte Groeit</h2>
              <p>
                De financial lease markt in Nederland evolueert snel. MKB
                bedrijven zoeken steeds vaker naar flexibele
                financieringsoplossingen voor investeringen in technologie,
                voertuigen en apparatuur.
              </p>

              <h3 className="not-prose flex items-center gap-2">
                <ChartBarIcon className="h-6 w-6 text-blue-500" />
                <span className="text-xl font-bold text-slate-900">Markttrends 2026</span>
              </h3>
              <div className="not-prose grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-orange-600">
                    <FireIcon className="h-5 w-5" />
                    Groeiende Sectoren
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      IT &amp; Technologie (35% groei)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      Elektrische voertuigen (50% groei)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      Productie apparatuur (25% groei)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      Kantoor inrichting (20% groei)
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-blue-600">
                    <BanknotesIcon className="h-5 w-5" />
                    Gemiddelde Lease Bedragen
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      IT Equipment: €25.000 - €100.000
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      Voertuigen: €30.000 - €80.000
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      Machines: €50.000 - €250.000
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                      Kantoor: €15.000 - €50.000
                    </li>
                  </ul>
                </div>
              </div>

              <h3 className="not-prose flex items-center gap-2">
                <BriefcaseIcon className="h-6 w-6 text-purple-500" />
                <span className="text-xl font-bold text-slate-900">B2B Leadgeneratie Strategieën</span>
              </h3>
              <p>
                Financial lease leadgeneratie vereist een andere aanpak dan B2C.
                Bedrijven hebben langere beslissingscycli maar hogere waarden.
                Focus op de juiste targeting en messaging is cruciaal.
              </p>

              <div className="not-prose rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-purple-700">
                  <BriefcaseIcon className="h-5 w-5" />
                  Targeting Criteria
                </h4>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Bedrijfsomvang:</strong> 10-500 werknemers (MKB)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Groei fase:</strong> Bedrijven in uitbreiding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Sector focus:</strong> Tech, transport, productie</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Beslissingsbevoegdheid:</strong> CFO, CEO, operations manager</span>
                  </li>
                </ul>
              </div>

              <div className="not-prose rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-amber-700">
                  <LightBulbIcon className="h-5 w-5" />
                  Expert Tip
                </h4>
                <p className="text-slate-600">
                  Financial lease leads hebben de hoogste waarde maar vereisen
                  professionele follow-up. Investeer in een goede CRM en train je
                  sales team in B2B verkoop voor maximale conversie.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">
              Start met B2B Lease Leads
            </h2>
            <p className="mb-6 text-slate-600">
              Nederlandse bedrijven zoeken financieringsoplossingen
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/leads-financial-lease"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:brightness-110"
              >
                <BriefcaseIcon className="h-5 w-5" />
                Financial Lease Leads
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
