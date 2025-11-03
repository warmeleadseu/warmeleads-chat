import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Thuisbatterij Leads Kopen | Exclusieve Prospects Nederland | WarmeLeads",
  description: "Koop verse thuisbatterij leads in Nederland. Exclusieve en gedeelde prospects voor thuisbatterij installateurs. Echte geïnteresseerde klanten uit onze campagnes, realtime delivery binnen 15 minuten.",
  keywords: "thuisbatterij leads, thuisbatterij prospects, battery storage leads, energie opslag leads, thuisbatterij installateur leads, exclusieve thuisbatterij leads, gedeelde thuisbatterij leads",
  openGraph: {
    title: "Thuisbatterij Leads Kopen Nederland | Verse Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde thuisbatterij leads voor installateurs. Nederlandse prospects uit onze campagnes, realtime delivery binnen 15 minuten.",
    url: "https://www.warmeleads.eu/leads-thuisbatterijen",
  },
};

export default function ThuisbatterijLeadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>Thuisbatterij Leads Kopen Nederland - Exclusieve en Gedeelde Prospects</h1>
        <p>WarmeLeads levert verse thuisbatterij leads voor installateurs in Nederland. Exclusieve en gedeelde prospects uit onze campagnes, realtime delivery binnen 15 minuten.</p>
      </div>

      {/* Hero Section - Consistent met homepage */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects - Zelfde als homepage */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center text-white">
          {/* Hero Content */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Thuisbatterij Leads
            </h1>
            <p className="text-2xl md:text-3xl mb-8 text-white/90">
              Nederlandse prospects die energie-onafhankelijkheid zoeken
            </p>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              Verse leads uit onze campagnes voor thuisbatterij installateurs. Echte geïnteresseerde huiseigenaren 
              met zonnepanelen die hun energieopslag willen uitbreiden.
            </p>
          </div>

          {/* Pricing Cards - Consistent design */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Exclusieve Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💎</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Exclusieve thuisbatterij leads</h3>
                <div className="text-4xl font-bold mb-2">€37,50 - €42,50</div>
                <div className="text-white/70 mb-6">per lead</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> 100% exclusief voor uw bedrijf</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Geen concurrentie</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Maximale conversiekans</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Realtime uit campagnes</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met Exclusieve Leads →
                </a>
              </div>
            </div>

            {/* Gedeelde Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤝</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Gedeelde thuisbatterij leads</h3>
                <div className="text-4xl font-bold mb-2">€12,50</div>
                <div className="text-white/70 mb-6">per lead (min. 100)</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Gedeeld met max 2 anderen</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Zeer kosteneffectief</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Perfect om te starten</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Hoge kwaliteit prospects</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-blue-400 to-purple-500 text-white font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met Gedeelde Leads →
                </a>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">Waarom WarmeLeads Thuisbatterij Leads?</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-4">⚡</div>
                <h4 className="font-bold mb-2">Verse Leads</h4>
                <p className="text-white/70">Direct uit campagnes</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🎯</div>
                <h4 className="font-bold mb-2">Nederlandse Markt</h4>
                <p className="text-white/70">100% Nederlandse prospects</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">📊</div>
                <h4 className="font-bold mb-2">Realtime Dashboard</h4>
                <p className="text-white/70">Live updates kwartier nauwkeurig</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🛡️</div>
                <h4 className="font-bold mb-2">Kwaliteitsgarantie</h4>
                <p className="text-white/70">30 dagen geld terug</p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Klaar om te Starten?</h2>
            <p className="text-xl text-white/80 mb-8">
              Ontvang vandaag nog uw eerste verse thuisbatterij prospects
            </p>
            <a 
              href="/"
              className="inline-block bg-white text-brand-purple px-12 py-6 rounded-2xl font-bold text-xl hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              🚀 Start Direct met Leads
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
