import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Warmtepomp Leads Kopen | HVAC Installateur Prospects Nederland | WarmeLeads",
  description: "Koop verse warmtepomp leads in Nederland. Exclusieve en gedeelde prospects voor warmtepomp installateurs. Echte geïnteresseerde klanten uit onze campagnes, realtime delivery binnen 15 minuten.",
  keywords: "warmtepomp leads, warmtepomp prospects, HVAC leads, warmtepomp installateur leads, exclusieve warmtepomp leads, gedeelde warmtepomp leads, heat pump leads Nederland",
  openGraph: {
    title: "Warmtepomp Leads Kopen Nederland | HVAC Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde warmtepomp leads voor installateurs. Nederlandse prospects uit onze campagnes, realtime delivery binnen 15 minuten.",
    url: "https://www.warmeleads.eu/leads-warmtepompen",
  },
};

export default function WarmtepompLeadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>Warmtepomp Leads Kopen Nederland - HVAC Installateur Prospects</h1>
        <p>WarmeLeads levert verse warmtepomp leads voor HVAC installateurs in Nederland. Exclusieve en gedeelde prospects uit onze campagnes, realtime delivery binnen 15 minuten.</p>
      </div>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-400/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center text-white">
          {/* Hero Content */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">
              Warmtepomp Leads
            </h1>
            <p className="text-2xl md:text-3xl mb-8 text-white/90">
              Nederlandse prospects die duurzaam willen verwarmen
            </p>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              Verse leads uit onze campagnes voor warmtepomp installateurs. Echte geïnteresseerde huiseigenaren 
              die klaar zijn voor de overstap naar duurzame verwarming en koeling.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Exclusieve Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🌡️</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Exclusieve HVAC leads</h3>
                <div className="text-4xl font-bold mb-2">€45,00 - €50,00</div>
                <div className="text-white/70 mb-6">per lead</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> 100% exclusief voor uw HVAC bedrijf</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Geen concurrentie</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Premium warmtepomp prospects</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Nederlandse huiseigenaren</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-green-400 to-blue-500 text-white font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met HVAC Leads →
                </a>
              </div>
            </div>

            {/* Gedeelde Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤝</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Gedeelde warmtepomp leads</h3>
                <div className="text-4xl font-bold mb-2">€16,50</div>
                <div className="text-white/70 mb-6">per lead (min. 75)</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Gedeeld met max 2 anderen</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Zeer kosteneffectief</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Perfect voor startende HVAC bedrijven</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Hoge kwaliteit prospects</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met Gedeelde Leads →
                </a>
              </div>
            </div>
          </div>

          {/* Market Trends Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">Nederlandse warmtepomp markt 2025</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🚫</div>
                <h4 className="font-bold mb-2">Gasketel Verbod</h4>
                <p className="text-white/70">Nieuwe wetgeving drijft vraag</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">💰</div>
                <h4 className="font-bold mb-2">Subsidies</h4>
                <p className="text-white/70">Overheidssteun voor warmtepompen</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🌱</div>
                <h4 className="font-bold mb-2">Duurzaamheid</h4>
                <p className="text-white/70">Focus op CO2 reductie</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">📈</div>
                <h4 className="font-bold mb-2">Groeiende Markt</h4>
                <p className="text-white/70">Exponentiële vraag toename</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Profiteer van de Warmtepomp Boom</h2>
            <p className="text-xl text-white/80 mb-8">
              Nederlandse huiseigenaren zoeken nu naar warmtepomp oplossingen
            </p>
            <a 
              href="/"
              className="inline-block bg-white text-brand-purple px-12 py-6 rounded-2xl font-bold text-xl hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              🌡️ Start met Warmtepomp Leads
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
