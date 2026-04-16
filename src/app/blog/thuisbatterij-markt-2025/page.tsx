import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  BoltIcon,
  CheckCircleIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title:
    "Thuisbatterij Markt Nederland 2026: Explosieve Groei en Kansen | WarmeLeads Blog",
  description:
    "De thuisbatterij markt in Nederland groeit explosief in 2026. Ontdek de kansen voor installateurs, markttrends en effectieve leadgeneratie strategieën.",
  keywords:
    "thuisbatterij markt 2026, battery storage Nederland, thuisbatterij installateur, energieopslag trends, thuisbatterij leads",
};

export default function ThuisbatterijMarktBlogPage() {
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
              Marktanalyse
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight md:text-5xl">
              Thuisbatterij Markt Nederland 2026
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Explosieve groei en kansen voor installateurs
            </p>
            <div className="mt-4 text-sm text-white/60">
              25 september 2026 • 5 min leestijd
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <div className="prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-600">
              <h2>Waarom Explodeert de Thuisbatterij Markt?</h2>
              <p>
                De thuisbatterij markt in Nederland staat op het punt van een
                explosieve groei. Met stijgende energieprijzen, de groei van
                zonnepanelen en de focus op energie-onafhankelijkheid, zoeken
                steeds meer huiseigenaren naar thuisbatterij oplossingen.
              </p>

              <h3>Marktcijfers 2026</h3>
              <div className="not-prose grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">+340%</div>
                  <div className="text-sm text-slate-500">Groei t.o.v. 2024</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">€2.1B</div>
                  <div className="text-sm text-slate-500">Marktwaarde 2026</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">85%</div>
                  <div className="text-sm text-slate-500">Heeft zonnepanelen</div>
                </div>
              </div>

              <h3>Kansen voor Installateurs</h3>
              <p>
                Voor thuisbatterij installateurs betekent deze groei ongekende
                kansen. De vraag overtreft momenteel het aanbod, wat zorgt voor
                hoge marges en veel werk. Maar alleen bedrijven met een sterke
                leadgeneratie strategie kunnen hiervan profiteren.
              </p>

              <h3>Effectieve Leadgeneratie Strategieën</h3>
              <div className="not-prose rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-green-700">
                  <CheckCircleIcon className="h-5 w-5" />
                  Wat Werkt
                </h4>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Gerichte campagnes</strong> op huiseigenaren met zonnepanelen</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Energie-onafhankelijkheid messaging</strong> in advertenties</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Lokale targeting</strong> op Nederlandse regio&apos;s</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Seizoensgebonden campagnes</strong> (winter = hoge energierekeningen)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span><strong className="text-slate-900">Retargeting</strong> van zonnepaneel website bezoekers</span>
                  </li>
                </ul>
              </div>

              <h3>WarmeLeads Aanpak</h3>
              <p>
                Bij WarmeLeads hebben we deze strategieën geperfectioneerd. Onze
                thuisbatterij campagnes targeten specifiek op huiseigenaren die al
                zonnepanelen hebben en nu hun energie-onafhankelijkheid willen
                uitbreiden. Dit resulteert in leads met een conversiekans van
                15-25%.
              </p>

              <div className="not-prose rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-amber-700">
                  <LightBulbIcon className="h-5 w-5" />
                  Pro Tip
                </h4>
                <p className="text-slate-600">
                  De beste tijd voor thuisbatterij leads is oktober-maart, wanneer
                  energierekeningen het hoogst zijn. Plan je leadgeneratie budget
                  strategisch rond deze periode voor maximale ROI.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">
              Klaar voor Thuisbatterij Leads?
            </h2>
            <p className="mb-6 text-slate-600">
              Profiteer van de groeiende markt met onze verse leads
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/leads-thuisbatterijen"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:brightness-110"
              >
                <BoltIcon className="h-5 w-5" />
                Thuisbatterij Leads
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
