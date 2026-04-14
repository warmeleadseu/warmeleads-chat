import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title:
    "Hoe Herken je Kwaliteit Zonnepanelen Leads? | Expert Tips | WarmeLeads Blog",
  description:
    "Leer hoe je kwaliteit zonnepanelen leads herkent. Expert tips voor solar installateurs over lead verificatie, kwaliteitsindicatoren en ROI optimalisatie.",
  keywords:
    "zonnepanelen leads kwaliteit, solar leads verificatie, kwaliteitsleads herkennen, zonnepaneel prospects, lead kwaliteit beoordelen",
};

export default function ZonnepanelenLeadsKwaliteitPage() {
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
              Tips &amp; Tricks
            </p>
            <h1 className="mb-4 text-3xl font-bold leading-tight md:text-5xl">
              Hoe Herken je Kwaliteit Zonnepanelen Leads?
            </h1>
            <p className="text-lg text-white/80 md:text-xl">
              Expert tips voor solar installateurs
            </p>
            <div className="mt-4 text-sm text-white/60">
              24 september 2026 • 7 min leestijd
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 lg:px-8">
            <div className="prose prose-lg max-w-none prose-headings:text-slate-900 prose-p:text-slate-600">
              <h2>Kwaliteitsindicatoren voor Solar Leads</h2>
              <p>
                Niet alle zonnepanelen leads zijn gelijk. Als solar installateur
                is het cruciaal om kwaliteitsleads te herkennen voordat u tijd en
                geld investeert in follow-up. Hier zijn de belangrijkste
                indicatoren.
              </p>

              <h3 className="not-prose flex items-center gap-2">
                <SunIcon className="h-6 w-6 text-amber-500" />
                <span className="text-xl font-bold text-slate-900">Primaire Kwaliteitsfactoren</span>
              </h3>
              <div className="not-prose rounded-xl border border-slate-200 bg-slate-50 p-6">
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-green-700">Huiseigenaarschap:</strong> Alleen eigenaren kunnen beslissen over installatie</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-green-700">Dakgeschiktheid:</strong> Zuid/zuidwest oriëntatie, geen schaduw</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-green-700">Budget indicatie:</strong> Realistische investeringsbereidheid</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-green-700">Tijdlijn:</strong> Concrete plannen binnen 6 maanden</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                    <span><strong className="text-green-700">Contact bereidheid:</strong> Telefonisch bereikbaar</span>
                  </li>
                </ul>
              </div>

              <h3 className="not-prose flex items-center gap-2">
                <MagnifyingGlassIcon className="h-6 w-6 text-blue-500" />
                <span className="text-xl font-bold text-slate-900">Verificatie Checklist</span>
              </h3>
              <div className="not-prose grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-green-700">
                    <CheckCircleIcon className="h-5 w-5" />
                    Goede Leads
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                      Volledige contactgegevens
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                      Specifieke interesse in solar
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                      Budget tussen €8.000-€25.000
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                      Eigen woning, geen huur
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-500" />
                      Actieve zoekfase (binnen 3 maanden)
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h4 className="mb-3 flex items-center gap-2 font-bold text-red-700">
                    <XCircleIcon className="h-5 w-5" />
                    Slechte Leads
                  </h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                      Incomplete gegevens
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                      Alleen &quot;informatie&quot; interesse
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                      Geen budget genoemd
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                      Huurwoning of onzeker
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                      Vage tijdlijn of &quot;ooit&quot;
                    </li>
                  </ul>
                </div>
              </div>

              <h3 className="not-prose flex items-center gap-2">
                <ChartBarIcon className="h-6 w-6 text-purple-500" />
                <span className="text-xl font-bold text-slate-900">WarmeLeads Kwaliteitsgarantie</span>
              </h3>
              <p>
                Bij WarmeLeads screenen wij alle leads op deze
                kwaliteitsfactoren voordat ze naar u worden gestuurd. Onze leads
                hebben een gemiddelde conversiekans van 18-25% omdat we alleen
                prospects doorsturen die voldoen aan strenge
                kwaliteitscriteria.
              </p>

              <div className="not-prose rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h4 className="mb-3 flex items-center gap-2 font-bold text-amber-700">
                  <LightBulbIcon className="h-5 w-5" />
                  Expert Tip
                </h4>
                <p className="text-slate-600">
                  Bel zonnepanelen leads binnen 5 minuten na ontvangst. Studies
                  tonen aan dat de conversiekans met 80% daalt na de eerste 10
                  minuten. Snelheid is cruciaal in de solar markt.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-slate-50 py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-5 text-center lg:px-8">
            <h2 className="mb-3 text-2xl font-bold text-slate-900">
              Klaar voor Kwaliteit Solar Leads?
            </h2>
            <p className="mb-6 text-slate-600">
              Ontvang alleen gescreende, hoogwaardige zonnepanelen prospects
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/leads-zonnepanelen"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:brightness-110"
              >
                <SunIcon className="h-5 w-5" />
                Zonnepanelen Leads
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
