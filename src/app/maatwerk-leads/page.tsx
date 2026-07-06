import Link from 'next/link';
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  BoltIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  HomeModernIcon,
  LightBulbIcon,
  MapPinIcon,
  ClipboardDocumentListIcon,
  RocketLaunchIcon,
  CheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SoftGlow } from '@/components/ui/SoftGlow';

export const metadata = {
  title: 'Maatwerk Leadgeneratie | Custom Lead Campaigns | Warmeleads.eu',
  description:
    'Op maat gemaakte leadgeneratie campagnes voor jouw specifieke branche. Van niche markten tot grootschalige B2B campagnes. Exclusieve leads op basis van jouw wensen.',
  alternates: { canonical: '/maatwerk-leads' },
};

export default function MaatwerkLeadsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white text-slate-900">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <SoftGlow color="purple" className="-left-20 bottom-0" size="420px" intensity={0.22} />
          <SoftGlow color="pink" className="right-1/4 top-0" size="320px" intensity={0.14} />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-14 pt-14 md:pb-24 md:pt-24 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 md:mb-5 md:text-[12px]">
              <SparklesIcon className="h-3.5 w-3.5 text-brand-orange" />
              Custom leadgeneratie
            </p>

            <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.5rem] md:text-[3.75rem]">
              Maatwerk leadgeneratie{' '}
              <span className="gradient-text">voor jouw branche.</span>
            </h1>

            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70 md:mt-6 md:text-lg">
              Werk je in een niche markt? Heb je specifieke targeting wensen? Wij
              ontwikkelen custom leadgeneratie campagnes volledig afgestemd op jouw
              bedrijf, doelgroep en regio.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/plan-gesprek"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Bespreek je maatwerk campagne
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Hero metrics */}
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mt-14 md:gap-4 lg:max-w-3xl">
            {[
              { value: '100%', label: 'Op maat ontwikkeld', icon: AdjustmentsHorizontalIcon },
              { value: '8+', label: 'Actieve niches', icon: MagnifyingGlassIcon },
              { value: 'NL & BE', label: 'Volledige dekking', icon: MapPinIcon },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-xl bg-white/[0.09] px-4 py-3 md:gap-4 md:px-5 md:py-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 md:h-10 md:w-10">
                  <item.icon className="h-4 w-4 text-brand-orange md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white md:text-xl">{item.value}</p>
                  <p className="text-[11px] text-white/60 md:text-[12px]">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="bg-gradient-to-b from-white to-orange-50/40">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
              Waarom maatwerk
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Geen standaard aanpak.{' '}
              <span className="text-slate-500">Wél bewezen resultaat.</span>
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-500 md:mt-4 md:text-[16px]">
              Elke branche is anders. Daarom bouwen we elke campagne vanaf de grond
              op, afgestemd op jouw doelgroep, propositie en markt.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              {
                title: '100% Op Maat',
                description:
                  'Elke campagne wordt speciaal voor jou ontwikkeld. Van messaging tot targeting, alles afgestemd op jouw doelgroep en markt.',
                icon: AdjustmentsHorizontalIcon,
                accent: 'bg-brand-purple',
              },
              {
                title: 'Niche Expertise',
                description:
                  'Ook voor specialistische branches en nichemarkten ontwikkelen wij effectieve leadgeneratie strategieën die resultaat opleveren.',
                icon: MagnifyingGlassIcon,
                accent: 'bg-brand-pink',
              },
              {
                title: 'Data-Driven',
                description:
                  'Continue optimalisatie op basis van real-time data en performance metrics. Jouw ROI staat centraal.',
                icon: ChartBarIcon,
                accent: 'bg-brand-orange',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg md:p-7"
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

      {/* ── Use Cases ── */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 text-center md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-pink md:mb-3 md:text-[12px]">
              Toepassingen
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Perfect voor deze markten
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-slate-500 md:mt-4 md:text-[16px]">
              Van industriële B2B tot premium consumentenmarkten. Onze maatwerk
              aanpak levert in elke niche.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:gap-5">
            {[
              {
                title: 'Specialistische B2B',
                description:
                  'Industriële installaties, technische dienstverlening, zakelijke oplossingen',
                icon: BuildingOffice2Icon,
                accent: 'bg-brand-navy',
              },
              {
                title: 'Premium B2C',
                description:
                  'Luxe renovaties, exclusieve producten, high-end diensten',
                icon: HomeModernIcon,
                accent: 'bg-brand-purple',
              },
              {
                title: 'Nieuwe Markten',
                description:
                  'Innovatieve producten, emerging technologies, nieuwe branches',
                icon: LightBulbIcon,
                accent: 'bg-brand-pink',
              },
              {
                title: 'Regionale Focus',
                description:
                  'Hyper-local targeting, specifieke regio\'s of gemeentes',
                icon: MapPinIcon,
                accent: 'bg-brand-orange',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.accent}`}
                >
                  <item.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900 md:text-[16px]">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-600 md:text-sm">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Deliver ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-purple md:mb-3 md:text-[12px]">
              Wat je krijgt
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Compleet pakket.{' '}
              <span className="text-slate-500">Van strategie tot resultaat.</span>
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple md:mb-5 md:h-11 md:w-11">
                <ClipboardDocumentListIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">
                Strategie &amp; Planning
              </h3>
              <ul className="mt-4 space-y-2.5">
                {[
                  'Marktanalyse voor jouw sector',
                  'Campagne strategie ontwikkeling',
                  'Targeting optimalisatie',
                  'ROI maximalisatie',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-700 md:text-sm">
                    <CheckIcon className="h-4 w-4 shrink-0 text-brand-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-pink md:mb-5 md:h-11 md:w-11">
                <RocketLaunchIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 md:text-lg">
                Uitvoering &amp; Support
              </h3>
              <ul className="mt-4 space-y-2.5">
                {[
                  'Custom creatives & landing pages',
                  'Multi-channel campagnes',
                  'Dedicated account manager',
                  'Maandelijkse rapportages',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[13px] text-slate-700 md:text-sm">
                    <CheckIcon className="h-4 w-4 shrink-0 text-brand-orange" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Process ── */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
          <div className="mb-8 max-w-2xl md:mb-12">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">
              Ons proces
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Van intake naar resultaat in vier stappen.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-white/50 md:mt-4 md:text-[16px]">
              Gestructureerd, transparant en altijd gericht op meetbaar rendement.
            </p>
          </div>

          <div className="relative grid gap-4 md:grid-cols-4 md:gap-0">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 hidden -translate-y-1/2 md:block">
              <div className="mx-auto h-px w-[calc(100%-120px)] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {[
              {
                step: '01',
                title: 'Intake',
                description: 'Analyse van je doelgroep, markt en gewenst volume. Je krijgt een helder plan.',
                icon: ClipboardDocumentListIcon,
              },
              {
                step: '02',
                title: 'Campagne Design',
                description: 'Custom creatives, messaging en targeting op basis van jouw propositie.',
                icon: AdjustmentsHorizontalIcon,
              },
              {
                step: '03',
                title: 'Launch',
                description: 'Campagne activatie en directe levering van leads. Klaar in 24-72 uur.',
                icon: RocketLaunchIcon,
              },
              {
                step: '04',
                title: 'Optimalisatie',
                description: 'Continue verbetering op data, kwaliteit en conversie. Je stuurt mee.',
                icon: ChartBarIcon,
              },
            ].map((item) => (
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
                  <h3 className="text-[16px] font-bold md:text-lg">{item.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 md:mt-2 md:text-sm">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden bg-brand-navy">
        <div className="pointer-events-none absolute inset-0">
          <SoftGlow color="purple" className="-right-32 top-0" size="420px" intensity={0.3} showOnMobile />
          <SoftGlow color="orange" className="-left-20 bottom-0 hidden md:block" size="320px" intensity={0.22} showOnMobile />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-5 py-14 text-white md:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange md:mb-3 md:text-[12px]">
              Aan de slag
            </p>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Laten we je campagne bespreken
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70 md:mt-4 md:text-lg">
              Vertel ons over jouw branche en wij maken de perfecte leadgeneratie
              strategie. Volledig op maat, zonder verplichtingen.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
              <Link
                href="/plan-gesprek"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-button-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-orange/30 transition hover:shadow-brand-orange/40 hover:brightness-110"
              >
                Bespreek maatwerk leads
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/15 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
              >
                Terug naar overzicht
              </Link>
            </div>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </>
  );
}
