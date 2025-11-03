import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircleIcon, ClockIcon, ShieldCheckIcon, CurrencyEuroIcon, BoltIcon, UserGroupIcon } from "@heroicons/react/24/outline";

export const metadata: Metadata = {
  title: "Meer Klanten Nodig? | Directe Leads voor Installateurs | WarmeLeads",
  description: "Meer klanten nodig voor uw installatiebedrijf? Krijg verse, exclusieve leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco's binnen 15 minuten. Geen abonnement, betaal per klant.",
  keywords: "meer klanten nodig, klanten werven, nieuwe klanten krijgen, klanten vinden, meer opdrachten, installateur leads, duurzame energie klanten, klantacquisitie, klantenwerving",
  openGraph: {
    title: "Meer Klanten Nodig? | Verse Leads Binnen 15 Minuten",
    description: "Direct nieuwe klanten voor uw installatiebedrijf. Exclusieve leads voor thuisbatterijen, zonnepanelen, warmtepompen en airco's.",
    url: "https://www.warmeleads.eu/meer-klanten-nodig",
    type: "website"
  }
};

export default function MeerKlantenNodigPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Meer Klanten Nodig? 🚀<br />
              <span className="text-orange-200">Krijg ze binnen 15 minuten</span>
            </h1>
            <p className="text-xl md:text-2xl text-orange-100 mb-8 leading-relaxed">
              Als installateur in duurzame energie weet je: nieuwe klanten = groei.<br />
              Stop met zoeken. <strong className="text-white">Wij leveren ze direct aan je</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/#lead-form"
                className="bg-white text-orange-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-orange-50 transition-all shadow-2xl hover:scale-105"
              >
                🔥 Start nu met leads
              </Link>
              <a 
                href="#waarom-wij"
                className="bg-orange-500/20 backdrop-blur-sm border-2 border-white text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-orange-500/30 transition-all"
              >
                Waarom WarmeLeads?
              </a>
            </div>
            
            {/* Trust Indicators */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold">15 min</div>
                <div className="text-sm text-orange-200">Levertijd</div>
              </div>
              <div>
                <div className="text-3xl font-bold">100%</div>
                <div className="text-sm text-orange-200">Exclusief</div>
              </div>
              <div>
                <div className="text-3xl font-bold">€0</div>
                <div className="text-sm text-orange-200">Vaste kosten</div>
              </div>
              <div>
                <div className="text-3xl font-bold">24/7</div>
                <div className="text-sm text-orange-200">Beschikbaar</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Probleem Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Herken Je Dit? 😓
          </h2>
          <p className="text-xl text-gray-600">
            De grootste uitdagingen voor installateurs
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8">
            <div className="text-4xl mb-4">❌</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Te weinig klanten</h3>
            <p className="text-gray-700">
              Je hebt capaciteit, je monteurs staan klaar, maar de telefoon gaat niet over. 
              Google Ads is duur en levert weinig op. Mond-tot-mond reclame duurt té lang.
            </p>
          </div>

          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8">
            <div className="text-4xl mb-4">💸</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Marketing is Duur</h3>
            <p className="text-gray-700">
              €3.000-€5.000 per maand aan Google Ads? SEO duurt maanden? Social media advertenties 
              die niet converteren? Er moet een betere manier zijn...
            </p>
          </div>

          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8">
            <div className="text-4xl mb-4">⏰</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Geen tijd voor acquisitie</h3>
            <p className="text-gray-700">
              Je bent installateur, geen marketeer. Je wilt installeren, niet urenlang campagnes 
              opzetten, content maken en social media beheren.
            </p>
          </div>

          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Slechte lead kwaliteit</h3>
            <p className="text-gray-700">
              Je krijgt wel leads, maar het zijn trekkers, prijsvechters of mensen die "nog even 
              nadenken". Je wilt serieuze prospects die nu willen kopen.
            </p>
          </div>
        </div>
      </div>

      {/* Oplossing Section */}
      <div id="waarom-wij" className="bg-gradient-to-br from-green-50 to-emerald-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              De Oplossing: WarmeLeads ✅
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Wij doen het zware werk. Jij installeert en verdient.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-green-200 hover:border-green-400 transition-all">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <ClockIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">15 Minuten Levertijd</h3>
              <p className="text-gray-700 leading-relaxed">
                Bestel nu, ontvang leads binnen 15 minuten. Niet morgen, niet volgende week. <strong>Nu.</strong>
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-green-200 hover:border-green-400 transition-all">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <ShieldCheckIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">100% Exclusief</h3>
              <p className="text-gray-700 leading-relaxed">
                Jouw lead = jouw klant. Geen concurrentie, geen prijsgevecht. <strong>Alleen jij krijgt de lead.</strong>
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl border-2 border-green-200 hover:border-green-400 transition-all">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CurrencyEuroIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Geen vaste kosten</h3>
              <p className="text-gray-700 leading-relaxed">
                Betaal alleen voor leads die je afneemt. <strong>Geen abonnement, geen verrassingen.</strong>
              </p>
            </div>
          </div>

          {/* Hoe Het Werkt */}
          <div className="bg-white rounded-3xl p-12 shadow-2xl max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Zo Simpel Werkt Het 👇
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                  1
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Kies je product</h4>
                  <p className="text-gray-700">
                    Thuisbatterijen, zonnepanelen, warmtepompen of airco's? Selecteer wat je wilt installeren.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                  2
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Ontvang leads binnen 15 min</h4>
                  <p className="text-gray-700">
                    Direct na bestelling krijg je verse leads. Naam, telefoonnummer, e-mail, interesse - alles wat je nodig hebt.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                  3
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Bel, Verkoop, Installeer</h4>
                  <p className="text-gray-700">
                    Neem contact op, plan een afspraak in, sluit de deal. Simpel toch?
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 text-center">
              <Link 
                href="/#lead-form"
                className="inline-block bg-gradient-to-r from-orange-600 to-red-600 text-white px-10 py-5 rounded-xl text-xl font-bold hover:from-orange-700 hover:to-red-700 transition-all shadow-2xl hover:scale-105"
              >
                🚀 Start Nu - Eerste Lead Binnen 15 Min
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bewijs Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Waarom Installateurs Voor Ons Kiezen 💯
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-8 shadow-lg border-2 border-gray-100">
            <div className="text-5xl mb-4">👨‍🔧</div>
            <p className="text-gray-700 italic mb-4">
              "Eindelijk meer klanten zonder dat ik duizenden euro's moet uitgeven aan marketing. 
              WarmeLeads heeft mijn bedrijf gered."
            </p>
            <p className="text-sm text-gray-500">- Jan, Zonnepanelen Installateur</p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg border-2 border-gray-100">
            <div className="text-5xl mb-4">🏢</div>
            <p className="text-gray-700 italic mb-4">
              "Binnen 2 weken had ik 3 installaties geboekt. ROI was 5x. Dit is de beste investering 
              die ik ooit heb gedaan."
            </p>
            <p className="text-sm text-gray-500">- Mark, Warmtepomp Specialist</p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg border-2 border-gray-100">
            <div className="text-5xl mb-4">⚡</div>
            <p className="text-gray-700 italic mb-4">
              "De leads zijn echt exclusief. Geen gedoe met 5 andere bedrijven die dezelfde klant 
              bellen. Perfect!"
            </p>
            <p className="text-sm text-gray-500">- Piet, Thuisbatterij Installateur</p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-12 text-center">
            Veelgestelde Vragen 🤔
          </h2>

          <div className="space-y-6">
            <details className="bg-white rounded-xl p-6 shadow-md">
              <summary className="font-bold text-lg cursor-pointer text-gray-900">
                Hoeveel kosten leads?
              </summary>
              <p className="mt-4 text-gray-700">
                Prijzen variëren per product type. Thuisbatterij leads vanaf €40, Zonnepanelen vanaf €25, 
                Warmtepompen vanaf €35. Geen abonnement, betaal alleen wat je afneemt.
              </p>
            </details>

            <details className="bg-white rounded-xl p-6 shadow-md">
              <summary className="font-bold text-lg cursor-pointer text-gray-900">
                Zijn de leads echt exclusief?
              </summary>
              <p className="mt-4 text-gray-700">
                Ja! Bij exclusieve leads ben jij de enige die de lead ontvangt. Geen concurrentie, 
                geen prijsgevecht. We hebben ook gedeelde leads (goedkoper) als je dat prefereert.
              </p>
            </details>

            <details className="bg-white rounded-xl p-6 shadow-md">
              <summary className="font-bold text-lg cursor-pointer text-gray-900">
                Hoe snel ontvang ik leads?
              </summary>
              <p className="mt-4 text-gray-700">
                Binnen 15 minuten na bestelling. We leveren real-time uit onze campagnes.
              </p>
            </details>

            <details className="bg-white rounded-xl p-6 shadow-md">
              <summary className="font-bold text-lg cursor-pointer text-gray-900">
                Wat als een lead niet reageert?
              </summary>
              <p className="mt-4 text-gray-700">
                Alle leads zijn geverifieerd en recent. We garanderen dat contactgegevens kloppen. 
                Tip: Bel binnen 5 minuten voor beste resultaat!
              </p>
            </details>

            <details className="bg-white rounded-xl p-6 shadow-md">
              <summary className="font-bold text-lg cursor-pointer text-gray-900">
                Is er een minimum afname?
              </summary>
              <p className="mt-4 text-gray-700">
                Nee! Neem 1 lead of 100 leads. Geen verplichtingen, geen abonnement. 
                Jij bepaalt wanneer en hoeveel.
              </p>
            </details>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Klaar Voor Meer Klanten? 🚀
          </h2>
          <p className="text-xl text-orange-100 mb-8 leading-relaxed">
            Stop met zoeken. Start met groeien.<br />
            Je eerste lead kan er over 15 minuten zijn.
          </p>
          <Link 
            href="/#lead-form"
            className="inline-block bg-white text-orange-600 px-10 py-5 rounded-xl text-xl font-bold hover:bg-orange-50 transition-all shadow-2xl hover:scale-105"
          >
            ✅ Ja, Ik Wil Meer Klanten
          </Link>
          <p className="mt-6 text-sm text-orange-200">
            Geen abonnement • Geen vaste kosten • 100% Exclusief
          </p>
        </div>
      </div>

      {/* Footer Links */}
      <div className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link href="/" className="hover:text-orange-400 transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-orange-400 transition-colors">Blog</Link>
            <Link href="/algemene-voorwaarden" className="hover:text-orange-400 transition-colors">Algemene Voorwaarden</Link>
            <Link href="/privacyverklaring" className="hover:text-orange-400 transition-colors">Privacy</Link>
          </div>
          <p className="mt-6 text-gray-400 text-xs">
            Warmeleads.eu • KvK: 88929280 • Stavangerweg 21-1, 9723 JC Groningen
          </p>
        </div>
      </div>
    </div>
  );
}

