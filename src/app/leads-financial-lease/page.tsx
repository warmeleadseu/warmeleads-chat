import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Financial Lease Leads Kopen | B2B Prospects Nederland | WarmeLeads",
  description: "Koop verse financial lease leads in Nederland. Exclusieve en gedeelde B2B prospects voor lease adviseurs. Echte geïnteresseerde bedrijven uit onze campagnes, realtime delivery binnen 15 minuten.",
  keywords: "financial lease leads, lease prospects, B2B lease leads, financial lease adviseur leads, exclusieve lease leads, gedeelde lease leads, bedrijfsfinanciering leads",
  openGraph: {
    title: "Financial Lease Leads Kopen Nederland | B2B Prospects | WarmeLeads",
    description: "Exclusieve en gedeelde financial lease leads voor adviseurs. Nederlandse B2B prospects uit onze campagnes, realtime delivery binnen 15 minuten.",
    url: "https://www.warmeleads.eu/leads-financial-lease",
  },
};

export default function FinancialLeaseLeadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>Financial Lease Leads Kopen Nederland - B2B Prospects voor Lease Adviseurs</h1>
        <p>WarmeLeads levert verse financial lease leads voor adviseurs in Nederland. Exclusieve en gedeelde B2B prospects uit onze campagnes, realtime delivery binnen 15 minuten.</p>
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
              Financial Lease Leads
            </h1>
            <p className="text-2xl md:text-3xl mb-8 text-white/90">
              Nederlandse bedrijven die financiering zoeken
            </p>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              Verse B2B leads uit onze campagnes voor financial lease adviseurs. Echte geïnteresseerde bedrijven 
              die actief zoeken naar financieringsoplossingen voor investeringen.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Exclusieve Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💼</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Exclusieve lease leads</h3>
                <div className="text-4xl font-bold mb-2">€45,00 - €55,00</div>
                <div className="text-white/70 mb-6">per lead</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> 100% exclusief voor uw kantoor</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Geen concurrentie van andere adviseurs</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> B2B prospects met budget</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Nederlandse bedrijven</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-green-400 to-blue-500 text-white font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met Lease Leads →
                </a>
              </div>
            </div>

            {/* Gedeelde Leads Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤝</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Gedeelde lease leads</h3>
                <div className="text-4xl font-bold mb-2">€18,50</div>
                <div className="text-white/70 mb-6">per lead (min. 50)</div>
                <ul className="text-left space-y-2 mb-8">
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Gedeeld met max 2 anderen</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Kosteneffectieve B2B leads</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Perfect voor startende adviseurs</li>
                  <li className="flex items-center"><span className="text-green-400 mr-2">✓</span> Uitstekende ROI</li>
                </ul>
                <a href="/" className="inline-block w-full bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold py-4 rounded-xl hover:scale-105 transition-transform">
                  Start met Gedeelde Leads →
                </a>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <h2 className="text-3xl font-bold mb-8">B2B Financial Lease Expertise</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🏢</div>
                <h4 className="font-bold mb-2">MKB Bedrijven</h4>
                <p className="text-white/70">Targeting op groeiende ondernemingen</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">💰</div>
                <h4 className="font-bold mb-2">Investeringsbudget</h4>
                <p className="text-white/70">Bedrijven met financieringsbehoefte</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">📈</div>
                <h4 className="font-bold mb-2">Groei Fase</h4>
                <p className="text-white/70">Bedrijven in uitbreidingsfase</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🎯</div>
                <h4 className="font-bold mb-2">Actieve Interesse</h4>
                <p className="text-white/70">Directe financieringsbehoefte</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Begin met B2B Lease Leads</h2>
            <p className="text-xl text-white/80 mb-8">
              Nederlandse bedrijven wachten op uw financieringsoplossingen
            </p>
            <a 
              href="/"
              className="inline-block bg-white text-brand-purple px-12 py-6 rounded-2xl font-bold text-xl hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              💼 Start met Financial Lease Leads
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



