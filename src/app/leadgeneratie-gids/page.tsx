import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leadgeneratie Gids 2025 | Leads Kopen vs Zelf Genereren | WarmeLeads",
  description: "Complete gids voor leadgeneratie in Nederland 2025. Vergelijk leads kopen vs zelf genereren voor thuisbatterijen, zonnepanelen, warmtepompen en meer. Expert tips van WarmeLeads.",
  keywords: "leadgeneratie gids, leads kopen, leadgeneratie strategie, Nederlandse leadgeneratie, B2B leadgeneratie, lead generation Nederland",
};

export default function LeadgeneratieGidsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      {/* SEO Hidden Content */}
      <div className="sr-only">
        <h1>Leadgeneratie Gids Nederland 2025 - Complete Strategie voor Leads Kopen</h1>
        <p>Complete gids voor leadgeneratie in Nederland. Vergelijk leads kopen vs zelf genereren voor thuisbatterijen, zonnepanelen, warmtepompen en meer.</p>
      </div>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-white">
          {/* Hero Content */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Leadgeneratie Gids
            </h1>
            <p className="text-2xl md:text-3xl mb-8 text-white/90">
              Complete strategie voor leads kopen in Nederland 2025
            </p>
            <p className="text-lg text-white/80 max-w-3xl mx-auto">
              Ontdek waarom leads kopen effectiever is dan zelf genereren, en hoe u maximale ROI 
              behaalt uit uw leadgeneratie investering.
            </p>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Leads Kopen */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Leads Kopen</h3>
              </div>
              <ul className="space-y-3 text-white/90">
                <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Directe resultaten binnen 15 minuten</li>
                <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Geen setup tijd of expertise vereist</li>
                <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Profiteer van onze campagne-ervaring</li>
                <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Schaalbaarheid naar behoefte</li>
                <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> ROI focus - betaal alleen voor kwaliteit</li>
              </ul>
            </div>

            {/* Zelf Genereren */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-red-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Zelf Genereren</h3>
              </div>
              <ul className="space-y-3 text-white/90">
                <li className="flex items-center"><span className="text-red-400 mr-3">✗</span> Maanden setup voor eerste resultaten</li>
                <li className="flex items-center"><span className="text-red-400 mr-3">✗</span> Google Ads & Facebook expertise vereist</li>
                <li className="flex items-center"><span className="text-red-400 mr-3">✗</span> Hoog budget risico zonder garantie</li>
                <li className="flex items-center"><span className="text-red-400 mr-3">✗</span> Constante optimalisatie nodig</li>
                <li className="flex items-center"><span className="text-red-400 mr-3">✗</span> Fulltime aandacht vereist</li>
              </ul>
            </div>
          </div>

          {/* Branche Expertise */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Onze Branche Expertise</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-white/10 rounded-xl">
                <div className="text-4xl mb-4">🔋</div>
                <h4 className="font-bold mb-2">Thuisbatterijen</h4>
                <p className="text-white/70">Huiseigenaren met zonnepanelen die energie-onafhankelijkheid zoeken</p>
              </div>
              <div className="text-center p-6 bg-white/10 rounded-xl">
                <div className="text-4xl mb-4">☀️</div>
                <h4 className="font-bold mb-2">Zonnepanelen</h4>
                <p className="text-white/70">Huiseigenaren met hoge energierekeningen en duurzaamheidsfocus</p>
              </div>
              <div className="text-center p-6 bg-white/10 rounded-xl">
                <div className="text-4xl mb-4">🌡️</div>
                <h4 className="font-bold mb-2">Warmtepompen</h4>
                <p className="text-white/70">Huiseigenaren die willen verduurzamen en besparen</p>
              </div>
              <div className="text-center p-6 bg-white/10 rounded-xl">
                <div className="text-4xl mb-4">❄️</div>
                <h4 className="font-bold mb-2">Airco's</h4>
                <p className="text-white/70">Comfort en klimaatbeheersing voor Nederlandse huishoudens</p>
              </div>
              <div className="text-center p-6 bg-white/10 rounded-xl">
                <div className="text-4xl mb-4">💼</div>
                <h4 className="font-bold mb-2">Financial Lease</h4>
                <p className="text-white/70">MKB bedrijven die financiering zoeken voor investeringen</p>
              </div>
              <div className="text-center p-6 bg-white/10 rounded-xl">
                <div className="text-4xl mb-4">🎯</div>
                <h4 className="font-bold mb-2">Maatwerk</h4>
                <p className="text-white/70">Custom campagnes voor uw specifieke branche</p>
              </div>
            </div>
          </div>

          {/* Why WarmeLeads Section */}
          <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Waarom WarmeLeads de Beste Keuze is</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xl font-bold mb-4 text-green-300">✅ Onze Voordelen</h4>
                <ul className="space-y-3">
                  <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> 24/7 draaiende campagnes</li>
                  <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Verse Nederlandse prospects</li>
                  <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Realtime dashboard updates</li>
                  <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Branche-specifieke targeting</li>
                  <li className="flex items-center"><span className="text-green-400 mr-3">✓</span> Kwaliteitsgarantie en support</li>
                </ul>
              </div>
              <div>
                <h4 className="text-xl font-bold mb-4 text-blue-300">🎯 Uw Resultaat</h4>
                <ul className="space-y-3">
                  <li className="flex items-center"><span className="text-blue-400 mr-3">→</span> Meer tijd voor verkopen</li>
                  <li className="flex items-center"><span className="text-blue-400 mr-3">→</span> Hogere conversiekansen</li>
                  <li className="flex items-center"><span className="text-blue-400 mr-3">→</span> Voorspelbare leadflow</li>
                  <li className="flex items-center"><span className="text-blue-400 mr-3">→</span> Snellere business groei</li>
                  <li className="flex items-center"><span className="text-blue-400 mr-3">→</span> Betere ROI op marketing</li>
                </ul>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Klaar om te Starten?</h2>
            <p className="text-xl text-white/80 mb-8">
              Begin vandaag nog met verse Nederlandse prospects uit onze campagnes
            </p>
            <a 
              href="/"
              className="inline-block bg-white text-brand-purple px-12 py-6 rounded-2xl font-bold text-xl hover:scale-110 transition-all duration-300 shadow-2xl"
            >
              🚀 Start met Verse Leads
            </a>
          </div>

          {/* Internal Links for SEO */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <a href="/leads-thuisbatterijen" className="block p-6 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
              <div className="text-center">
                <div className="text-3xl mb-2">🔋</div>
                <h3 className="font-bold text-lg mb-2 text-white">Thuisbatterij Leads</h3>
                <p className="text-white/70">Verse prospects voor battery storage installateurs</p>
              </div>
            </a>
            <a href="/leads-zonnepanelen" className="block p-6 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
              <div className="text-center">
                <div className="text-3xl mb-2">☀️</div>
                <h3 className="font-bold text-lg mb-2 text-white">Zonnepanelen Leads</h3>
                <p className="text-white/70">Nederlandse solar prospects uit campagnes</p>
              </div>
            </a>
            <a href="/leads-warmtepompen" className="block p-6 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
              <div className="text-center">
                <div className="text-3xl mb-2">🌡️</div>
                <h3 className="font-bold text-lg mb-2 text-white">Warmtepomp Leads</h3>
                <p className="text-white/70">HVAC leads voor warmtepomp installateurs</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
