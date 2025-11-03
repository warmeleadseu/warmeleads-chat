import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Warmtepomp Subsidies 2025: Impact op Leadgeneratie | WarmeLeads Blog",
  description: "Ontdek hoe nieuwe warmtepomp subsidies in 2025 de leadgeneratie beïnvloeden. Tips voor HVAC installateurs om hierop in te spelen en meer leads te genereren.",
  keywords: "warmtepomp subsidies 2025, ISDE subsidie, warmtepomp leads, HVAC subsidies Nederland, warmtepomp installateur marketing",
};

export default function WarmtepompSubsidiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy via-brand-purple to-brand-pink">
      <div className="relative py-20 overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-white">
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">🌡️</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">
              Warmtepomp Subsidies 2025
            </h1>
            <p className="text-xl text-white/90 mb-4">Impact op leadgeneratie en kansen voor installateurs</p>
            <div className="text-sm text-white/70">23 september 2025 • 6 min leestijd • Trends</div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20 mb-12">
            <div className="prose prose-lg max-w-none text-white">
              <h2 className="text-2xl font-bold mb-4 text-white">ISDE Subsidie 2025: Wat Verandert Er?</h2>
              <p className="text-white/90 mb-6">
                De Investeringssubsidie Duurzame Energie (ISDE) voor 2025 brengt belangrijke veranderingen. 
                Voor warmtepomp installateurs betekent dit nieuwe kansen en uitdagingen in leadgeneratie.
              </p>

              <h3 className="text-xl font-bold mb-3 text-white">💰 Nieuwe Subsidiebedragen</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-300">€2.500</div>
                  <div className="text-sm text-white/70">Lucht/water warmtepomp</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-300">€4.000</div>
                  <div className="text-sm text-white/70">Bodem/water warmtepomp</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-300">€1.500</div>
                  <div className="text-sm text-white/70">Hybride warmtepomp</div>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">🎯 Impact op Leadgeneratie</h3>
              <div className="bg-white/10 rounded-xl p-6 mb-6">
                <h4 className="font-bold mb-3 text-green-300">✅ Positieve Effecten</h4>
                <ul className="space-y-2 text-white/90">
                  <li>• <strong>Hogere interesse:</strong> Subsidies maken investering aantrekkelijker</li>
                  <li>• <strong>Snellere beslissingen:</strong> Beperkte subsidie periode creëert urgentie</li>
                  <li>• <strong>Bredere doelgroep:</strong> Meer huishoudens kunnen zich warmtepomp veroorloven</li>
                  <li>• <strong>Betere conversie:</strong> Financiële ondersteuning verhoogt commitment</li>
                </ul>
              </div>

              <h3 className="text-xl font-bold mb-3 text-white">📈 Leadgeneratie Strategieën</h3>
              <p className="text-white/90 mb-4">
                Slimme HVAC bedrijven spelen in op deze subsidie trends. Door subsidie-gerichte messaging 
                in uw leadgeneratie campagnes kunt u de conversiekans significant verhogen.
              </p>

              <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-xl p-6 border border-green-400/30">
                <h4 className="font-bold mb-3 text-green-300">💡 Pro Tip</h4>
                <p className="text-white/90">
                  Gebruik "€4.000 subsidie nog beschikbaar" in uw advertenties. Dit creëert urgentie en 
                  verhoogt de klik-through rate met gemiddeld 35%. Timing is alles in de subsidie periode.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Profiteer van Subsidie Trends</h2>
            <p className="text-white/80 mb-6">Onze warmtepomp leads zijn subsidie-bewust en klaar om te investeren</p>
            <Link href="/leads-warmtepompen" className="inline-block bg-white text-brand-purple px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform mr-4">
              🌡️ Warmtepomp Leads
            </Link>
            <Link href="/blog" className="inline-block bg-white/20 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/30 transition-colors">
              ← Alle Artikelen
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}






