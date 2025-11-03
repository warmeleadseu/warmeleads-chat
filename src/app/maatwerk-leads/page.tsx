import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Maatwerk Leadgeneratie | Custom Lead Campaigns | Warmeleads.eu',
  description: 'Op maat gemaakte leadgeneratie campagnes voor uw specifieke branche. Van niche markten tot grootschalige B2B campagnes. Exclusieve leads op basis van uw wensen.',
};

export default function MaatwerkLeadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <Link href="/" className="inline-flex items-center text-white/80 hover:text-white mb-8 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Terug naar home
          </Link>

          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              🎯 Maatwerk Leadgeneratie
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-4">
              Op maat gemaakte campagnes voor uw specifieke branche
            </p>
            <p className="text-lg text-white/70 max-w-3xl mx-auto">
              Werkt u in een niche markt? Heeft u specifieke targeting wensen? Wij ontwikkelen custom leadgeneratie campagnes volledig afgestemd op uw bedrijf.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-2xl font-bold mb-4">100% Op Maat</h3>
              <p className="text-white/80">
                Elke campagne wordt speciaal voor u ontwikkeld. Van messaging tot targeting, alles afgestemd op uw doelgroep en markt.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold mb-4">Niche Expertise</h3>
              <p className="text-white/80">
                Ook voor specialistische branches en nichemarkten ontwikkelen wij effectieve leadgeneratie strategieën die resultaat opleveren.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-2xl font-bold mb-4">Data-Driven</h3>
              <p className="text-white/80">
                Continue optimalisatie op basis van real-time data en performance metrics. Uw ROI staat centraal.
              </p>
            </div>
          </div>

          {/* Use Cases */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">Perfect Voor</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-4">
                <div className="text-3xl">🏗️</div>
                <div>
                  <h4 className="font-bold mb-2">Specialistische B2B</h4>
                  <p className="text-white/70">Industriële installaties, technische dienstverlening, zakelijke oplossingen</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="text-3xl">🏡</div>
                <div>
                  <h4 className="font-bold mb-2">Premium B2C</h4>
                  <p className="text-white/70">Luxe renovaties, exclusieve producten, high-end diensten</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="text-3xl">🌱</div>
                <div>
                  <h4 className="font-bold mb-2">Nieuwe Markten</h4>
                  <p className="text-white/70">Innovatieve producten, emerging technologies, nieuwe branches</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="text-3xl">📍</div>
                <div>
                  <h4 className="font-bold mb-2">Regionale Focus</h4>
                  <p className="text-white/70">Hyper-local targeting, specifieke regio's of gemeentes</p>
                </div>
              </div>
            </div>
          </div>

          {/* What We Deliver */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">Wat wij leveren</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-bold text-xl mb-4">📋 Strategie & Planning</h4>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Marktanalyse voor uw sector</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Campagne strategie ontwikkeling</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Targeting optimalisatie</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> ROI maximalisatie</li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-xl mb-4">🚀 Uitvoering & Support</h4>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Custom creatives & landing pages</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Multi-channel campagnes</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Dedicated account manager</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Maandelijkse rapportages</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Process Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">Ons maatwerk proces</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-4">📋</div>
                <h4 className="font-bold mb-2">1. Intake</h4>
                <p className="text-white/70">Analyse van uw doelgroep en markt</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🎨</div>
                <h4 className="font-bold mb-2">2. Campagne Design</h4>
                <p className="text-white/70">Custom creatives en messaging</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🚀</div>
                <h4 className="font-bold mb-2">3. Launch</h4>
                <p className="text-white/70">Campagne activatie en monitoring</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">📊</div>
                <h4 className="font-bold mb-2">4. Optimalisatie</h4>
                <p className="text-white/70">Continue verbetering en scaling</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Laten we uw campagne bespreken</h2>
            <p className="text-xl text-white/80 mb-8">
              Vertel ons over uw branche en wij maken de perfecte leadgeneratie strategie
            </p>
            <a 
              href="/"
              className="inline-block bg-white text-brand-purple px-12 py-6 rounded-2xl font-bold text-xl hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              🎯 Bespreek Maatwerk Leads
            </a>
          </div>

          {/* Footer Links */}
          <div className="mt-16 text-center border-t border-white/20 pt-8">
            <p className="text-white/60 text-sm mb-4">
              🔒 Uw gegevens zijn veilig • 💰 Geen verborgen kosten • ⚡ Direct resultaat
            </p>
            <div className="space-x-4">
              <a 
                href="/leadgeneratie-gids" 
                className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                📖 Leadgeneratie gids
              </a>
              <span className="text-white/30">•</span>
              <a 
                href="/blog" 
                className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                📝 Blog & Tips
              </a>
              <span className="text-white/30">•</span>
              <a 
                href="/algemene-voorwaarden" 
                className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                📋 Algemene voorwaarden
              </a>
              <span className="text-white/30">•</span>
              <a 
                href="/privacyverklaring" 
                className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
              >
                🔒 Privacyverklaring
              </a>
            </div>
            
            {/* Bedrijfsgegevens */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-white/50 text-xs">
                Warmeleads.eu • KvK: 88929280 • Stavangerweg 21-1, 9723 JC Groningen
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
