import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  CheckCircleIcon,
  ArrowRightIcon,
  RocketLaunchIcon,
  BoltIcon,
  CpuChipIcon,
  FireIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
  LightBulbIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title:
    "Thuisbatterij Trends Oktober 2026: AI Marktanalyse | WarmeLeads Blog",
  description:
    "AI-gegenereerde marktanalyse van thuisbatterij trends in oktober 2026. Actuele inzichten voor installateurs over subsidies, prijzen en kansen in Nederland.",
  keywords:
    "thuisbatterij trends oktober 2026, AI marktanalyse, battery storage Nederland, thuisbatterij installateur, energie opslag markt",
};

export default function AITestThuisbatterijTrendsPage() {
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
              AI Gegenereerd • Marktanalyse
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight md:text-5xl">
              Thuisbatterij Trends Oktober 2026
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              AI-gegenereerde marktanalyse voor installateurs
            </p>
            <div className="mt-4 text-sm text-white/60">
              26 september 2026 • 6 min leestijd
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white/80">
              <CpuChipIcon className="h-4 w-4" />
              Automatisch gegenereerd met actuele marktdata
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <h2 className="mb-4 mt-8 text-2xl font-bold text-slate-900">
              Explosieve Groei in Oktober
            </h2>
            <p className="mb-4 leading-relaxed text-slate-600">
              De thuisbatterij markt in Nederland laat in oktober 2026 ongekende
              groei zien. Met nieuwe subsidies, dalende prijzen en toenemende
              energie-onafhankelijkheidswens van consumenten, ontstaan er unieke
              kansen voor installateurs.
            </p>

            {/* Actuele Ontwikkelingen */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <FireIcon className="h-6 w-6 text-brand-orange" />
              Actuele Ontwikkelingen Oktober
            </h3>
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-green-700">
                  <CurrencyEuroIcon className="h-5 w-5" />
                  Subsidie Updates
                </h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    ISDE subsidie verhoogd naar €2.500
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    Gemeente Utrecht extra €1.000 bonus
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    BTW verlaging naar 9% overwogen
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    Energieleverancier cashback acties
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-blue-700">
                  <ChartBarIcon className="h-5 w-5" />
                  Prijsontwikkelingen
                </h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    Tesla Powerwall 3: €9.500 (-12%)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    LFP batterijen: €450/kWh (-18%)
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    Installatie kosten stabiel
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    Omvormer prijzen gedaald 8%
                  </li>
                </ul>
              </div>
            </div>

            {/* Marktcijfers */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <ChartBarIcon className="h-6 w-6 text-brand-orange" />
              Marktcijfers Oktober 2026
            </h3>
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-3xl font-bold text-green-700">+340%</div>
                  <div className="text-sm text-slate-500">
                    Groei t.o.v. oktober 2025
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-3xl font-bold text-blue-700">12.500</div>
                  <div className="text-sm text-slate-500">
                    Verkochte batterijen in oktober
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-3xl font-bold text-purple-700">
                    6,8 jaar
                  </div>
                  <div className="text-sm text-slate-500">
                    Gemiddelde terugverdientijd
                  </div>
                </div>
              </div>
            </div>

            {/* Kansen voor Installateurs */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <ArrowRightIcon className="h-6 w-6 text-brand-orange" />
              Kansen voor Installateurs
            </h3>
            <p className="mb-4 leading-relaxed text-slate-600">
              Deze ontwikkelingen creëren ongekende mogelijkheden voor
              thuisbatterij installateurs. De combinatie van subsidies,
              prijsdalingen en groeiende consumentenvraag zorgt voor een perfecte
              storm van kansen.
            </p>

            {/* Actieplan */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
                <LightBulbIcon className="h-5 w-5 text-brand-orange" />
                Actieplan Oktober
              </h4>
              <ul className="space-y-2 text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                  <span>
                    <strong>Marketing focus:</strong>{" "}
                    Energie-onafhankelijkheid messaging
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                  <span>
                    <strong>Subsidie communicatie:</strong> €2.500 besparing
                    benadrukken
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                  <span>
                    <strong>Seizoen targeting:</strong> Winter voorbereidingen
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
                  <span>
                    <strong>Cross-selling:</strong> Zonnepanelen + batterij
                    combo&apos;s
                  </span>
                </li>
              </ul>
            </div>

            {/* WarmeLeads Thuisbatterij Leads */}
            <h3 className="mb-3 mt-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <RocketLaunchIcon className="h-6 w-6 text-brand-orange" />
              WarmeLeads Thuisbatterij Leads
            </h3>
            <p className="mb-4 leading-relaxed text-slate-600">
              Onze thuisbatterij campagnes zijn geoptimaliseerd voor deze
              markttrends. We targeten specifiek op huiseigenaren met
              zonnepanelen die nu klaar zijn voor de volgende stap:
              energie-onafhankelijkheid met thuisbatterijen.
            </p>

            {/* Conversie Tip */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h4 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
                <ArrowRightIcon className="h-5 w-5 text-brand-orange" />
                Conversie Tip
              </h4>
              <p className="text-slate-600">
                Oktober is de perfecte maand voor thuisbatterij verkoop. Energie
                rekeningen stijgen, subsidies zijn beschikbaar, en consumenten
                bereiden zich voor op de winter. Onze leads hebben nu 25% hogere
                conversiekans dan in de zomer.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">
              Profiteer van de Thuisbatterij Boom
            </h2>
            <p className="mb-6 text-slate-600">
              Nederlandse huiseigenaren zijn klaar voor
              energie-onafhankelijkheid
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/gratis-account"
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
