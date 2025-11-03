import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Zonnepanelen Leads Kopen | Solar Installateur Prospects Nederland | WarmeLeads",
  description: "Koop verse zonnepanelen leads in Nederland. Exclusieve en gedeelde prospects voor solar installateurs. Echte geïnteresseerde klanten uit onze campagnes, realtime delivery binnen 15 minuten.",
  keywords: "zonnepanelen leads, solar leads, zonnepaneel prospects, solar installateur leads, exclusieve zonnepanelen leads, gedeelde solar leads, photovoltaic leads",
  openGraph: {
    title: "Zonnepanelen Leads Kopen Nederland | Solar Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde zonnepanelen leads voor installateurs. Nederlandse prospects uit onze campagnes, realtime delivery binnen 15 minuten.",
    url: "https://www.warmeleads.eu/leads-zonnepanelen",
  },
};

export default function ZonnepanelenLeadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>Zonnepanelen Leads Kopen Nederland - Solar Installateur Prospects</h1>
        <p>WarmeLeads levert verse zonnepanelen leads voor solar installateurs in Nederland. Exclusieve en gedeelde prospects uit onze campagnes, realtime delivery binnen 15 minuten.</p>
      </div>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-400/20 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center text-white">
          {/* Hero Content */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              Zonnepanelen Leads
            </h1>
            <p className="text-2xl md:text-3xl mb-8 text-white/90">
              Nederlandse prospects die solar energie willen
            </p>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              Verse leads uit onze campagnes voor solar installateurs. Echte geïnteresseerde huiseigenaren 
              die actief zoeken naar zonnepaneel installatie en duurzame energie oplossingen.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Exclusieve Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">☀️</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Exclusieve solar leads</h3>
                <div className="text-4xl font-bold mb-2">€40,00 - €45,00</div>
                <div className="text-white/70 mb-6">per lead</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> 100% exclusief voor uw solar bedrijf</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Geen concurrentie van andere installateurs</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Maximale conversiekans</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Nederlandse huiseigenaren</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met Solar Leads →
                </a>
              </div>
            </div>

            {/* Gedeelde Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤝</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Gedeelde solar leads</h3>
                <div className="text-4xl font-bold mb-2">€15,00</div>
                <div className="text-white/70 mb-6">per lead (min. 100)</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Gedeeld met max 2 anderen</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Zeer kosteneffectief</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Perfect voor startende bedrijven</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Uitstekende ROI</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-blue-400 to-purple-500 text-white font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met Gedeelde Leads →
                </a>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">Nederlandse solar markt expertise</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🏠</div>
                <h4 className="font-bold mb-2">Huiseigenaren</h4>
                <p className="text-white/70">Gerichte targeting op eigenwoningbezitters</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">💰</div>
                <h4 className="font-bold mb-2">Budget Verificatie</h4>
                <p className="text-white/70">Prospects met investeringsbudget</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">📍</div>
                <h4 className="font-bold mb-2">Lokale Focus</h4>
                <p className="text-white/70">Nederlandse regio's en steden</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">⏰</div>
                <h4 className="font-bold mb-2">Timing Perfect</h4>
                <p className="text-white/70">Actieve interesse, nu</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Begin Vandaag met Solar Leads</h2>
            <p className="text-xl text-white/80 mb-8">
              Nederlandse huiseigenaren wachten op uw zonnepaneel oplossing
            </p>
            <a 
              href="/"
              className="inline-block bg-white text-brand-purple px-12 py-6 rounded-2xl font-bold text-xl hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              ☀️ Start met Zonnepanelen Leads
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
