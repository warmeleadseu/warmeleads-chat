import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckBadgeIcon,
  ClockIcon,
  ShieldCheckIcon,
  CurrencyEuroIcon,
  BoltIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  WrenchScrewdriverIcon,
  HandThumbDownIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Meer Klanten Nodig? | Directe Leads voor Installateurs | WarmeLeads",
  description:
    "Meer klanten nodig voor uw installatiebedrijf? Krijg verse, exclusieve leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco's binnen 15 minuten. Geen abonnement, betaal per klant.",
  keywords:
    "meer klanten nodig, klanten werven, nieuwe klanten krijgen, klanten vinden, meer opdrachten, installateur leads, duurzame energie klanten, klantacquisitie, klantenwerving",
  openGraph: {
    title: "Meer Klanten Nodig? | Verse Leads Binnen 15 Minuten",
    description:
      "Direct nieuwe klanten voor uw installatiebedrijf. Exclusieve leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco's.",
    url: "https://www.warmeleads.eu/meer-klanten-nodig",
    type: "website",
  },
};

export default function MeerKlantenNodigPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white text-slate-900">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 bottom-0 h-[400px] w-[400px] rounded-full bg-brand-purple/20 blur-[120px]" />
          <div className="absolute left-1/3 top-0 h-[300px] w-[300px] rounded-full bg-brand-pink/10 blur-[100px]" />
          <div className="absolute -right-20 top-1/4 h-[250px] w-[250px] rounded-full bg-brand-orange/10 blur-[80px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-14 md:pb-24 md:pt-24 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur md:mb-5 md:px-4 md:text-[12px]">
              <SparklesIcon className="h-3.5 w-3.5 text-brand-orange" />
              Voor installatiebedrijven
            </p>

            <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.5rem] md:text-[3.75rem] lg:text-[4.25rem]">
              Meer klanten nodig?{" "}
              <span className="gradient-text">
                Krijg ze binnen 15 minuten.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70 md:mt-6 md:text-lg">
              Als installateur in duurzame energie weet je: nieuwe klanten
              betekent groei. Stop met zoeken &mdash; wij leveren ze direct aan
              je.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/#lead-form"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Start nu met leads
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#waarom-wij"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Waarom WarmeLeads
              </a>
            </div>
          </div>

          {/* Hero metrics */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 md:mt-14 lg:max-w-3xl">
            {[
              { value: "15 min", label: "Levertijd", icon: ClockIcon },
              { value: "100%", label: "Exclusief", icon: ShieldCheckIcon },
              { value: "\u20AC0", label: "Vaste kosten", icon: CurrencyEuroIcon },
              { value: "24/7", label: "Beschikbaar", icon: BoltIcon },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl bg-white/[0.07] px-4 py-3 backdrop-blur md:gap-4 md:px-5 md:py-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 md:h-10 md:w-10">
                  <item.icon className="h-4 w-4 text-brand-orange md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white md:text-xl">
                    {item.value}
                  </p>
                  <p className="text-[11px] text-white/60 md:text-[12px]">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem section ── */}
      <section className="bg-gradient-to-b from-white to-orange-50/40">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
              De uitdaging
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Herken je dit?
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500 md:mt-4 md:text-[16px]">
              De grootste uitdagingen voor installateurs bij het vinden van
              nieuwe klanten.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            {[
              {
                title: "Te weinig klanten",
                description:
                  "Je hebt capaciteit, je monteurs staan klaar, maar de telefoon gaat niet over. Google Ads is duur en levert weinig op. Mond-tot-mond reclame duurt te lang.",
                icon: ExclamationTriangleIcon,
                accent: "bg-brand-purple",
              },
              {
                title: "Marketing is duur",
                description:
                  "\u20AC3.000\u2013\u20AC5.000 per maand aan Google Ads? SEO duurt maanden? Social media advertenties die niet converteren? Er moet een betere manier zijn.",
                icon: MegaphoneIcon,
                accent: "bg-brand-pink",
              },
              {
                title: "Geen tijd voor acquisitie",
                description:
                  "Je bent installateur, geen marketeer. Je wilt installeren, niet urenlang campagnes opzetten, content maken en social media beheren.",
                icon: WrenchScrewdriverIcon,
                accent: "bg-brand-orange",
              },
              {
                title: "Slechte lead kwaliteit",
                description:
                  "Je krijgt wel leads, maar het zijn trekkers, prijsvechters of mensen die 'nog even nadenken'. Je wilt serieuze prospects die nu willen kopen.",
                icon: HandThumbDownIcon,
                accent: "bg-brand-navy",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-7"
              >
                <div
                  className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg md:mb-5 md:h-11 md:w-11 ${item.accent}`}
                >
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:mt-2 md:text-sm">
                  {item.description}
                </p>
                <div
                  className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`}
                />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution section ── */}
      <section
        id="waarom-wij"
        className="border-y border-slate-100 bg-slate-50"
      >
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
              De oplossing
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Wij doen het zware werk.{" "}
              <span className="text-slate-500">Jij installeert en verdient.</span>
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              {
                title: "15 minuten levertijd",
                description:
                  "Bestel nu, ontvang leads binnen 15 minuten. Niet morgen, niet volgende week. Nu.",
                icon: ClockIcon,
                accent: "bg-brand-purple",
              },
              {
                title: "100% exclusief",
                description:
                  "Jouw lead is jouw klant. Geen concurrentie, geen prijsgevecht. Alleen jij krijgt de lead.",
                icon: ShieldCheckIcon,
                accent: "bg-brand-pink",
              },
              {
                title: "Geen vaste kosten",
                description:
                  "Betaal alleen voor leads die je afneemt. Geen abonnement, geen verrassingen.",
                icon: CurrencyEuroIcon,
                accent: "bg-brand-orange",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:p-7"
              >
                <div
                  className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg md:mb-5 md:h-11 md:w-11 ${item.accent}`}
                >
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 md:mt-2 md:text-sm">
                  {item.description}
                </p>
                <div
                  className={`absolute bottom-0 left-0 h-[3px] w-full ${item.accent} opacity-0 transition-opacity group-hover:opacity-100`}
                />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">
              Hoe het werkt
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Drie stappen naar meer klanten.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-white/50 md:mt-4 md:text-[16px]">
              Simpel, transparant en direct resultaat.
            </p>
          </div>

          <div className="relative grid gap-4 md:grid-cols-3 md:gap-0">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 hidden -translate-y-1/2 md:block">
              <div className="mx-auto h-px w-[calc(100%-120px)] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {[
              {
                step: "01",
                title: "Kies je product",
                description:
                  "Thuisbatterijen, zonnepanelen, warmtepompen of airco's \u2014 selecteer wat je wilt installeren en geef je regio door.",
              },
              {
                step: "02",
                title: "Ontvang leads binnen 15 min",
                description:
                  "Direct na bestelling krijg je verse leads. Naam, telefoonnummer, e-mail, interesse \u2014 alles wat je nodig hebt.",
              },
              {
                step: "03",
                title: "Bel, verkoop, installeer",
                description:
                  "Neem contact op, plan een afspraak in en sluit de deal. Jij focust op je vak, wij zorgen voor de instroom.",
              },
            ].map((item, i) => (
              <article
                key={item.step}
                className="group relative z-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:bg-white/[0.08] md:mx-2 md:p-7"
              >
                <p className="absolute -right-2 -top-4 select-none text-[60px] font-black leading-none text-white/[0.04] md:text-[80px]">
                  {item.step}
                </p>
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-3 md:mb-5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange text-[13px] font-bold text-slate-950">
                      {item.step}
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <h3 className="text-[16px] font-bold md:text-lg">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 md:mt-2 md:text-sm">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center md:mt-14">
            <Link
              href="/#lead-form"
              className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-8 py-4 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110 md:text-base"
            >
              Start nu &mdash; eerste lead binnen 15 min
              <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-slate-50">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-orange-50/60 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
              Wat klanten zeggen
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Waarom installateurs voor ons kiezen.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              {
                quote:
                  "Eindelijk meer klanten zonder dat ik duizenden euro's moet uitgeven aan marketing. WarmeLeads heeft mijn bedrijf een boost gegeven.",
                name: "Jan V.",
                role: "Zonnepanelen Installateur",
              },
              {
                quote:
                  "Binnen 2 weken had ik 3 installaties geboekt. ROI was 5x. Dit is de beste investering die ik ooit heb gedaan.",
                name: "Mark D.",
                role: "Warmtepomp Specialist",
              },
              {
                quote:
                  "De leads zijn echt exclusief. Geen gedoe met 5 andere bedrijven die dezelfde klant bellen. Precies wat we nodig hadden.",
                name: "Piet K.",
                role: "Thuisbatterij Installateur",
              },
            ].map((item) => (
              <div
                key={item.name}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
              >
                <div className="mb-3 flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <StarIconSolid
                      key={i}
                      className="h-3.5 w-3.5 text-brand-orange"
                    />
                  ))}
                </div>
                <p className="text-[13px] leading-relaxed text-slate-700 md:text-sm">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                    {item.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-400">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Metrics strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:grid-cols-4 md:gap-4">
            {[
              { value: "500+", label: "Leads per maand" },
              { value: "40+", label: "Actieve klanten" },
              { value: "5x", label: "Gemiddelde ROI" },
              { value: "4.8", label: "Klantwaardering" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-center shadow-sm md:py-5"
              >
                <p className="text-2xl font-extrabold text-brand-navy md:text-3xl">
                  {item.value}
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 md:text-[12px]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-1/4 h-[400px] w-[400px] rounded-full bg-brand-purple/15 blur-[120px]" />
          <div className="absolute -right-20 bottom-0 h-[300px] w-[300px] rounded-full bg-brand-pink/10 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">
              FAQ
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
              Veelgestelde vragen
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/50 md:text-[15px]">
              Alles wat je wilt weten over onze leads en werkwijze.
            </p>
          </div>

          <div className="space-y-2.5 md:space-y-3">
            {[
              {
                q: "Hoeveel kosten leads?",
                a: "Prijzen vari\u00EBren per producttype. Thuisbatterij leads vanaf \u20AC40, zonnepanelen vanaf \u20AC25, warmtepompen vanaf \u20AC35. Geen abonnement \u2014 betaal alleen wat je afneemt.",
              },
              {
                q: "Zijn de leads echt exclusief?",
                a: "Ja. Bij exclusieve leads ben jij de enige die de lead ontvangt. Geen concurrentie, geen prijsgevecht. We bieden ook gedeelde leads (goedkoper) als je dat prefereert.",
              },
              {
                q: "Hoe snel ontvang ik leads?",
                a: "Binnen 15 minuten na bestelling. We leveren realtime uit onze campagnes.",
              },
              {
                q: "Wat als een lead niet reageert?",
                a: "Alle leads zijn geverifieerd en recent. We garanderen dat contactgegevens kloppen. Tip: bel binnen 5 minuten voor het beste resultaat.",
              },
              {
                q: "Is er een minimum afname?",
                a: "Nee. Neem 1 lead of 100 leads. Geen verplichtingen, geen abonnement. Jij bepaalt wanneer en hoeveel.",
              },
              {
                q: "Zit ik vast aan een contract?",
                a: "Nee. We werken zonder lock-in. Je kunt maandelijks opschalen, afschalen of stoppen. Ons verdienmodel is gebaseerd op resultaat, niet op binding.",
              },
            ].map((item, i) => (
              <details key={item.q} className="group rounded-xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm transition-colors open:border-brand-purple/30 open:bg-white/[0.07]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-purple/20 text-[12px] font-bold text-brand-purple md:h-8 md:w-8 md:text-[13px]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[14px] font-semibold text-white/90 md:text-[15px]">{item.q}</span>
                  </div>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 transition-all duration-200 group-open:rotate-45 group-open:border-brand-orange/40 group-open:bg-brand-orange/10">
                    <svg className="h-3 w-3 text-white/50 transition-colors group-open:text-brand-orange" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2">
                      <path d="M6 1v10M1 6h10" />
                    </svg>
                  </span>
                </summary>
                <div className="border-t border-white/[0.06] px-4 pb-4 pt-3.5 text-[13px] leading-relaxed text-white/55 md:px-6 md:pb-5 md:pt-4 md:text-sm md:pl-[4.25rem]">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 top-0 h-[300px] w-[300px] rounded-full bg-brand-purple/30 blur-[100px] md:h-[400px] md:w-[400px]" />
          <div className="absolute -left-20 bottom-0 h-[200px] w-[200px] rounded-full bg-brand-orange/20 blur-[80px] md:h-[300px] md:w-[300px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-5 py-14 text-white md:py-20 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Klaar voor meer klanten?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70 md:mt-4 md:text-lg">
              Stop met zoeken. Start met groeien. Je eerste lead kan er over 15
              minuten zijn &mdash; zonder abonnement, zonder vaste kosten.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/#lead-form"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Ja, ik wil meer klanten
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/maatwerk-leads"
                className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Bekijk aanpak en pricing
              </Link>
            </div>
            <p className="mt-5 text-[12px] font-medium text-white/40 md:mt-6">
              Geen abonnement &bull; Geen vaste kosten &bull; 100% exclusief
            </p>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </>
  );
}
